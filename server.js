import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { KiteConnect } from 'kiteconnect';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFiles = [path.resolve(__dirname, '.env'), path.resolve(__dirname, '..', '.env')];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: true });
  }
}

const app = express();
const port = process.env.PORT || 3102;

let kiteState = {
  apiKey: process.env.KITE_API_KEY?.trim() || '',
  apiSecret: process.env.KITE_API_SECRET?.trim() || '',
  accessToken: process.env.KITE_ACCESS_TOKEN?.trim() || '',
  requestToken: process.env.KITE_REQUEST_TOKEN?.trim() || ''
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/kite/status', (_req, res) => {
  res.json({ connected: Boolean(kiteState.accessToken), apiKeyConfigured: Boolean(kiteState.apiKey) });
});

app.get('/api/quote', async (req, res) => {
  const symbol = String(req.query.symbol || 'RELIANCE').trim().toUpperCase();
  const kiteAccessToken = kiteState.accessToken || process.env.KITE_ACCESS_TOKEN?.trim();
  const kiteApiKey = kiteState.apiKey || process.env.KITE_API_KEY?.trim();

  if (!kiteApiKey || !kiteAccessToken) {
    return res.status(401).json({ error: 'Kite is not connected yet.' });
  }

  try {
    const kite = new KiteConnect({ api_key: kiteApiKey });
    kite.setAccessToken(kiteAccessToken);
    const instrument = normalizeKiteInstrument(symbol);
    const quote = await kite.getQuote([instrument]);
    const quoteData = quote?.[instrument] ?? quote?.[symbol] ?? null;
    const price = quoteData?.last_price ?? quoteData?.ohlc?.close ?? null;
    res.json({ symbol: instrument, price });
  } catch (error) {
    // Detect common permission or token errors and return clearer status codes/messages
    const errMsg = (error && (error.response?.data?.message || error.message)) || 'Unable to fetch quote.';
    const statusCode = error?.response?.status || (errMsg && /permission|forbidden|not authorized/i.test(errMsg) ? 403 : 500);

    if (/permission|forbidden|insufficient permission/i.test(errMsg)) {
      return res.status(403).json({ error: 'Insufficient permission to fetch quote. Reconnect with a token that has quote permissions.' });
    }

    if (/invalid|incorrect|token/i.test(errMsg) || statusCode === 401) {
      return res.status(401).json({ error: 'Invalid or expired Kite access token. Please reconnect.' });
    }

    res.status(statusCode).json({ error: errMsg });
  }
});

app.post('/api/kite/login-url', (req, res) => {
  const { apiKey, username, password } = req.body;
  const resolvedApiKey = (apiKey || kiteState.apiKey || process.env.KITE_API_KEY || '').trim();
  const resolvedUsername = String(username || '').trim();
  const resolvedPassword = String(password || '').trim();

  if (!resolvedApiKey) {
    return res.status(400).json({ error: 'Provide your Kite API key first.' });
  }

  const callbackUrl = `${req.protocol}://${req.get('host')}/api/kite/callback`;
  const loginUrl = `/api/kite/login?api_key=${encodeURIComponent(resolvedApiKey)}&username=${encodeURIComponent(resolvedUsername)}&password=${encodeURIComponent(resolvedPassword)}&redirect_url=${encodeURIComponent(callbackUrl)}`;
  res.json({ loginUrl });
});

app.get('/api/kite/login', (req, res) => {
  const apiKey = String(req.query.api_key || '').trim();
  const username = String(req.query.username || '').trim();
  const password = String(req.query.password || '').trim();
  const redirectUrl = String(req.query.redirect_url || `${req.protocol}://${req.get('host')}/api/kite/callback`).trim();

  if (!apiKey) {
    return res.status(400).send('Missing Kite API key.');
  }
  // Build Kite login URL with query params and redirect using GET (some endpoints reject POST)
  const kiteUrl = new URL('https://kite.zerodha.com/connect/login');
  kiteUrl.searchParams.set('v', '3');
  kiteUrl.searchParams.set('api_key', apiKey);
  kiteUrl.searchParams.set('redirect_url', redirectUrl);
  if (username) kiteUrl.searchParams.set('user_id', username);
  if (password) kiteUrl.searchParams.set('password', password);

  const html = `<!doctype html>
<html>
  <body>
    <p>Redirecting to Kite login...</p>
    <script>
      window.location.href = ${JSON.stringify(kiteUrl.toString())};
    </script>
  </body>
</html>`;

  res.type('html').send(html);
});

