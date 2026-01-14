// Vercel Serverless Function - Fetches spot prices server-side (no CORS issues)
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    // Try metals.live first
    const response = await fetch('https://api.metals.live/v1/spot');
    
    if (response.ok) {
      const data = await response.json();
      
      const prices = {
        gold: null,
        silver: null,
        platinum: null,
        palladium: null,
        source: 'metals.live',
        timestamp: new Date().toISOString()
      };
      
      // Parse the array response
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.gold) prices.gold = item.gold;
          if (item.silver) prices.silver = item.silver;
          if (item.platinum) prices.platinum = item.platinum;
          if (item.palladium) prices.palladium = item.palladium;
        });
      }
      
      return res.status(200).json(prices);
    }
    
    throw new Error('Primary API failed');
  } catch (error) {
    // Return fallback prices if API fails
    return res.status(200).json({
      gold: 2685.50,
      silver: 30.25,
      platinum: 985.00,
      palladium: 945.00,
      source: 'fallback',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
