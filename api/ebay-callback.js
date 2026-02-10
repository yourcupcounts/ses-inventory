// eBay OAuth Callback Handler
// Exchanges authorization code for access token

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;
  
  // Handle user declining authorization
  if (error) {
    return res.redirect(`/?ebay_error=${encodeURIComponent(error_description || error)}`);
  }
  
  if (!code) {
    return res.redirect('/?ebay_error=No authorization code received');
  }
  
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RUNAME;
  
  if (!clientId || !clientSecret || !ruName) {
    return res.redirect('/?ebay_error=eBay credentials not configured');
  }
  
  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ruName
      }).toString()
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('eBay token error:', tokenData);
      return res.redirect(`/?ebay_error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`);
    }
    
    // Return tokens to frontend via URL params (they'll be stored in localStorage)
    // In production, you'd want to store these server-side in a database
    const params = new URLSearchParams({
      ebay_connected: 'true',
      ebay_access_token: tokenData.access_token,
      ebay_refresh_token: tokenData.refresh_token || '',
      ebay_expires_in: tokenData.expires_in || '7200',
      ebay_token_time: Date.now().toString()
    });
    
    res.redirect(`/?${params.toString()}`);
    
  } catch (err) {
    console.error('eBay callback error:', err);
    res.redirect(`/?ebay_error=${encodeURIComponent(err.message)}`);
  }
}
