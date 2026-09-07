# Telegram setup

This is the complete setup for the owner of the bot. Run the commands from the repository root.

## 1. Create or confirm the bot

1. Open Telegram and open `@BotFather`.
2. Send `/newbot` if you do not already have a bot.
3. Save the bot username and token privately.
4. Never commit or send the token to anyone. The website only needs the public bot username in `config.js`.

## 2. Confirm the Worker secrets

The deployed Worker is:

```text
https://migri-appointment-api.mglushen22.workers.dev
```

It must have these three secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
MONITOR_API_KEY
```

To check the secret names:

```sh
cd worker
npx wrangler secret list
cd ..
```

If one is missing, add it with `npx wrangler secret put SECRET_NAME`, then deploy:

```sh
cd worker
npx wrangler deploy
cd ..
```

## 3. Prepare local admin settings

Create a local `.env` file. It is ignored by Git.

```sh
cp .env.example .env
```

Set these values in `.env`:

```text
SUBSCRIPTION_API_URL=https://migri-appointment-api.mglushen22.workers.dev
MONITOR_API_KEY=the_same_value_used_for_the_Worker_secret
TELEGRAM_BOT_TOKEN=the_token_from_BotFather
```

Do not put `TELEGRAM_BOT_TOKEN` or `MONITOR_API_KEY` in `config.js`.

## 4. Register the webhook

From the repository root:

```sh
npm install
npm run setup:telegram
```

This calls the protected Worker admin route. It registers:

```text
https://migri-appointment-api.mglushen22.workers.dev/telegram/webhook
```

The command prints both setup and status responses. The status must contain that URL and must not contain `last_error_message`.

## 5. Verify Telegram independently

Run:

```sh
npm run check:telegram
```

The output should show:

```text
Webhook URL: https://migri-appointment-api.mglushen22.workers.dev/telegram/webhook
Telegram last error: (none)
```

If the URL is empty or different, run `npm run setup:telegram` again.

## 6. Test the real user flow

1. Open the public website: <https://maguitaria.github.io/migri-appointment-checker/>.
2. Select any listed service point.
3. Click **Get ... alerts in Telegram**.
4. In Telegram, press **Start**.
5. The bot must reply with a subscription confirmation.
6. Send `/status`. The bot must list the selected location.
7. Send `/help` to see the instructions.
8. Send `/stop` to test unsubscribe.

If Start does nothing, run `npm run check:telegram` before changing code. The issue is the webhook URL, Worker secret, or Telegram bot token—not the website button.

## 7. Configure the hourly runner

In GitHub, open the repository’s **Settings → Secrets and variables → Actions** and add:

```text
TELEGRAM_BOT_TOKEN
SUBSCRIPTION_API_URL=https://migri-appointment-api.mglushen22.workers.dev
MONITOR_API_KEY=the_same_value_used_for_the_Worker_secret
```

Then open **Actions → Check Migri appointments hourly → Run workflow**.

The runner checks every hour, records date/time/location/reason, and sends a Telegram message only for newly seen slots. Each Telegram message has an **Open Migri booking now** button.

The checker also runs once whenever code is pushed to `main`. Its own `state.json` update is excluded, so it cannot trigger itself repeatedly.

## 8. What users need to do

Users only need the public URL and Telegram:

1. Choose a location.
2. Open Telegram.
3. Press Start.
4. Wait for a notification.
5. Use the Migri button immediately and complete the booking manually.

Users do not need a token, Cloudflare account, GitHub account, email address, or separate bot.
