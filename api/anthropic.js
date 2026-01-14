// Vercel serverless function to proxy Anthropic API requests
// Keeps API key secure on server side

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to Vercel environment variables.' });
    }

    const { messages, system, max_tokens = 1024 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid request body - messages missing or not array');
      return res.status(400).json({ error: 'Messages array required' });
    }

    console.log('Calling Anthropic API with', messages.length, 'messages');
    
    const requestBody = {
      model: 'claude-3-sonnet-20240229',
      max_tokens,
      system: system || 'You are a helpful assistant for a precious metals dealer.',
      messages
    };
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Anthropic API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Anthropic API request failed', 
        status: response.status,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Anthropic API success, response length:', JSON.stringify(data).length);
    return res.status(200).json(data);

  } catch (error) {
    console.error('Anthropic proxy caught error:', error.name, error.message);
    return res.status(500).json({ 
      error: 'Server error in Anthropic proxy', 
      details: error.message,
      type: error.name
    });
  }
}
