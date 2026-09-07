# Migri Telegram appointment notification service

Public website + background checker for Migri appointments.

The service:

- lets a visitor choose Oulu, Rovaniemi, or Vaasa;
- opens the Telegram bot with that preference;
- stores the user’s Telegram chat ID privately in Cloudflare D1;
- checks each selected location with a read-only browser worker every hour;
- sends a Telegram alert when a new time appears;
- shows an anonymized count of active watchers per location;
- never enters personal data or books an appointment.

Current locations: **Oulu, Rovaniemi, and Vaasa**. The runner checks all configured residence-permit flows for each location, so users do not need to choose a permit subtype.

## What the admin owns

The admin creates and controls the Telegram bot. Bot tokens are secrets. Do not put the token in the website, README, or Git repository.

## Production setup

You need:

1. GitHub — website, GitHub Pages, and scheduled checker.
2. Cloudflare — Worker API and D1 database.
3. Telegram — bot and bot token.

No AI key, email domain, or paid email provider is required.

### 1. Create the single Telegram bot for the service

In Telegram, open `@BotFather`:

```text
/newbot
```

Save the bot username and token privately. The username is public; the token is secret. You do not need one bot per user: the administrator owns one bot, and all users subscribe privately to that same bot.

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

If the bot does nothing after pressing **Start**, the webhook is usually missing or points to an old Worker. Check it without printing the token:

```sh
npm run check:telegram
```

The expected webhook URL is `https://migri-appointment-api.mglushen22.workers.dev/telegram/webhook` for the current deployment. Telegram should show that exact URL and no recent error. The Worker CORS origin must be the site origin (`https://maguitaria.github.io`), not the repository path.

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

The `Check Migri appointments` workflow runs hourly for every subscribed location. It stores the last result in `state.json`, so the same slot is not sent repeatedly.

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

## How it works

The website is a public control panel. A user selects a location, then opens the shared Telegram bot. The bot stores only the Telegram chat ID, selected location, and active status in the private D1 database. The public site shows only aggregate watcher counts.

The scheduled runner checks all configured residence-permit flows for every supported location once per hour, combines and deduplicates the visible times, and compares them with the previous check. A new time is sent once to subscribers watching that location; it is not repeated every hour while the same slot remains visible. The public page lists the latest combined snapshot. The service never reserves an appointment and never enters identity or application data.

## User flow

1. Visitor opens the website.
2. Visitor selects a location.
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
