# Telegram subscription API

Cloudflare Worker + D1 API used by the public website and Telegram bot.

## Routes

```text
POST /telegram/webhook              # Telegram calls this
GET  /internal/telegram-subscriptions # GitHub Actions only
GET  /public/stats                    # anonymized public counts
```

The Worker stores chat IDs and selected locations. One bot is shared by all users; each user gets a separate location subscription row. `MONITOR_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` are server secrets. Never put them in `config.js` or the website.

## Deploy

Run from this directory:

```sh
npx wrangler login
npx wrangler d1 create migri-subscriptions
cp wrangler.toml.example wrangler.toml
# Copy the returned database_id into wrangler.toml.
npx wrangler d1 execute migri-subscriptions --remote --file=schema.sql
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put MONITOR_API_KEY
npx wrangler deploy
```

Register the webhook after deployment:

```sh
curl -X POST "https://api.telegram.org/botBOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_WORKER.workers.dev/telegram/webhook" \
  -d "secret_token=WEBHOOK_SECRET"
```

Then set `TELEGRAM_BOT_USERNAME` in the root `config.js`. The bot username is public; its token is not.
