const token = process.env.TELEGRAM_BOT_TOKEN
const workerUrl = (process.env.SUBSCRIPTION_API_URL || '').replace(/\/$/, '')

if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN in .env')
if (!workerUrl) throw new Error('Set SUBSCRIPTION_API_URL in .env')

const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
if (!response.ok) throw new Error(`Telegram API failed: ${response.status} ${await response.text()}`)

const info = (await response.json()).result
const expected = `${workerUrl}/telegram/webhook`
console.log(`Webhook URL: ${info.url || '(not set)'}`)
console.log(`Expected URL: ${expected}`)
console.log(`Pending updates: ${info.pending_update_count}`)
console.log(`Telegram last error: ${info.last_error_message || '(none)'}`)
if (info.url !== expected) {
  console.error('\nWebhook is not connected to this Worker. Set it with the command in README.md.')
  process.exitCode = 1
}
