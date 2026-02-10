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
    // Get user info
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
    
    // Use the Sell Inventory API to get inventory items
    const inventoryResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=200',
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
      'https://api.ebay.com/sell/inventory/v1/offer?limit=200',
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
    
    // Try Marketing API to get promoted listings (shows all active listings)
    let marketingListings = [];
    let marketingError = null;
    
    try {
      // Get all listing IDs from Marketing API
      const marketingResponse = await fetch(
        'https://api.ebay.com/sell/marketing/v1/ad_campaign?limit=50',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (marketingResponse.ok) {
        const marketingData = await marketingResponse.json();
        // Extract listing IDs from campaigns
        for (const campaign of (marketingData.campaigns || [])) {
          if (campaign.campaignStatus === 'RUNNING') {
            // Get ads in this campaign
            const adsResponse = await fetch(
              `https://api.ebay.com/sell/marketing/v1/ad_campaign/${campaign.campaignId}/ad?limit=200`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            if (adsResponse.ok) {
              const adsData = await adsResponse.json();
              for (const ad of (adsData.ads || [])) {
                marketingListings.push({
                  listingId: ad.listingId,
                  status: ad.adStatus,
                  campaignId: campaign.campaignId
                });
              }
            }
          }
        }
      }
    } catch (mErr) {
      marketingError = mErr.message;
    }
    
    // Try Analytics API traffic report to find active listings
    let analyticsListings = [];
    try {
      const analyticsResponse = await fetch(
        'https://api.ebay.com/sell/analytics/v1/traffic_report?dimension=LISTING&metric=LISTING_VIEWS_TOTAL',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          }
        }
      );
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        analyticsListings = (analyticsData.dimensionMetrics || []).map(dm => ({
          listingId: dm.dimension?.dimensionValue,
          views: dm.metrics?.find(m => m.metricKey === 'LISTING_VIEWS_TOTAL')?.value
        })).filter(l => l.listingId);
      }
    } catch (aErr) {
      console.log('Analytics error:', aErr.message);
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
    const seenIds = new Set();
    
    // Add offers from Inventory API (these are API-created listings)
    if (offersData.offers && offersData.offers.length > 0) {
      for (const offer of offersData.offers) {
        if (offer.listingId && !seenIds.has(offer.listingId)) {
          seenIds.add(offer.listingId);
          
          // Find matching inventory item
          const invItem = inventoryData.inventoryItems?.find(i => i.sku === offer.sku);
          
          listings.push({
            type: 'inventory_api',
            itemId: offer.listingId,
            listingId: offer.listingId,
            sku: offer.sku,
            offerId: offer.offerId,
            title: invItem?.product?.title || offer.sku,
            status: offer.status,
            format: offer.format,
            price: offer.pricingSummary?.price?.value,
            currency: offer.pricingSummary?.price?.currency,
            quantity: offer.availableQuantity,
            imageUrl: invItem?.product?.imageUrls?.[0],
            condition: invItem?.condition
          });
        }
      }
    }
    
    // Add listings from analytics (these are all listings with any views)
    for (const item of analyticsListings) {
      if (item.listingId && !seenIds.has(item.listingId)) {
        seenIds.add(item.listingId);
        listings.push({
          type: 'analytics',
          itemId: item.listingId,
          listingId: item.listingId,
          title: `Listing ${item.listingId}`,
          status: 'ACTIVE',
          views: item.views
        });
      }
    }
    
    // Add listings from marketing campaigns
    for (const item of marketingListings) {
      if (item.listingId && !seenIds.has(item.listingId)) {
        seenIds.add(item.listingId);
        listings.push({
          type: 'marketing',
          itemId: item.listingId,
          listingId: item.listingId,
          title: `Listing ${item.listingId}`,
          status: 'ACTIVE',
          promoted: true
        });
      }
    }
    
    const recentOrders = fulfillmentData.orders?.slice(0, 10).map(order => ({
      orderId: order.orderId,
      creationDate: order.creationDate,
      orderTotal: order.pricingSummary?.total?.value,
      items: order.lineItems?.map(li => ({
        title: li.title,
        sku: li.sku,
        legacyItemId: li.legacyItemId,
        quantity: li.quantity,
        price: li.lineItemCost?.value
      }))
    })) || [];
    
    // Extract sold items from orders to show what's been listed
    const soldItems = [];
    for (const order of (fulfillmentData.orders || [])) {
      for (const li of (order.lineItems || [])) {
        if (li.legacyItemId && !seenIds.has(li.legacyItemId)) {
          seenIds.add(li.legacyItemId);
          soldItems.push({
            type: 'sold',
            itemId: li.legacyItemId,
            listingId: li.legacyItemId,
            title: li.title,
            status: 'SOLD',
            price: li.lineItemCost?.value,
            soldDate: order.creationDate
          });
        }
      }
    }
    
    res.status(200).json({
      success: true,
      username,
      totalListings: listings.length,
      listings,
      soldItems,
      recentOrders,
      raw: {
        inventoryCount: inventoryData.inventoryItems?.length || 0,
        offersCount: offersData.offers?.length || 0,
        analyticsCount: analyticsListings.length,
        marketingCount: marketingListings.length,
        ordersCount: fulfillmentData.orders?.length || 0
      },
      errors: {
        marketing: marketingError
      },
      apiStatus: {
        user: userResponse.status,
        inventory: inventoryResponse.status,
        offers: offersResponse.status,
        fulfillment: fulfillmentResponse.status
      },
      note: listings.length === 0 ? 
        'No listings found via Inventory API. Listings created on eBay website may not appear here. Check your eBay Developer account for API access to Trading API.' : 
        null
    });
    
  } catch (err) {
    console.error('eBay listings error:', err);
    res.status(500).json({ error: err.message });
  }
}
