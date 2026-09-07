import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BOOKING_URL = 'https://migri.vihta.com/public/migri/#/home'
const stateFile = new URL('./state.json', import.meta.url)
const locations = {
  Oulu: { label: 'Oulu', office: 'Oulu : Oulun palvelupiste' },
  Rovaniemi: { label: 'Rovaniemi', office: 'Rovaniemi : Rovaniemen palvelupiste' },
  Vaasa: { label: 'Vaasa', office: 'Vaasa : Vaasan palvelupiste' }
}
const flows = {
  residence_work: { category: 'Oleskelulupa', service: '1. Työ', label: 'Residence permit · Work' },
  residence_family: { category: 'Oleskelulupa', service: '2. Perhe', label: 'Residence permit · Family' },
  residence_study: { category: 'Oleskelulupa', service: '3. Opiskelu', label: 'Residence permit · Study' },
  residence_permanent: { category: 'Oleskelulupa', service: '5. Pysyvä oleskelulupa', label: 'Residence permit · Permanent' }
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('Set TELEGRAM_BOT_TOKEN in .env')
}

async function findSlots(locationId, flowId) {
  const location = locations[locationId]
  const flow = flows[flowId]
  if (!location || !flow) throw new Error(`Unsupported location or flow: ${locationId}/${flowId}`)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(BOOKING_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.getByRole('link', { name: 'Varaa uusi aika' }).click()
    await page.getByRole('button', { name: 'Valitse palvelukategoria' }).click()
    await page.getByRole('option', { name: flow.category }).click()
    await page.getByRole('button', { name: 'Valitse palvelu' }).click()
    await page.getByRole('option', { name: flow.service }).click()
    await page.getByRole('button', { name: 'Valitse toimipiste' }).click()
    await page.getByRole('option', { name: location.office }).click()
    await page.getByRole('button', { name: 'Hae vapaat ajat' }).click()
    await page.waitForTimeout(2_000)

    const lines = (await page.locator('body').innerText()).split('\n').map((line) => line.trim()).filter(Boolean)
    const slots = lines.filter((line) => /\b(?:[01]?\d|2[0-3]):\d{2}\b/.test(line))
    return [...new Set(slots)]
  } finally {
    await browser.close()
  }
}

async function getSubscriptions() {
  if (process.env.SUBSCRIPTION_API_URL && process.env.MONITOR_API_KEY) {
    const response = await fetch(`${process.env.SUBSCRIPTION_API_URL.replace(/\/$/, '')}/internal/telegram-subscriptions`, {
      headers: { Authorization: `Bearer ${process.env.MONITOR_API_KEY}` }
    })
    if (!response.ok) throw new Error(`Subscription API failed: ${response.status}`)
    return response.json()
  }

  const recipients = (process.env.ALERT_CHAT_IDS || '').split(',').map((value) => value.trim()).filter(Boolean)
  return recipients.map((chat_id) => ({ chat_id, location: process.env.DEFAULT_LOCATION || 'Oulu', flow: process.env.DEFAULT_FLOW || 'residence_work' }))
}

async function sendTelegram(locationId, flowId, slots, subscriptions) {
  const location = locations[locationId]
  const flow = flows[flowId]
  const recipients = [...new Set(subscriptions.map((subscription) => String(subscription.chat_id)))]
  const text = [
    `A Migri appointment may be available in ${location.label} for ${flow.label}.`,
    '',
    ...slots.map((slot) => `• ${slot}`),
    '',
    `Open the official booking service now: ${BOOKING_URL}`,
    '',
    'This alert does not reserve an appointment. Complete the booking manually on Migri.'
  ].join('\n')
  for (const chat_id of recipients) {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text }) })
    if (!response.ok) throw new Error(`Telegram failed: ${response.status} ${await response.text()}`)
  }
}

const subscriptions = await getSubscriptions()
const groups = Object.groupBy ? Object.groupBy(subscriptions, (subscription) => `${subscription.location || 'Oulu'}:${subscription.flow}`) : subscriptions.reduce((result, subscription) => {
  const key = `${subscription.location || 'Oulu'}:${subscription.flow}`
  return { ...result, [key]: [...(result[key] || []), subscription] }
}, {})
const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { alerts: {} }
const alerts = {}

for (const [key, group] of Object.entries(groups)) {
  const [locationId, flowId] = key.split(':')
  if (!locations[locationId] || !flows[flowId]) continue
  const slots = await findSlots(locationId, flowId)
  const oldSlots = previous.alerts?.[key] || []
  const newSlots = slots.filter((slot) => !oldSlots.includes(slot))
  if (newSlots.length > 0 && process.env.DRY_RUN !== 'true') await sendTelegram(locationId, flowId, newSlots, group)
  if (newSlots.length > 0) console.log(`${process.env.DRY_RUN === 'true' ? 'Dry run — ' : ''}${locationId}/${flowId}: ${newSlots.join(' | ')}`)
  else console.log(`${locationId}/${flowId}: no new slots; visible slots: ${slots.length}`)
  alerts[key] = slots
}

writeFileSync(stateFile, JSON.stringify({ status: 'ok', alerts, slots: Object.values(alerts).flat(), checkedAt: new Date().toISOString(), check: 'All subscribed locations and reasons', bookingUrl: BOOKING_URL }, null, 2))
