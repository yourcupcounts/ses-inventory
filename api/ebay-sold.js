// eBay Sold Listings Search API
// Uses eBay Browse API to get completed/sold listings for accurate market values

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { query, category, minPrice, maxPrice, condition } = req.method === 'POST' ? req.body : req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  const appId = process.env.EBAY_CLIENT_ID;
  const appSecret = process.env.EBAY_CLIENT_SECRET;
  
  if (!appId || !appSecret) {
    return res.status(500).json({ error: 'eBay API credentials not configured' });
  }
  
  try {
    // First, get an OAuth token for Browse API
    const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');
    
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(500).json({ 
        error: 'Failed to get eBay access token',
        details: tokenData
      });
    }
    
    // Build search query - use Browse API search
    // The Browse API searches active listings by default
    // For sold/completed items, we need to use a workaround
    
    // First try: Search for items with specific keywords that suggest completed sales
    // Note: Browse API doesn't have direct "sold only" filter for public use
    // We'll search active listings and also try the marketplace insights approach
    
    const searchParams = new URLSearchParams({
      q: query,
      limit: '50',
      sort: 'price' // Sort by price to get a range
    });
    
    // Add category filter for coins
    if (category) {
      searchParams.append('category_ids', category);
    } else {
      // Default to coins & paper money category for better results
      searchParams.append('category_ids', '11116');
    }
    
    // Add price filters
    const filters = [];
    if (minPrice) filters.push(`price:[${minPrice}..${maxPrice || '*'}]`);
    if (maxPrice && !minPrice) filters.push(`price:[*..${maxPrice}]`);
    if (condition) filters.push(`conditionIds:{${condition}}`);
    
    // Add buying options filter to get more relevant results
    filters.push('buyingOptions:{FIXED_PRICE|AUCTION}');
    
    if (filters.length > 0) {
      searchParams.append('filter', filters.join(','));
    }
    
    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json'
      }
    });
    
    const searchData = await searchResponse.json();
    
    if (!searchResponse.ok) {
      return res.status(200).json({
        success: false,
        error: searchData.errors?.[0]?.message || 'Search failed',
        details: searchData,
        query
      });
    }
    
    const items = searchData.itemSummaries || [];
    
    // Format the results
    const formattedItems = items.map(item => {
      const price = parseFloat(item.price?.value || 0);
      return {
        itemId: item.itemId,
        title: item.title,
        price: price,
        currency: item.price?.currency || 'USD',
        condition: item.condition || 'Unknown',
        imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl,
        itemUrl: item.itemWebUrl,
        listingType: item.buyingOptions?.includes('AUCTION') ? 'Auction' : 'FixedPrice',
        seller: item.seller?.username,
        location: item.itemLocation?.city
      };
    });
    
    // Calculate statistics from active listings
    const prices = formattedItems.map(i => i.price).filter(p => p > 0);
    const stats = {
      count: prices.length,
      totalResults: searchData.total || prices.length,
      avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100 : 0,
      medianPrice: prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0,
      lowPrice: prices.length > 0 ? Math.min(...prices) : 0,
      highPrice: prices.length > 0 ? Math.max(...prices) : 0
    };
    
    // Price distribution
    const priceDistribution = {
      under25: prices.filter(p => p < 25).length,
      from25to50: prices.filter(p => p >= 25 && p < 50).length,
      from50to100: prices.filter(p => p >= 50 && p < 100).length,
      from100to250: prices.filter(p => p >= 100 && p < 250).length,
      over250: prices.filter(p => p >= 250).length
    };
    
    res.status(200).json({
      success: true,
      source: 'active', // Note: This is active listings since Browse API doesn't provide sold data publicly
      query,
      stats,
      priceDistribution,
      items: formattedItems,
      note: 'Prices from current active listings. For sold prices, check eBay directly.',
      searchParams: {
        category,
        minPrice,
        maxPrice,
        condition
      }
    });
    
  } catch (err) {
    console.error('eBay search error:', err);
    res.status(500).json({ error: err.message });
  }
}
