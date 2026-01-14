// eBay Active Listings API
// Fetches seller's current active listings

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
    // Use the Sell Inventory API to get offers (active listings)
    // First, get inventory items
    const inventoryResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=100',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    if (!inventoryResponse.ok) {
      const errorData = await inventoryResponse.json().catch(() => ({}));
      
      // Check if token expired
      if (inventoryResponse.status === 401) {
        return res.status(401).json({ 
          error: 'Token expired', 
          needsRefresh: true,
          details: errorData 
        });
      }
      
      return res.status(inventoryResponse.status).json({ 
        error: 'Failed to fetch inventory',
        details: errorData
      });
    }
    
    const inventoryData = await inventoryResponse.json();
    
    // Also get active listings via Trading API alternative - use Browse API for seller's items
    // Or use getOffers to see what's actually listed
    const offersResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/offer?limit=100',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    let offersData = { offers: [] };
    if (offersResponse.ok) {
      offersData = await offersResponse.json();
    }
    
    // Combine and format the data
    const listings = [];
    
    // Process offers (these are the actual active listings)
    if (offersData.offers && offersData.offers.length > 0) {
      for (const offer of offersData.offers) {
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
          marketplaceId: offer.marketplaceId,
          categoryId: offer.categoryId
        });
      }
    }
    
    // Process inventory items and match with offers
    if (inventoryData.inventoryItems && inventoryData.inventoryItems.length > 0) {
      for (const item of inventoryData.inventoryItems) {
        // Check if we already have this SKU from offers
        const existingOffer = listings.find(l => l.sku === item.sku);
        
        if (existingOffer) {
          // Enhance with inventory data
          existingOffer.title = item.product?.title;
          existingOffer.description = item.product?.description;
          existingOffer.imageUrls = item.product?.imageUrls;
          existingOffer.condition = item.condition;
          existingOffer.conditionDescription = item.conditionDescription;
        } else {
          // Inventory item without an active offer
          listings.push({
            type: 'inventory',
            sku: item.sku,
            title: item.product?.title,
            description: item.product?.description,
            imageUrls: item.product?.imageUrls,
            condition: item.condition,
            conditionDescription: item.conditionDescription,
            quantity: item.availability?.shipToLocationAvailability?.quantity,
            status: 'NOT_LISTED'
          });
        }
      }
    }
    
    // If no inventory items found, try the Sell Feed API or Trading API as fallback
    // For now, also try to get selling summary
    let sellingSummary = null;
    try {
      const summaryResponse = await fetch(
        'https://api.ebay.com/sell/analytics/v1/seller_standards_profile?marketplace_id=EBAY_US',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
      if (summaryResponse.ok) {
        sellingSummary = await summaryResponse.json();
      }
    } catch (e) {
      // Analytics optional
    }
    
    res.status(200).json({
      success: true,
      totalListings: listings.length,
      listings,
      sellingSummary,
      raw: {
        inventoryCount: inventoryData.inventoryItems?.length || 0,
        offersCount: offersData.offers?.length || 0
      }
    });
    
  } catch (err) {
    console.error('eBay listings error:', err);
    res.status(500).json({ error: err.message });
  }
}
