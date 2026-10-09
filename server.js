require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '24kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const products = [
  { id: 'headphones', name: 'Studio Wireless Headphones', category: 'Audio', price: 129, description: 'Balanced sound and 40-hour battery life for commutes or long work sessions.', tags: ['music', 'audio', 'travel', 'wireless', 'headphones'], emoji: '🎧', color: '#e8e6fa' },
  { id: 'desk-lamp', name: 'Halo Desk Lamp', category: 'Workspace', price: 58, description: 'Warm dimmable light with a built-in wireless charger.', tags: ['desk', 'work', 'home', 'light', 'lamp', 'charging'], emoji: '💡', color: '#fff0d4' },
  { id: 'weekender', name: 'Everyday Weekender', category: 'Travel', price: 84, description: 'A lightweight carry-on bag for a quick getaway.', tags: ['travel', 'bag', 'weekend', 'carry-on', 'trip'], emoji: '🧳', color: '#e1f1e6' },
  { id: 'pour-over', name: 'Ceramic Pour-Over Set', category: 'Home', price: 42, description: 'A handmade dripper and server for a slower morning ritual.', tags: ['coffee', 'home', 'kitchen', 'gift', 'morning'], emoji: '☕', color: '#f7e6de' },
  { id: 'keyboard', name: 'Low-Profile Mechanical Keyboard', category: 'Workspace', price: 96, description: 'Quiet tactile keys in a compact, clean design.', tags: ['desk', 'work', 'keyboard', 'tech', 'typing'], emoji: '⌨️', color: '#e1eff2' },
  { id: 'bottle', name: 'Insulated Trail Bottle', category: 'Outdoors', price: 34, description: 'Keeps drinks cold for 24 hours without the bulk.', tags: ['outdoors', 'travel', 'fitness', 'bottle', 'hiking'], emoji: '🧴', color: '#e6efd9' },
  { id: 'speaker', name: 'Pocket Bluetooth Speaker', category: 'Audio', price: 72, description: 'Room-filling sound in a splash-resistant little package.', tags: ['music', 'audio', 'travel', 'speaker', 'outdoors'], emoji: '🔊', color: '#f8e3eb' },
  { id: 'notebooks', name: 'Field Notes Journal Set', category: 'Workspace', price: 24, description: 'Three durable notebooks for plans, sketches, and ideas.', tags: ['desk', 'work', 'writing', 'gift', 'journal'], emoji: '📓', color: '#f3ecd9' }
];

function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
function paypalBase() {
  return (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');
}

function channel3Configured() {
  return Boolean(process.env.CHANNEL3_API_KEY);
}
async function searchChannel3Products(query) {
  const filters = { availability: ['InStock'] };
  const budgetMatch = query.match(/\b(?:under|below|up to|less than)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  if (budgetMatch) filters.price = { max_price: Number(budgetMatch[1]) };

  const response = await fetch('https://api.trychannel3.com/v1/search', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CHANNEL3_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: query.slice(0, 300), filters, limit: 8 }),
    signal: AbortSignal.timeout(12000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Channel3 product search failed.');

  const source = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);
  return source.map(product => {
    const images = Array.isArray(product.images) ? product.images : [];
    const image = images.find(item => item && item.is_main_image) || images[0] || {};
    let imageUrl = image.cleaned_url || image.url || '';
    try {
      if (new URL(imageUrl).protocol !== 'https:') imageUrl = '';
    } catch (_error) {
      imageUrl = '';
    }
    const offers = (Array.isArray(product.offers) ? product.offers : [])
      .filter(offer => {
        if (!offer || typeof offer.url !== 'string' || !offer.price) return false;
        const amount = Number(offer.price.amount);
        if (!Number.isFinite(amount) || amount < 0 || String(offer.availability || '').toLowerCase() === 'outofstock') return false;
        try {
          return new URL(offer.url).protocol === 'https:';
        } catch (_error) {
          return false;
        }
      })
      .map(offer => ({
        url: offer.url,
        domain: String(offer.domain || 'Retailer').slice(0, 80),
        amount: Number(offer.price.amount),
        currency: String(offer.price.currency || 'USD').toUpperCase(),
        availability: String(offer.availability || 'InStock'),
        commissionRate: Number(offer.max_commission_rate) || 0
      }))
      .sort((a, b) => (a.currency === 'USD' ? 0 : 1) - (b.currency === 'USD' ? 0 : 1) || a.amount - b.amount)
      .slice(0, 3);
    return {
      id: String(product.id || '').slice(0, 100),
      title: String(product.title || 'Product').slice(0, 180),
      description: String(product.description || '').slice(0, 280),
      brand: (Array.isArray(product.brands) ? product.brands : []).map(item => item && item.name).filter(Boolean).slice(0, 3).join(', '),
      category: String(product.category && product.category.title || '').slice(0, 80),
      imageUrl,
      offers
    };
  }).filter(product => product.id && product.offers.length);
}
async function getPaypalToken() {
  const auth = Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');
  const response = await fetch(paypalBase() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'PayPal sandbox authentication failed.');
  return data.access_token;
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/config', (_req, res) => {
  res.json({ paypalClientId: process.env.PAYPAL_CLIENT_ID || '', aiConfigured: Boolean(process.env.OPENAI_API_KEY), channel3Configured: channel3Configured() });
});
app.get('/api/products', (_req, res) => res.json(products));

