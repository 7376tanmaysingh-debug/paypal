# Run PayPilot

## Local demo

Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Run `npm start` and open http://localhost:3000.

The catalog and a local matching fallback work without API keys.

## AI recommendations

Set `OPENAI_API_KEY` in `.env` to enable natural-language product recommendations. The default model is `gpt-4o-mini`; change it with `OPENAI_MODEL`. The server limits recommendations to the curated catalog. If the model request fails, PayPilot falls back to local matching.

## PayPal sandbox checkout

1. Create a REST app in the PayPal Developer Dashboard.
2. Copy its sandbox client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
3. Keep the secret only in the server environment. Never put it in browser code.
4. Restart PayPilot and use a sandbox buyer account in checkout.

The server creates Orders v2 from its own catalog prices. PayPal captures an order only after the buyer approves it in the PayPal checkout UI. The browser never submits trusted prices, and AI cannot create or approve orders.

## Deploy

Deploy as a Node web service with build command `npm install` and start command `npm start`. Add the environment variables in your host's secret settings. Use sandbox credentials for judging and demo. The app listens on the port supplied by `PORT`.

## Scope

This hackathon demo uses an in-memory curated product collection. A production shop would need inventory, tax and shipping calculation, order persistence, customer accounts, and operational monitoring.