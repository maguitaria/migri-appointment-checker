# Migri Oulu Telegram notification service

Public website + background checker for Migri appointments in Oulu.

The service:

- lets a visitor choose an Oulu service and reason;
- opens the Telegram bot with that preference;
- stores the user’s Telegram chat ID privately in Cloudflare D1;
- checks Migri with a read-only browser worker every hour;
- sends a Telegram alert when a new time appears;
- never enters personal data or books an appointment.

Current location: **Oulu**. Current reasons: work, family, study, and permanent residence.

## What the admin owns

The admin creates and controls the Telegram bot. Bot tokens are secrets. Do not put the token in the website, README, or Git repository.

## Production setup

You need:

1. GitHub — website, GitHub Pages, and scheduled checker.
2. Cloudflare — Worker API and D1 database.
3. Telegram — bot and bot token.

No AI key, email domain, or paid email provider is required.

### 1. Create the Telegram bot

In Telegram, open `@BotFather`:

```text
/newbot
```

Save the bot username and token privately. The username is public; the token is secret.

### 2. Deploy the Worker API

```sh
cd worker
npx wrangler login
npx wrangler d1 create migri-subscriptions
cp wrangler.toml.example wrangler.toml
# Put the database_id printed by Wrangler into wrangler.toml.
npx wrangler d1 execute migri-subscriptions --remote --file=schema.sql
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put MONITOR_API_KEY
npx wrangler deploy
```

If Cloudflare asks you to register a `workers.dev` subdomain, complete that once in the Cloudflare dashboard and run `npx wrangler deploy` again.

### 3. Connect Telegram to the Worker

After deployment, set the Telegram webhook. Replace the placeholders with your real values:

```sh
curl -X POST "https://api.telegram.org/botTELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_WORKER.workers.dev/telegram/webhook" \
  -d "secret_token=TELEGRAM_WEBHOOK_SECRET"
```

Update the public website configuration:

```js
// config.js
window.MIGRI_CONFIG = {
  API_URL: 'https://YOUR_WORKER.workers.dev',
  TELEGRAM_BOT_USERNAME: 'your_bot_username'
}
```

### 4. Configure GitHub Actions

Add these repository secrets under **Settings → Secrets and variables → Actions**:

```text
TELEGRAM_BOT_TOKEN
SUBSCRIPTION_API_URL
MONITOR_API_KEY
```

`MONITOR_API_KEY` must be the same value used with `wrangler secret put MONITOR_API_KEY`.

### 5. Enable GitHub Pages

In the repository:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run **Deploy website to GitHub Pages** manually.

Expected URL:

```text
https://YOUR_GITHUB_USERNAME.github.io/migri-appointment-checker/
```

### 6. Start monitoring

The `Check Migri Oulu appointments` workflow runs hourly. It stores the last result in `state.json`, so the same slot is not sent repeatedly.

For local development:

```sh
cp .env.example .env
npm install
npx playwright install chromium
npm run check
```

For a continuously running server process:

```sh
npm run runner
```

Use either GitHub Actions or `npm run runner`, not both for the same bot subscribers.

## User flow

1. Visitor opens the website.
2. Visitor selects Oulu and a residence-permit reason.
3. Visitor clicks **Continue in Telegram**.
4. Visitor presses **Start** in the bot.
5. The bot confirms the subscription.
6. The checker sends a Telegram message when a new time appears.
7. Visitor opens Migri and books manually.
8. Visitor sends `/stop` to unsubscribe.

## Local dashboard

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Why the background runner exists

The website is only the public interface. It cannot check Migri after the browser closes. The runner performs the scheduled browser check, compares the result with the previous run, and sends Telegram alerts.

## License

MIT. See [LICENSE](LICENSE).
