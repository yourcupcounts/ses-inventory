// Vercel serverless function to proxy eBay API requests (avoids CORS)

const EBAY_CONFIG = {
  appId: "SethStev-SESInven-PRD-9b467ee89-f21e0627",
  certId: "PRD-b467ee899249-ec3d-43db-89b3-cd88",
};

let cachedToken = null;
let tokenExpiry = null;

// Get OAuth token for Browse API
async function getAccessToken() {
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
    throw new Error('Token request failed');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000);
  
  return cachedToken;
}

// Format date to readable string
function formatDate(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

// Shorten eBay URL
function shortenUrl(url) {
  if (!url) return null;
  const match = url.match(/\/itm\/([^?]+)/);
  if (match) {
    return `ebay.com/itm/${match[1]}`;
  }
  return url;
}

// Try Finding API for sold listings
async function tryFindingApi(query, limit) {
  const findingApiUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
  
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_CONFIG.appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': query,
    'paginationInput.entriesPerPage': Math.min(parseInt(limit), 50).toString(),
    'sortOrder': 'EndTimeSoonest',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'LocatedIn',
    'itemFilter(1).value': 'US',
  });

  const response = await fetch(`${findingApiUrl}?${params}`);
  
  if (!response.ok) {
    throw new Error('Finding API request failed');
  }

  const data = await response.json();
  
  // Check for API errors
  if (data?.findCompletedItemsResponse?.[0]?.errorMessage) {
    throw new Error('Finding API rate limited');
  }
  
  const searchResult = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
  const items = searchResult?.item || [];

  if (items.length === 0) {
    return null;
  }

  const parsedItems = items.map(item => {
    const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0);
    const endTime = item.listingInfo?.[0]?.endTime?.[0];
    const itemUrl = item.viewItemURL?.[0];
    const imageUrl = item.galleryURL?.[0];
    const title = item.title?.[0];
    const listingType = item.listingInfo?.[0]?.listingType?.[0];
    
    return {
      title,
      price,
      soldDate: formatDate(endTime),
      itemUrl,
      shortUrl: shortenUrl(itemUrl),
      imageUrl,
      listingType: listingType === 'Auction' ? 'Auction' : 'BIN',
      condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'Used',
      status: 'Sold'
    };
  }).filter(item => item.price > 0);

  return { items: parsedItems, source: 'sold' };
}

// Fallback to Browse API for active listings
async function tryBrowseApi(query, limit) {
  const token = await getAccessToken();
  
  const params = new URLSearchParams({
    q: query,
    filter: 'priceCurrency:USD,itemLocationCountry:US',
    sort: 'price',
    limit: Math.max(parseInt(limit), 15).toString()
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
    throw new Error('Browse API request failed');
  }

  const data = await response.json();
  
  if (!data.itemSummaries || data.itemSummaries.length === 0) {
    return null;
  }

  const parsedItems = data.itemSummaries.map(item => ({
    title: item.title,
    price: parseFloat(item.price?.value || 0),
    itemUrl: item.itemWebUrl,
    shortUrl: shortenUrl(item.itemWebUrl),
    imageUrl: item.image?.imageUrl,
    listingType: item.buyingOptions?.includes('AUCTION') ? 'Auction' : 'BIN',
    condition: item.condition,
    status: 'Active'
  })).filter(item => item.price > 0);

  return { items: parsedItems, source: 'active' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { query, limit = 15 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    let result = null;
    let source = 'none';

    // Try Finding API first (for sold listings)
    try {
      result = await tryFindingApi(query, limit);
      if (result) source = 'sold';
    } catch (e) {
      console.log('Finding API failed, trying Browse API:', e.message);
    }

    // Fallback to Browse API (for active listings)
    if (!result) {
      try {
        result = await tryBrowseApi(query, limit);
        if (result) source = 'active';
      } catch (e) {
        console.log('Browse API also failed:', e.message);
      }
    }

    if (!result || result.items.length === 0) {
      return res.status(200).json({ 
        items: [], 
        avgPrice: 0, 
        lowPrice: 0, 
        highPrice: 0, 
        count: 0,
        source: 'none',
        note: 'No listings found'
      });
    }

    const prices = result.items.map(item => item.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const lowPrice = Math.min(...prices);
    const highPrice = Math.max(...prices);

    return res.status(200).json({
      items: result.items.slice(0, parseInt(limit)),
      avgPrice: Math.round(avgPrice * 100) / 100,
      lowPrice: Math.round(lowPrice * 100) / 100,
      highPrice: Math.round(highPrice * 100) / 100,
      count: result.items.length,
      source: source,
      note: source === 'sold' ? 'Recent sold listings' : 'Active listings (sold data temporarily unavailable)'
    });

  } catch (error) {
    console.error('eBay API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
