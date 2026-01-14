// eBay OAuth Authorization Endpoint
// Redirects user to eBay for consent

export default function handler(req, res) {
  const clientId = process.env.EBAY_CLIENT_ID;
  const ruName = process.env.EBAY_RUNAME;
  
  if (!clientId || !ruName) {
    return res.status(500).json({ error: 'eBay credentials not configured' });
  }
  
  // Scopes we need for inventory access
  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly'
  ].join(' ');
  
  // Build eBay authorization URL
  const authUrl = new URL('https://auth.ebay.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', ruName);
  authUrl.searchParams.set('scope', scopes);
  
  // Redirect to eBay
  res.redirect(authUrl.toString());
}
