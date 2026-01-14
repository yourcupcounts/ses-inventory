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
    
    // Try inventory count
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
    
    // Try active listings via offers
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
      fulfillment: fulfillmentInfo,
      debug: {
        userStatus: userResponse.status,
        accountStatus: accountResponse.status,
        inventoryStatus: inventoryResponse.status,
        offersStatus: offersResponse.status,
        fulfillmentStatus: fulfillmentResponse.status
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
