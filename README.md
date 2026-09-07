# Migri Oulu appointment checker

Standalone static implementation plus an optional hourly watcher for checking the Migri appointment flow for Oulu.

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

The included GitHub Actions workflow runs it hourly. Add `RESEND_API_KEY`, `ALERT_FROM`, and `ALERT_TO` as repository secrets, then enable Actions. The workflow is intentionally read-only and does not bypass CAPTCHA or other booking controls.
