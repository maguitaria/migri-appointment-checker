# Migri Oulu appointment checker

Standalone static implementation plus an optional hourly watcher for checking the Migri appointment flow for Oulu.

Open-source project under the MIT License. The watcher is intentionally read-only: it checks public appointment availability and sends alerts, but never submits a booking.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server:

```sh
python3 -m http.server 8080
```

The checker is a guide and availability snapshot. It does not reserve appointments or collect personal data. The official live calendar is always available through the links on the page.

## Email watcher

The watcher follows the official flow for `Oleskelulupa → 1. Työ → Oulu → 1 henkilö` and emails a group when a newly visible time is found. It never submits a booking.

1. Copy `.env.example` to `.env`.
2. Add a Resend API key, a verified sender, and comma-separated recipient emails.
3. Install dependencies and Chromium: `npm install && npx playwright install chromium`.
4. Run one check: `npm run check`.

For a continuously running process instead of GitHub Actions, run `npm run runner`. It checks once immediately and then repeats every hour. Set `CHECK_INTERVAL_MINUTES` to a value of 15 or higher if you need a different interval.

The included GitHub Actions workflow runs it hourly. Add `RESEND_API_KEY`, `ALERT_FROM`, and `ALERT_TO` as repository secrets, then enable Actions. The workflow is intentionally read-only and does not bypass CAPTCHA or other booking controls.

## Why both a runner and a website?

The website is the human-facing dashboard: it explains the setup and displays the latest local `state.json` when served from this folder. A browser tab cannot reliably check in the background after it is closed, so the runner performs the actual scheduled work. Use either the always-on `npm run runner` process or the GitHub Actions schedule as the production runner; do not run both against the same recipients unless duplicate alerts are acceptable.

## Required keys

No AI key is required. The only external credential is a [Resend](https://resend.com) API key for sending email. Keep it in GitHub Actions secrets or a local `.env` file; never commit it.
