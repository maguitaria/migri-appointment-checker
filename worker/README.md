# Subscription API

Cloudflare Worker + D1 API used by the public website.

## Routes

```text
POST /subscribe
GET  /unsubscribe?token=...
GET  /internal/subscriptions   # requires MONITOR_API_KEY
```

The public route accepts an email, location, and supported flow. The internal route is used only by GitHub Actions. Do not put `MONITOR_API_KEY` in the website or `config.js`.

## Deploy

Run from this directory:

```sh
npx wrangler login
npx wrangler d1 create migri-subscriptions
cp wrangler.toml.example wrangler.toml
# Copy the returned database_id into wrangler.toml.
npx wrangler d1 execute migri-subscriptions --remote --file=schema.sql
npx wrangler secret put MONITOR_API_KEY
npx wrangler deploy
```

If Wrangler asks for a `workers.dev` subdomain, register one in the Cloudflare dashboard and repeat the deploy command.

After deployment:

1. Put the Worker URL in the root `config.js` as `API_URL`.
2. Add the same URL to GitHub Actions as `SUBSCRIPTION_API_URL`.
3. Add the same monitor secret to GitHub Actions as `MONITOR_API_KEY`.

The D1 schema is in `schema.sql`. The first production location is Oulu; the schema includes location so more offices can be added later.
