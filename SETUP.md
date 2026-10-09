# Run PayPilot

## Local demo

Use Node.js 20 or newer.

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Run `npm start` and open http://localhost:3000.

The curated catalog and local matching fallback work without API keys. Add optional keys as described below to enable live AI and product search.

## AI recommendations

Set `OPENAI_API_KEY` in `.env` to enable natural-language product recommendations. The default model is `gpt-4o-mini`; change it with `OPENAI_MODEL`. The server limits recommendations to the curated catalog. If the model request fails, PayPilot falls back to local matching.

## Channel3 live product search

1. Create a free Channel3 developer account at https://trychannel3.com/developers and copy an API key.
2. For the hackathon key, use promo code `PAYPAL-HACKATHON-2026`; the hackathon page lists 20,000 product-search credits for each hackathon key.
3. Set `CHANNEL3_API_KEY` in your local `.env` or in Render under **Service → Environment**, then redeploy.

Keep the key on the server; never put it in browser code or commit it to GitHub. When enabled, a shopper's request is sent to Channel3 and PayPilot shows current products and retailer offers below the assistant's curated picks. Retailer offers open at the retailer and are separate from PayPilot's PayPal demo bag.

## PayPal sandbox checkout

1. Create a REST app in the PayPal Developer Dashboard.
2. Copy its sandbox client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
3. Keep the secret only in the server environment. Never put it in browser code.
4. Restart PayPilot and use a sandbox buyer account in checkout.

The server creates Orders v2 from its own catalog prices. PayPal captures an order only after the buyer approves it in the PayPal checkout UI. The browser never submits trusted prices, and AI cannot create or approve orders.

## Deploy to Render

The repository includes a `render.yaml` Blueprint for the PayPilot web service.

1. In Render, choose **New → Blueprint** and connect `7376tanmaysingh-debug/paypal`.
2. When prompted, enter your PayPal **Sandbox** Client ID and Secret. Render stores these as service environment variables; never commit them to GitHub.
3. Create the Blueprint and wait for the first deploy. Render provides a public `onrender.com` URL.
4. Open the URL and test checkout with a PayPal personal sandbox buyer account.

The Blueprint sets the sandbox API base URL and checks `/api/health`. The app listens on Render's supplied port. To use AI recommendations on the hosted app, add `OPENAI_API_KEY` under the service's Environment settings and redeploy. Without it, local catalog matching remains available. Add `CHANNEL3_API_KEY` there to enable live Channel3 product search.

## Scope

This hackathon demo uses an in-memory curated product collection. A production shop would need inventory, tax and shipping calculation, order persistence, customer accounts, and operational monitoring.