app.get('/api/kite/callback', (req, res) => {
  const requestToken = String(req.query.request_token || req.query.requestToken || req.query.token || req.body.request_token || req.body.requestToken || req.body.token || '').trim();
  console.log('Kite callback received. method=', req.method, 'query=', req.query, 'body=', req.body);
  if (requestToken) {
    kiteState.requestToken = requestToken;
  }

  const payload = JSON.stringify({ type: 'kite-auth-success', requestToken });
  const html = `<!doctype html>
<html>
  <body>
    <p>Received request token: <strong>${requestToken || 'none'}</strong></p>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(${payload}, window.location.origin);
        } else {
          console.log('No window.opener present.');
        }
      } catch (error) {
        console.error(error);
      }
      // Also update the location so token appears in URL for debugging
      try {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('request_token') && ${requestToken ? 'true' : 'false'}) {
          params.set('request_token', '${requestToken}');
          const newUrl = window.location.origin + window.location.pathname + '?' + params.toString();
          history.replaceState({}, '', newUrl);
        }
      } catch (e) {
        console.error(e);
      }
      // allow user to close manually if auto-close prevented
      setTimeout(() => { try { window.close(); } catch(e){} }, 1500);
    </script>
  </body>
</html>`;

  res.type('html').send(html);
});

app.post('/api/kite/connect', async (req, res) => {
  const { apiKey, apiSecret, requestToken, accessToken } = req.body;
  const resolvedApiKey = (apiKey || kiteState.apiKey || process.env.KITE_API_KEY || '').trim();
  const resolvedApiSecret = (apiSecret || kiteState.apiSecret || process.env.KITE_API_SECRET || '').trim();
  const resolvedRequestToken = (requestToken || kiteState.requestToken || process.env.KITE_REQUEST_TOKEN || '').trim();
  const resolvedAccessToken = (accessToken || '').trim();

  // If accessToken is provided from the UI, accept it and set state directly.
  if (resolvedAccessToken) {
    kiteState = {
      ...kiteState,
      apiKey: resolvedApiKey || kiteState.apiKey,
      apiSecret: resolvedApiSecret || kiteState.apiSecret,
      accessToken: resolvedAccessToken,
      requestToken: resolvedRequestToken || kiteState.requestToken
    };
    console.log('Kite access token set from UI:', resolvedAccessToken ? `${resolvedAccessToken.slice(0,8)}...` : null);
    return res.json({ success: true, accessToken: resolvedAccessToken });
  }

  if (!resolvedApiKey || !resolvedApiSecret || !resolvedRequestToken) {
    return res.status(400).json({ error: 'Provide your Kite API key, API secret and request token, or pass an accessToken from the UI.' });
  }

  try {
    const kite = new KiteConnect({ api_key: resolvedApiKey });
    console.log('Generating Kite session for apiKey:', resolvedApiKey ? `${resolvedApiKey.slice(0,8)}...` : null, 'requestToken:', resolvedRequestToken ? `${resolvedRequestToken.slice(0,8)}...` : null);
    const session = await kite.generateSession(resolvedRequestToken, resolvedApiSecret);
    console.log('Kite generateSession response:', session && { access_token: session.access_token ? `${session.access_token.slice(0,8)}...` : null });

    kiteState = {
      ...kiteState,
      apiKey: resolvedApiKey,
      apiSecret: resolvedApiSecret,
      accessToken: session.access_token,
      requestToken: resolvedRequestToken
    };

    res.json({ success: true, accessToken: session.access_token, session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Unable to connect to Kite.' });
  }
});

function normalizeKiteInstrument(symbolName, defaultExchange = 'NSE') {
  const trimmed = String(symbolName || '').trim().toUpperCase();
  if (!trimmed) return `${defaultExchange}:RELIANCE`;
  if (trimmed.includes(':')) return trimmed;
  return `${defaultExchange}:${trimmed}`;
}

function parseJsonPayload(rawText) {
  if (!rawText) return null;

  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function getQuoteDetails(kite, symbolName) {
  if (!symbolName) return { price: null, lowerCircuitLimit: null, upperCircuitLimit: null };

  try {
    const instrument = normalizeKiteInstrument(symbolName);
    console.log('Fetching quote for instrument:', instrument);
    const quote = await kite.getQuote([instrument]);
    console.log('Quote raw response for', instrument, ':', quote);
    const quoteData = quote?.[instrument] ?? quote?.[symbolName] ?? null;
    return {
      price: quoteData?.last_price ? Number(quoteData.last_price) : null,
      lowerCircuitLimit: quoteData?.lower_circuit_limit ? Number(quoteData.lower_circuit_limit) : null,
      upperCircuitLimit: quoteData?.upper_circuit_limit ? Number(quoteData.upper_circuit_limit) : null
    };
  } catch {
    return { price: null, lowerCircuitLimit: null, upperCircuitLimit: null };
  }
}

app.post('/api/trade', async (req, res) => {
  const { prompt, symbol = 'RELIANCE', quantity = 1, side = 'BUY', price } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({
        error: 'OpenAI key is not configured. Add OPENAI_API_KEY to the project .env or workspace .env file.'
      });
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are an AI trading assistant. Convert the user request into a single JSON object with these fields:\n- action: "BUY", "SELL", or "HOLD"\n- quantity: number\n- symbol: string (ticker symbol)\n- exchange: string (e.g. "NSE")\n- order_type: string, either "MARKET" or "LIMIT" (use "MARKET" when user explicitly asks for market execution)\n- price: number or null (for LIMIT orders price is required; for MARKET orders, price may be null)\n- rationale: short string explaining the trade decision.\nReturn only the JSON object with no surrounding text. If the user asks to not trade, set action to "HOLD".'
        },
        {
          role: 'user',
          content: `Prompt: ${prompt}\nDefault symbol: ${symbol}\nDefault quantity: ${quantity}\nDefault side: ${side}`
        }
      ]
    });

    const parsed = parseJsonPayload(response.output_text);

    if (!parsed) {
      return res.json({
        reply: 'The agent did not return valid trade JSON.',
        raw: response.output_text
      });
    }

    if (parsed.action === 'HOLD') {
      return res.json({ reply: 'No trade action generated.', reasoning: parsed?.rationale || 'No action required.' });
    }

    const kiteAccessToken = kiteState.accessToken || process.env.KITE_ACCESS_TOKEN?.trim();
    const kiteApiKey = kiteState.apiKey || process.env.KITE_API_KEY?.trim();

    if (!kiteApiKey || !kiteAccessToken) {
      return res.status(500).json({
        error: 'Kite is not connected yet. Connect your account first to place real orders.',
        parsed
      });
    }

    const kite = new KiteConnect({ api_key: kiteApiKey });
    kite.setAccessToken(kiteAccessToken);

    const symbolName = String(parsed.symbol || symbol || '').trim().toUpperCase();
    const quoteDetails = await getQuoteDetails(kite, symbolName);

    // Force MARKET unconditionally per user request. Do not require a price for MARKET orders.
    const finalOrderType = 'MARKET';
    console.log('Forcing MARKET order type for execution.');

    // If in the future LIMIT orders are used, allow zero price entry and clamp to circuit limits.
    let resolvedPrice = null;
    let adjustedPrice = null;
    if (finalOrderType === 'LIMIT') {
      const priceFromQuote = quoteDetails.price;
      const requestedPrice = price ?? parsed.price ?? null; // allow 0 as valid
      resolvedPrice = (requestedPrice !== null && requestedPrice !== undefined && requestedPrice !== '')
        ? Number(requestedPrice)
        : (priceFromQuote ?? null);

      if (resolvedPrice === null || Number.isNaN(resolvedPrice)) {
        return res.status(400).json({ error: 'No valid order price could be determined. Please enter a price or wait for a live quote.' });
      }

      adjustedPrice = resolvedPrice;
      if (quoteDetails.lowerCircuitLimit && quoteDetails.upperCircuitLimit) {
        adjustedPrice = Math.max(quoteDetails.lowerCircuitLimit, Math.min(quoteDetails.upperCircuitLimit, adjustedPrice));
      }

      if (adjustedPrice !== resolvedPrice) {
        console.log(`Adjusted order price for ${symbolName} from ${resolvedPrice} to ${adjustedPrice} based on circuit limits.`);
      }
    }

    const orderPayload = {
      exchange: parsed.exchange || 'NSE',
      tradingsymbol: parsed.symbol || symbol,
      transaction_type: parsed.action === 'BUY' ? 'BUY' : 'SELL',
      quantity: Number(parsed.quantity || quantity),
      product: 'CNC',
      order_type: 'MARKET',
      validity: 'DAY'
    };

    // For MARKET orders via API, include market protection flag if supported by broker
    // Kite expects a numeric value for market_protection (decimal), not a boolean
    orderPayload.market_protection = 1;
    console.log('Added market_protection=1 to order payload for forced MARKET order');

    // For LIMIT orders, set the price to the adjusted price (broker requires explicit price)
    if (finalOrderType === 'LIMIT') {
      orderPayload.price = Number(Number(adjustedPrice).toFixed(2));
    }

    // For MARKET orders via API, include market protection flag if supported by broker
    if (finalOrderType === 'MARKET') {
      orderPayload.market_protection = 1;
      console.log('Added market_protection=1 to order payload for MARKET order');
    }

    console.log('Placing order payload:', JSON.stringify(orderPayload));
    let order;
    try {
      order = await kite.placeOrder('regular', orderPayload);
    } catch (kiteError) {
      console.error('Kite placeOrder error:', kiteError?.response?.data || kiteError);
      const detail = kiteError?.response?.data || kiteError?.message || String(kiteError);
      return res.status(500).json({ error: 'Kite placeOrder failed', detail });
    }

    res.json({
      reply: parsed.rationale,
      parsed,
      order,
      priceUsed: adjustedPrice,
      circuitLimits: quoteDetails.lowerCircuitLimit && quoteDetails.upperCircuitLimit
        ? { lower: quoteDetails.lowerCircuitLimit, upper: quoteDetails.upperCircuitLimit }
        : null
    });
  } catch (error) {
    console.error(error);
    const message = error?.message || 'Failed to process trade request.';
    const detail = error?.response?.data?.message || error?.data?.message || '';
    res.status(500).json({
      error: detail ? `${message}: ${detail}` : message,
      rawError: error
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Temporary direct order endpoint for testing MARKET vs LIMIT behavior
app.post('/api/trade-direct', async (req, res) => {
  const payload = req.body || {};
  const kiteApiKey = kiteState.apiKey || process.env.KITE_API_KEY?.trim();
  const kiteAccessToken = kiteState.accessToken || process.env.KITE_ACCESS_TOKEN?.trim();

  if (!kiteApiKey || !kiteAccessToken) {
    return res.status(400).json({ error: 'Kite not connected. Set access token via UI first.' });
  }

  try {
    const kite = new KiteConnect({ api_key: kiteApiKey });
    kite.setAccessToken(kiteAccessToken);
    // sanitize market_protection to numeric if boolean provided
    const sanitized = { ...payload };
    if (sanitized.market_protection === true) sanitized.market_protection = 1;
    if (sanitized.market_protection === false) sanitized.market_protection = 0;
    console.log('Direct placeOrder payload:', sanitized);
    const order = await kite.placeOrder('regular', sanitized);
    res.json({ order });
  } catch (e) {
    console.error('Direct placeOrder error:', e?.response?.data || e);
    const detail = e?.response?.data || e?.message || String(e);
    res.status(500).json({ error: 'Kite placeOrder failed', detail });
  }
});
