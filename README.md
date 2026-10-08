# PayPilot

An AI shopping copilot for thoughtful discovery and buyer-approved PayPal sandbox checkout.

PayPilot turns a shopper's intent into a short, relevant product list. The assistant can suggest and explain; the shopper controls the cart and approves every payment in PayPal.

## Quick start

Requirements: Node.js 20+

```bash
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000. Without keys, the curated demo catalog and local recommendation fallback run. Set `OPENAI_API_KEY` to enable AI-assisted recommendations. Configure PayPal sandbox REST credentials (`PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`) to activate sandbox checkout.

## Demo

1. Ask for a product, such as “a small gift for someone who loves coffee, under $50.”
2. Review the AI's picks and why they fit.
3. Add items to your bag and review the total.
4. Approve the sandbox payment in PayPal Checkout.

The server creates the PayPal order from trusted catalog prices, and captures it only after PayPal reports buyer approval. No AI response can initiate or authorize payment.

See [SETUP.md](SETUP.md) for keys, sandbox accounts, and deployment notes.