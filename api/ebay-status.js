// eBay Debug/Status Endpoint
// Shows connection status and account info

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get access token from request header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(200).json({ 
      connected: false,
      error: 'No token provided'
    });
  }
  
  const accessToken = authHeader.replace('Bearer ', '');
  
  try {
    // Try to get user info
    const userResponse = await fetch(
      'https://apiz.ebay.com/commerce/identity/v1/user/',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let userData = null;
    if (userResponse.ok) {
      userData = await userResponse.json();
    }
    
    // Also try to get account info
    const accountResponse = await fetch(
      'https://api.ebay.com/sell/account/v1/privilege',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let accountData = null;
    if (accountResponse.ok) {
      accountData = await accountResponse.json();
    }
    
    // Try inventory count (Inventory API - for API-created listings)
    const inventoryResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let inventoryInfo = null;
    let inventoryError = null;
    if (inventoryResponse.ok) {
      const invData = await inventoryResponse.json();
      inventoryInfo = {
        total: invData.total || invData.inventoryItems?.length || 0,
        hasItems: (invData.inventoryItems?.length || 0) > 0
      };
    } else {
      inventoryError = await inventoryResponse.json().catch(() => ({ error: 'Unknown error' }));
    }
    
    // Try active listings via offers (Inventory API)
    const offersResponse = await fetch(
      'https://api.ebay.com/sell/inventory/v1/offer?limit=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let offersInfo = null;
    let offersError = null;
    if (offersResponse.ok) {
      const offData = await offersResponse.json();
      offersInfo = {
        total: offData.total || offData.offers?.length || 0,
        hasOffers: (offData.offers?.length || 0) > 0
      };
    } else {
      offersError = await offersResponse.json().catch(() => ({ error: 'Unknown error' }));
    }
    
    // *** KEY: Use Sell Marketing API or Browse API to get ALL active listings ***
    // The Trading API GetMyeBaySelling shows all listings regardless of how they were created
    // But we need to use the newer REST API - try sell/inventory/v1/bulk_get_inventory_item
    
    // Try the Sell Feed API - getItemFeed for active listings
    // Actually, let's try the findingAPI approach or the Browse API
    
    // Get seller's active listings using Marketing API
    let activeListingsInfo = null;
    let activeListingsError = null;
    
    // Try the Sell Analytics API which shows all listings
    const analyticsResponse = await fetch(
      'https://api.ebay.com/sell/analytics/v1/traffic_report?dimension=LISTING&metric=LISTING_VIEWS_TOTAL&filter=marketplace_id:{EBAY_US}',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let analyticsInfo = null;
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      analyticsInfo = {
        listingsWithViews: analyticsData.dimensionMetrics?.length || 0
      };
    }
    
    // Try Browse API to search seller's own items (if we have username)
    if (userData?.username) {
      try {
        const browseResponse = await fetch(
          `https://api.ebay.com/buy/browse/v1/item_summary/search?q=*&filter=sellers:{${userData.username}}&limit=50`,
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
          activeListingsInfo = {
            total: browseData.total || browseData.itemSummaries?.length || 0,
            items: browseData.itemSummaries?.slice(0, 10).map(item => ({
              itemId: item.itemId,
              title: item.title,
              price: item.price?.value,
              currency: item.price?.currency,
              image: item.image?.imageUrl,
              condition: item.condition,
              itemWebUrl: item.itemWebUrl
            }))
          };
        } else {
          const browseErr = await browseResponse.json().catch(() => ({}));
          activeListingsError = {
            status: browseResponse.status,
            ...browseErr
          };
        }
      } catch (browseErr) {
        activeListingsError = { message: browseErr.message };
      }
    }
    
    // Try fulfillment API to see recent orders
    const fulfillmentResponse = await fetch(
      'https://api.ebay.com/sell/fulfillment/v1/order?limit=5',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    let fulfillmentInfo = null;
    if (fulfillmentResponse.ok) {
      const fulData = await fulfillmentResponse.json();
      fulfillmentInfo = {
        total: fulData.total || fulData.orders?.length || 0,
        hasOrders: (fulData.orders?.length || 0) > 0,
        recentOrders: fulData.orders?.slice(0, 3).map(o => ({
          orderId: o.orderId,
          date: o.creationDate,
          total: o.pricingSummary?.total?.value
        }))
      };
    }
    
    res.status(200).json({
      connected: true,
      tokenValid: true,
      user: userData ? {
        username: userData.username,
        userId: userData.userId,
        accountType: userData.accountType,
        registrationMarketplaceId: userData.registrationMarketplaceId
      } : null,
      account: accountData,
      inventory: inventoryInfo,
      inventoryError,
      offers: offersInfo,
      offersError,
      activeListings: activeListingsInfo,
      activeListingsError,
      analytics: analyticsInfo,
      fulfillment: fulfillmentInfo,
      debug: {
        userStatus: userResponse.status,
        accountStatus: accountResponse.status,
        inventoryStatus: inventoryResponse.status,
        offersStatus: offersResponse.status,
        fulfillmentStatus: fulfillmentResponse.status,
        analyticsStatus: analyticsResponse.status
      }
    });
    
  } catch (err) {
    console.error('eBay debug error:', err);
    res.status(200).json({ 
      connected: false,
      error: err.message 
    });
  }
}
