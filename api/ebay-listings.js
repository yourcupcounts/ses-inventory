// eBay Active Listings API
// Fetches seller's current active listings from multiple sources

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get access token from request header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' });
  }
  
  const accessToken = authHeader.replace('Bearer ', '');
  
  try {
    // First get user info to get the username for Browse API
    let username = null;
    const userResponse = await fetch(
      'https://apiz.ebay.com/commerce/identity/v1/user/',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.username;
    }
    
    // Use the Sell Inventory API to get offers (listings created via API)
    const inventoryResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=100',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!inventoryResponse.ok && inventoryResponse.status === 401) {
      return res.status(401).json({ 
        error: 'Token expired', 
        needsRefresh: true
      });
    }
    
    let inventoryData = { inventoryItems: [] };
    if (inventoryResponse.ok) {
      inventoryData = await inventoryResponse.json();
    }
    
    // Get active offers from Inventory API
    const offersResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/offer?limit=100',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let offersData = { offers: [] };
    if (offersResponse.ok) {
      offersData = await offersResponse.json();
    }
    
    // *** KEY: Use Browse API to get ALL active listings ***
    // This includes listings created on eBay website, app, or any method
    let browseListings = [];
    let browseError = null;
    
    if (username) {
      try {
        // Search for all active listings by this seller
        const browseResponse = await fetch(
          `https://api.ebay.com/buy/browse/v1/item_summary/search?q=*&filter=sellers:{${encodeURIComponent(username)}}&limit=200`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
            }
          }
        );
        
        if (browseResponse.ok) {
          const browseData = await browseResponse.json();
          browseListings = (browseData.itemSummaries || []).map(item => ({
            type: 'browse',
            itemId: item.itemId,
            legacyItemId: item.legacyItemId,
            title: item.title,
            price: item.price?.value,
            currency: item.price?.currency,
            condition: item.condition,
            conditionId: item.conditionId,
            imageUrl: item.image?.imageUrl,
            thumbnailImages: item.thumbnailImages?.map(t => t.imageUrl),
            itemWebUrl: item.itemWebUrl,
            seller: item.seller?.username,
            buyingOptions: item.buyingOptions,
            itemGroupType: item.itemGroupType,
            categories: item.categories?.map(c => ({ id: c.categoryId, name: c.categoryName }))
          }));
        } else {
          const errData = await browseResponse.json().catch(() => ({}));
          browseError = { status: browseResponse.status, ...errData };
        }
      } catch (browseErr) {
        browseError = { message: browseErr.message };
      }
    }
    
    // Get fulfillment orders
    const fulfillmentResponse = await fetch(
      'https://api.ebay.com/sell/fulfillment/v1/order?limit=50',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let fulfillmentData = { orders: [] };
    if (fulfillmentResponse.ok) {
      fulfillmentData = await fulfillmentResponse.json();
    }
    
    // Combine all sources into a unified listings array
    const listings = [];
    const seenItemIds = new Set();
    
    // Add browse listings first (most comprehensive)
    for (const item of browseListings) {
      if (!seenItemIds.has(item.itemId)) {
        seenItemIds.add(item.itemId);
        listings.push({
          ...item,
          status: 'ACTIVE',
          source: 'browse'
        });
      }
    }
    
    // Add offers from Inventory API
    if (offersData.offers && offersData.offers.length > 0) {
      for (const offer of offersData.offers) {
        // Check if we already have this listing from browse
        const existingListing = listings.find(l => 
          l.legacyItemId === offer.listingId || 
          l.itemId === offer.listingId
        );
        
        if (existingListing) {
          // Enhance with offer data
          existingListing.sku = offer.sku;
          existingListing.offerId = offer.offerId;
          existingListing.format = offer.format;
          existingListing.inventoryPrice = offer.pricingSummary?.price?.value;
          existingListing.quantity = offer.availableQuantity;
        } else if (!seenItemIds.has(offer.listingId)) {
          // Add as new listing
          seenItemIds.add(offer.listingId);
          listings.push({
            type: 'offer',
            sku: offer.sku,
            listingId: offer.listingId,
            offerId: offer.offerId,
            status: offer.status,
            format: offer.format,
            price: offer.pricingSummary?.price?.value,
            currency: offer.pricingSummary?.price?.currency,
            quantity: offer.availableQuantity,
            source: 'inventory_api'
          });
        }
      }
    }
    
    // Enhance listings with inventory item details
    if (inventoryData.inventoryItems) {
      for (const item of inventoryData.inventoryItems) {
        const existingListing = listings.find(l => l.sku === item.sku);
        if (existingListing) {
          existingListing.inventoryTitle = item.product?.title;
          existingListing.inventoryDescription = item.product?.description;
          existingListing.inventoryImageUrls = item.product?.imageUrls;
        }
      }
    }
    
    const recentOrders = fulfillmentData.orders?.slice(0, 10).map(order => ({
      orderId: order.orderId,
      creationDate: order.creationDate,
      orderTotal: order.pricingSummary?.total?.value,
      items: order.lineItems?.map(li => ({
        title: li.title,
        sku: li.sku,
        quantity: li.quantity,
        price: li.lineItemCost?.value
      }))
    })) || [];
    
    res.status(200).json({
      success: true,
      username,
      totalListings: listings.length,
      listings,
      recentOrders,
      raw: {
        browseCount: browseListings.length,
        inventoryCount: inventoryData.inventoryItems?.length || 0,
        offersCount: offersData.offers?.length || 0,
        ordersCount: fulfillmentData.orders?.length || 0
      },
      errors: {
        browse: browseError
      },
      apiStatus: {
        user: userResponse.status,
        inventory: inventoryResponse.status,
        offers: offersResponse.status,
        fulfillment: fulfillmentResponse.status
      }
    });
    
  } catch (err) {
    console.error('eBay listings error:', err);
    res.status(500).json({ error: err.message });
  }
}
