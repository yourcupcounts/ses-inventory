// eBay Sold Listings Search API
// Uses eBay Finding API to get completed/sold listings for accurate market values

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { query, category, minPrice, maxPrice, condition, daysBack = 90 } = req.method === 'POST' ? req.body : req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  const appId = process.env.EBAY_CLIENT_ID;
  
  if (!appId) {
    return res.status(500).json({ error: 'eBay API credentials not configured' });
  }
  
  try {
    // Build the Finding API request
    // findCompletedItems returns sold AND unsold ended listings
    // We filter for sold only using SoldItemsOnly=true
    
    const baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
    
    // Build item filters
    const itemFilters = [
      { name: 'SoldItemsOnly', value: 'true' },
      { name: 'ListingType', value: ['FixedPrice', 'Auction', 'AuctionWithBIN'] }
    ];
    
    // Add date filter (last X days)
    if (daysBack) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(daysBack));
      itemFilters.push({
        name: 'EndTimeFrom',
        value: startDate.toISOString()
      });
    }
    
    // Add price filters if specified
    if (minPrice) {
      itemFilters.push({ name: 'MinPrice', value: minPrice, paramName: 'Currency', paramValue: 'USD' });
    }
    if (maxPrice) {
      itemFilters.push({ name: 'MaxPrice', value: maxPrice, paramName: 'Currency', paramValue: 'USD' });
    }
    
    // Add condition filter if specified
    if (condition) {
      itemFilters.push({ name: 'Condition', value: condition });
    }
    
    // Build URL parameters
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': query,
      'paginationInput.entriesPerPage': '50',
      'sortOrder': 'EndTimeSoonest'
    });
    
    // Add category if specified (coins & paper money = 11116)
    if (category) {
      params.append('categoryId', category);
    }
    
    // Add item filters
    itemFilters.forEach((filter, index) => {
      params.append(`itemFilter(${index}).name`, filter.name);
      if (Array.isArray(filter.value)) {
        filter.value.forEach((v, vi) => {
          params.append(`itemFilter(${index}).value(${vi})`, v);
        });
      } else {
        params.append(`itemFilter(${index}).value`, filter.value);
      }
      if (filter.paramName) {
        params.append(`itemFilter(${index}).paramName`, filter.paramName);
        params.append(`itemFilter(${index}).paramValue`, filter.paramValue);
      }
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Parse the response
    const searchResult = data.findCompletedItemsResponse?.[0]?.searchResult?.[0];
    const items = searchResult?.item || [];
    const totalResults = parseInt(searchResult?.['@count'] || '0');
    
    // Extract and format sold items
    const soldItems = items.map(item => {
      const sellingStatus = item.sellingStatus?.[0];
      const listingInfo = item.listingInfo?.[0];
      const condition = item.condition?.[0];
      
      return {
        itemId: item.itemId?.[0],
        title: item.title?.[0],
        price: parseFloat(sellingStatus?.currentPrice?.[0]?.__value__ || 0),
        currency: sellingStatus?.currentPrice?.[0]?.['@currencyId'] || 'USD',
        soldDate: listingInfo?.endTime?.[0],
        listingType: listingInfo?.listingType?.[0],
        bidCount: parseInt(sellingStatus?.bidCount?.[0] || '0'),
        condition: condition?.conditionDisplayName?.[0] || 'Unknown',
        imageUrl: item.galleryURL?.[0],
        itemUrl: item.viewItemURL?.[0],
        sellerUsername: item.sellerInfo?.[0]?.sellerUserName?.[0],
        sellerFeedback: parseInt(item.sellerInfo?.[0]?.feedbackScore?.[0] || '0'),
        shippingCost: parseFloat(item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || 0),
        location: item.location?.[0]
      };
    });
    
    // Calculate statistics
    const prices = soldItems.map(i => i.price).filter(p => p > 0);
    const stats = {
      count: prices.length,
      totalResults,
      avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100 : 0,
      medianPrice: prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0,
      lowPrice: prices.length > 0 ? Math.min(...prices) : 0,
      highPrice: prices.length > 0 ? Math.max(...prices) : 0,
      priceRange: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0
    };
    
    // Group by price ranges for analysis
    const priceDistribution = {
      under25: prices.filter(p => p < 25).length,
      from25to50: prices.filter(p => p >= 25 && p < 50).length,
      from50to100: prices.filter(p => p >= 50 && p < 100).length,
      from100to250: prices.filter(p => p >= 100 && p < 250).length,
      over250: prices.filter(p => p >= 250).length
    };
    
    res.status(200).json({
      success: true,
      query,
      stats,
      priceDistribution,
      items: soldItems,
      searchParams: {
        daysBack,
        category,
        minPrice,
        maxPrice,
        condition
      }
    });
    
  } catch (err) {
    console.error('eBay sold search error:', err);
    res.status(500).json({ error: err.message });
  }
}
