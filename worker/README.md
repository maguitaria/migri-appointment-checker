# Subscription API

This tiny Cloudflare Worker stores email subscriptions in D1. It exposes public subscribe/unsubscribe routes and keeps the subscription list behind `MONITOR_API_KEY` for the GitHub Actions checker.

From this directory:

```sh
npx wrangler login
npx wrangler d1 create migri-subscriptions
cp wrangler.toml.example wrangler.toml
# Put the returned database_id into wrangler.toml
npx wrangler d1 execute migri-subscriptions --remote --file=schema.sql
npx wrangler secret put MONITOR_API_KEY
npx wrangler deploy
```

Set `SITE_ORIGIN` in `wrangler.toml` to the final GitHub Pages URL. Put the deployed Worker URL in the root `config.js`, and add the same URL plus the same monitor key to GitHub Actions secrets.
