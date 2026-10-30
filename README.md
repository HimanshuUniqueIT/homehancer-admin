# HomeHancer Admin: prototype

A clickable admin panel for a home-services marketplace (HomeHancer, Ahmedabad) with a working Razorpay integration.
Plain HTML, CSS and JavaScript plus a small Node server with no dependencies.

## Run it

```bash
cd ~/homehancer-admin
npm start            # http://localhost:4300
```

Sign in with **admin@homehancer.co.in / admin123**.
Other demo logins: `neha@homehancer.co.in` (Operations) and `priya@homehancer.co.in` (Finance), same password.

Changes you make are saved in your browser's localStorage. Use **avatar menu → Reset sample data** to start over.

## Screens (clean URLs, no .html)

| URL | Screen |
|---|---|
| `/login` | Sign in |
| `/dashboard` | KPIs, revenue chart, things that need attention, today's schedule |
| `/bookings` | All bookings: tabs, filters, search, CSV export, new booking with coupon and GST calculation |
| `/bookings/HH10421` | Booking detail: status steps, assign partner, collect payment, refund, reschedule, cancel with policy, tax invoice |
| `/customers` | Customer list, profile drawer, wallet credit/debit, block |
| `/partners` | Partners, KYC verification, approval, skills and zones, commission, suspend |
| `/services` | Categories and services, pricing, GST, commission |
| `/zones` | Areas served, pincodes, surge pricing, coverage map |
| `/payments` | Razorpay transactions, refunds, settlement reconciliation |
| `/payments/pay_xxx` | One payment: journey from customer tap to settlement, failure reason, every attempt, the customer's payment history |
| `/payouts` | Weekly partner payouts (commission, 1% TDS), pay all |
| `/razorpay` | **Gateway configuration** (see below) |
| `/coupons` | Coupons, referral rules, banners |
| `/reviews` | Moderation, replies, rating breakdown |
| `/support` | Tickets with priority, assignee, replies, internal notes |
| `/content` | Website pages and blog posts with SEO preview |
| `/notifications` | SMS, WhatsApp, email and push templates; campaigns |
| `/reports` | Revenue, GST summary, service and partner performance, CSV exports |
| `/admins` | Admin users, role permission matrix, activity log |
| `/settings` | Business details, booking rules, cancellation policy, tax, app versions, integrations |

## Razorpay

Configuration lives at `/razorpay` and is stored on the server in `data/razorpay.json`. Secrets are never sent back to the browser unmasked.

Sections on that page: Status and go-live checklist · API keys (test and live) · Checkout (branding, methods, auto-capture, timeout, retry) · Payment rules (prepaid/advance/postpaid, platform fee, who pays the gateway fee, cash) · Webhooks (URL, secret, events) · Refunds · Route and RazorpayX payouts · Invoice and GST · Alerts · Test tools (webhook log and simulator, signature checker, test checkout).

### Use your real test account

1. In Razorpay Dashboard (Test mode) → Account & Settings → API Keys → generate keys.
2. Paste the Key ID and Key Secret on `/razorpay`, then click Save, then Test connection.
3. Open any unpaid booking and click **Collect with Razorpay**. The real Razorpay Checkout opens.
   Test UPI: `success@razorpay` · Test card: `4111 1111 1111 1111`, any future expiry, any CVV.
4. The server checks the signature (`/api/razorpay/verify`) before marking the booking paid.

Without keys, a clearly labelled **test checkout** opens instead, so the prototype still works offline.

### Webhooks

Razorpay can't reach `localhost`. Expose the server with a tunnel and register that URL:

```bash
cloudflared tunnel --url http://localhost:4300
# Webhook URL in Razorpay: https://<tunnel-host>/api/razorpay/webhook
```

Use the same secret on `/razorpay` → Webhooks. Each call is checked with HMAC-SHA256, logged, and de-duplicated by `X-Razorpay-Event-Id`.
To try this without Razorpay, use **Send test webhook** on the same page, which also covers a wrong signature and a duplicate event ID.

### Server API

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/razorpay/config` | Read (masked) or save configuration |
| POST | `/api/razorpay/test-connection` | Calls Razorpay with stored keys |
| POST | `/api/razorpay/orders` | Creates an order (amount in paise) |
| POST | `/api/razorpay/verify` | Checks `order_id\|payment_id` signature |
| POST | `/api/razorpay/refund` | Refunds a payment (normal or instant) |
| POST | `/api/razorpay/webhook` | Endpoint Razorpay calls |
| GET | `/api/razorpay/webhooks` | Webhook log |
| POST | `/api/razorpay/webhooks/simulate` | Sends a signed test event through the real handler |

Keys can also come from environment variables: `RZP_TEST_KEY_ID`, `RZP_TEST_KEY_SECRET`, `RZP_LIVE_KEY_ID`, `RZP_LIVE_KEY_SECRET`, `RZP_WEBHOOK_SECRET`.

## What is real and what is simulated

| Real | Simulated in this prototype |
|---|---|
| Razorpay orders, checkout, signature verification, refunds, webhook verification (with your keys) | Data is sample data in localStorage, not a database |
| Clean-URL routing, all forms, validation, CSV export | Login is a demo check, with no real password storage or sessions |
| Price, coupon, GST, commission and TDS calculations | SMS, email and WhatsApp sending; RazorpayX payouts; file uploads |

## Moving to production

- Replace localStorage with a database (PostgreSQL or MySQL) and an API, and keep Razorpay calls on the server as they are here.
- Add real authentication (hashed passwords, httpOnly session cookies, TOTP two-factor) and enforce role permissions on the server.
- Record payments from the `payment.captured` / `order.paid` webhooks as the source of truth.
- Serve over HTTPS. For static hosting of `public/`, add a rewrite of `/bookings/*` to `/booking/index.html`.

## GitHub Pages demo

Live at https://himanshuuniqueit.github.io/homehancer-admin/ and deployed on every push to `main` by `.github/workflows/pages.yml`.
Pages hosts static files only, so there is no Razorpay server there: checkout is the labelled test checkout, and saving keys, test connection and the webhook tools need `npm start`. Never put real keys on the Pages site.
