# Migri Oulu notification service

Public website + background checker for Migri appointments in Oulu.

The service:

- lets a visitor choose a location and residence-permit reason;
- stores the subscription in Cloudflare D1;
- checks Migri with a read-only browser worker every hour;
- emails subscribers when a new time appears;
- never enters personal data or books an appointment.

Current supported location: **Oulu**. Current reasons: work, family, study, and permanent residence.

## Public setup

You need three accounts:

1. GitHub — code, GitHub Pages, and the scheduled checker.
2. Cloudflare — Worker API and D1 subscription database.
3. Resend — email delivery.

No AI key is required.

### 1. Deploy the subscription API

```sh
cd worker
npx wrangler login
npx wrangler d1 create migri-subscriptions
cp wrangler.toml.example wrangler.toml
# Put the database_id printed by Wrangler into wrangler.toml.
npx wrangler d1 execute migri-subscriptions --remote --file=schema.sql
npx wrangler secret put MONITOR_API_KEY
npx wrangler deploy
```

If Cloudflare asks you to register a `workers.dev` subdomain, complete that once in the Cloudflare dashboard and run `npx wrangler deploy` again.

Copy the deployed Worker URL into the root `config.js`:

```js
window.MIGRI_CONFIG = {
  API_URL: 'https://your-worker.workers.dev'
}
```

### 2. Configure email delivery

Create a Resend API key and verify a sending domain for production use. Add these GitHub Actions secrets:

```text
RESEND_API_KEY
ALERT_FROM
SUBSCRIPTION_API_URL
MONITOR_API_KEY
```

`MONITOR_API_KEY` must be the same value used with `wrangler secret put MONITOR_API_KEY`.

For testing, Resend can send from `onboarding@resend.dev` to the Resend account email only. Sending to other subscribers requires a verified domain.

### 3. Enable GitHub Pages

In the repository:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` or run **Deploy website to GitHub Pages** manually.

The site will be available at:

```text
https://YOUR_GITHUB_USERNAME.github.io/migri-appointment-checker/
```

### 4. Start monitoring

The `Check Migri Oulu appointments` workflow runs hourly. It saves the last result in `state.json` so the same slot is not emailed repeatedly.

For local development only:

```sh
cp .env.example .env
npm install
npx playwright install chromium
npm run check
```

For a continuously running local/server process:

```sh
npm run runner
```

Use either the GitHub Actions runner or `npm run runner`, not both for the same subscribers.

## Why the background runner exists

The website is only the public interface. It cannot check Migri after a visitor closes the browser. The runner performs the scheduled browser check, compares the result with the previous run, and sends the alert.

The final booking is always manual on Migri. This avoids storing passport details, submitting appointments automatically, or bypassing CAPTCHA and booking controls.

## Local dashboard

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## License

MIT. See [LICENSE](LICENSE).
