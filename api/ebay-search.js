// Vercel serverless function to proxy eBay API requests (avoids CORS)

const EBAY_CONFIG = {
  appId: "SethStev-SESInven-PRD-9b467ee89-f21e0627",
  certId: "PRD-b467ee899249-ec3d-43db-89b3-cd88",
};

let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${EBAY_CONFIG.appId}:${EBAY_CONFIG.certId}`).toString('base64');
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token request failed: ${error}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000);
  
  return cachedToken;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const token = await getAccessToken();

    const params = new URLSearchParams({
      q: query,
      filter: 'buyingOptions:{FIXED_PRICE|AUCTION},priceCurrency:USD',
      sort: 'price',
      limit: limit.toString()
    });

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`eBay search failed: ${error}`);
    }

    const data = await response.json();
    
    // Parse results
    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      return res.status(200).json({ items: [], avgPrice: 0, lowPrice: 0, highPrice: 0, count: 0 });
    }

    const prices = data.itemSummaries
      .map(item => parseFloat(item.price?.value || 0))
      .filter(price => price > 0);

    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const lowPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const highPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const result = {
      items: data.itemSummaries.map(item => ({
        title: item.title,
        price: parseFloat(item.price?.value || 0),
        condition: item.condition,
        imageUrl: item.image?.imageUrl,
        itemUrl: item.itemWebUrl
      })),
      avgPrice: Math.round(avgPrice * 100) / 100,
      lowPrice: Math.round(lowPrice * 100) / 100,
      highPrice: Math.round(highPrice * 100) / 100,
      count: prices.length
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('eBay API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
