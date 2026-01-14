// Vercel serverless function to proxy eBay API requests (avoids CORS)

const EBAY_CONFIG = {
  appId: "SethStev-SESInven-PRD-9b467ee89-f21e0627",
  certId: "PRD-b467ee899249-ec3d-43db-89b3-cd88",
};

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

export default async function handler(req, res) {
  // Set CORS headers
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

    // Use eBay Finding API - findCompletedItems for sold listings
    const findingApiUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
    
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': EBAY_CONFIG.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': query,
      'paginationInput.entriesPerPage': Math.min(parseInt(limit), 100).toString(),
      'sortOrder': 'EndTimeSoonest',
      // Filter for sold items only (not unsold completed)
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      // US only
      'itemFilter(1).name': 'LocatedIn',
      'itemFilter(1).value': 'US',
    });

    const response = await fetch(`${findingApiUrl}?${params}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`eBay Finding API failed: ${error}`);
    }

    const data = await response.json();
    
    // Parse Finding API response
    const searchResult = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
    const items = searchResult?.item || [];
    const totalCount = parseInt(searchResult?.['@count'] || '0');

    if (items.length === 0) {
      return res.status(200).json({ 
        items: [], 
        avgPrice: 0, 
        lowPrice: 0, 
        highPrice: 0, 
        count: 0,
        note: 'No sold listings found'
      });
    }

    // Extract prices from sold items
    const parsedItems = items.map(item => {
      const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0);
      const endTime = item.listingInfo?.[0]?.endTime?.[0];
      const itemUrl = item.viewItemURL?.[0];
      const imageUrl = item.galleryURL?.[0];
      const title = item.title?.[0];
      const listingType = item.listingInfo?.[0]?.listingType?.[0];
      const itemId = item.itemId?.[0];
      
      return {
        title,
        price,
        soldDate: formatDate(endTime),
        itemUrl,
        shortUrl: shortenUrl(itemUrl),
        imageUrl,
        listingType: listingType === 'Auction' ? 'Auction' : 'BIN',
        itemId,
        condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'Used',
        status: 'Sold'
      };
    }).filter(item => item.price > 0);

    const prices = parsedItems.map(item => item.price);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const lowPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const highPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const result = {
      items: parsedItems.slice(0, parseInt(limit)),
      avgPrice: Math.round(avgPrice * 100) / 100,
      lowPrice: Math.round(lowPrice * 100) / 100,
      highPrice: Math.round(highPrice * 100) / 100,
      count: parsedItems.length,
      note: 'Recent completed/sold listings'
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('eBay API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
