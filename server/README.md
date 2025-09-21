# eFlight Server (API)

## Quick start (local)
1) Copy `.env.example` to `.env` and set STRIPE keys (test keys are fine).
2) `npm i`
3) `npm run dev`
4) Server runs on http://localhost:8787

## Endpoints
- `POST /api/checkout/stripe`  → returns `{ url, order_ref }`
- `POST /api/webhooks/stripe`  → webhook for Stripe (optional for demo)
- `GET  /api/admin/orders?q=`  → list orders (search by email or order_ref)
- `GET  /health`               → health check

## Database
If `DATABASE_URL` is not set, the server uses in-memory storage for demo.
If `DATABASE_URL` is set (Postgres), it auto-creates tables on boot.