app.post('/api/assistant', async (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 1000);
  const budget = Number(req.body.budget);
  if (!message) return res.status(400).json({ error: 'Tell me what you are looking for first.' });

  let channel3Products = [];
  if (channel3Configured()) {
    try {
      channel3Products = await searchChannel3Products(message);
    } catch (error) {
      console.error('Channel3 product search:', error.message);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const curatedCatalog = products.map(product => ({ id: product.id, name: product.name, category: product.category, price: product.price, description: product.description }));
      const liveCatalog = channel3Products.map(product => ({
        id: product.id,
        title: product.title,
        brand: product.brand,
        offers: product.offers.map(offer => ({ retailer: offer.domain, amount: offer.amount, currency: offer.currency }))
      }));
      const prompt = [
        'You are PayPilot, a concise and thoughtful shopping assistant.',
        'Recommend only products from these two lists. Curated PayPilot products: ' + JSON.stringify(curatedCatalog),
        'Live Channel3 products and retailer offers: ' + JSON.stringify(liveCatalog),
        'Respect the shopper budget if one is supplied. Explain briefly why the picks fit.',
        'Never claim to purchase, place an order, or handle payment. Ask one short question if you cannot make a sensible match.',
        'Return JSON only with keys reply (string), productIds (array of PayPilot catalog IDs), and channel3Ids (array of Channel3 product IDs). Return no more than 3 IDs in either array.'
      ].join(' ');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.35,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: prompt }, { role: 'user', content: message + (Number.isFinite(budget) && budget > 0 ? ' Budget: $' + budget + '.' : '') }]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error && data.error.message || 'AI recommendations are temporarily unavailable.');
      const parsed = JSON.parse(data.choices[0].message.content);
      const allowed = new Set(products.map(product => product.id));
      const allowedChannel3 = new Set(channel3Products.map(product => product.id));
      return res.json({
        reply: String(parsed.reply || 'I found a few options to explore.'),
        productIds: (Array.isArray(parsed.productIds) ? parsed.productIds : []).filter(id => allowed.has(id)).slice(0, 3),
        channel3Ids: (Array.isArray(parsed.channel3Ids) ? parsed.channel3Ids : []).filter(id => allowedChannel3.has(id)).slice(0, 3),
        channel3Products,
        source: 'ai'
      });
    } catch (error) {
      console.error('AI recommendation fallback:', error.message);
    }
  }

  const words = message.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const matches = products.map(product => {
    const score = product.tags.reduce((total, tag) => total + (words.some(word => word.includes(tag) || tag.includes(word)) ? 1 : 0), 0)
      + (words.some(word => product.category.toLowerCase().includes(word)) ? 1 : 0);
    return { product, score };
  }).filter(item => item.score && (!Number.isFinite(budget) || budget <= 0 || item.product.price <= budget))
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price).slice(0, 3);
  res.json({
    reply: matches.length
      ? 'I matched a few options to your request. Take a look and add only what feels right.' + (channel3Products.length ? ' I also found live retailer options below.' : '')
      : 'I do not see a close match in this small collection yet. Try audio, coffee, travel, outdoors, or workspace.' + (channel3Products.length ? ' I also found live retailer options below.' : ''),
    productIds: matches.map(item => item.product.id),
    channel3Ids: [],
    channel3Products,
    source: 'catalog'
  });
});

app.post('/api/paypal/create-order', async (req, res) => {
  if (!paypalConfigured()) return res.status(503).json({ error: 'Add PayPal sandbox credentials to the server environment to enable checkout.' });
  const requested = Array.isArray(req.body.items) ? req.body.items : [];
  const lines = requested.map(line => {
    const product = products.find(item => item.id === line.id);
    const quantity = Math.max(1, Math.min(10, Math.floor(Number(line.quantity) || 1)));
    return product ? { product, quantity } : null;
  }).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: 'Your bag is empty.' });
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  if (total > 10000) return res.status(400).json({ error: 'The demo checkout limit is $10,000.' });

  try {
    const token = await getPaypalToken();
    const response = await fetch(paypalBase() + '/v2/checkout/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: total.toFixed(2),
            breakdown: { item_total: { currency_code: 'USD', value: total.toFixed(2) } }
          },
          items: lines.map(line => ({
            name: line.product.name,
            quantity: String(line.quantity),
            unit_amount: { currency_code: 'USD', value: line.product.price.toFixed(2) }
          }))
        }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'PayPal could not create the order.');
    res.json({ id: data.id });
  } catch (error) {
    console.error('PayPal order creation:', error.message);
    res.status(502).json({ error: error.message });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  if (!paypalConfigured()) return res.status(503).json({ error: 'PayPal sandbox is not configured.' });
  const orderID = String(req.body.orderID || '').trim();
  if (!/^[A-Z0-9-]{8,80}$/i.test(orderID)) return res.status(400).json({ error: 'Invalid PayPal order ID.' });
  try {
    const token = await getPaypalToken();
    const response = await fetch(paypalBase() + '/v2/checkout/orders/' + encodeURIComponent(orderID) + '/capture', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'PayPal could not capture the approved order.');
    res.json({ id: data.id, status: data.status, payer: data.payer && data.payer.name && data.payer.name.given_name || '' });
  } catch (error) {
    console.error('PayPal order capture:', error.message);
    res.status(502).json({ error: error.message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => console.log('PayPilot listening on port ' + port));