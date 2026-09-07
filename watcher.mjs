import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BOOKING_URL = 'https://migri.vihta.com/public/migri/#/home'
const stateFile = new URL('./state.json', import.meta.url)
const flows = {
  residence_work: { category: 'Oleskelulupa', service: '1. Työ', label: 'Residence permit · Work' },
  residence_family: { category: 'Oleskelulupa', service: '2. Perhe', label: 'Residence permit · Family' },
  residence_study: { category: 'Oleskelulupa', service: '3. Opiskelu', label: 'Residence permit · Study' },
  residence_permanent: { category: 'Oleskelulupa', service: '5. Pysyvä oleskelulupa', label: 'Residence permit · Permanent' }
}

if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM) {
  throw new Error('Set RESEND_API_KEY and ALERT_FROM in .env')
}

async function findSlots(flowId) {
  const flow = flows[flowId]
  if (!flow) throw new Error(`Unsupported flow: ${flowId}`)
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
    await page.getByRole('option', { name: 'Oulu : Oulun palvelupiste' }).click()
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
    const response = await fetch(`${process.env.SUBSCRIPTION_API_URL.replace(/\/$/, '')}/internal/subscriptions`, {
      headers: { Authorization: `Bearer ${process.env.MONITOR_API_KEY}` }
    })
    if (!response.ok) throw new Error(`Subscription API failed: ${response.status}`)
    return response.json()
  }

  const recipients = (process.env.ALERT_TO || '').split(',').map((value) => value.trim()).filter(Boolean)
  return recipients.map((email) => ({ email, flow: process.env.DEFAULT_FLOW || 'residence_work', token: '' }))
}

async function sendEmail(flowId, slots, subscriptions) {
  const flow = flows[flowId]
  const recipients = [...new Set(subscriptions.map((subscription) => subscription.email))]
  const body = [
    `A Migri appointment may be available in Oulu for ${flow.label}.`,
    '',
    ...slots.map((slot) => `• ${slot}`),
    '',
    `Open the official booking service now: ${BOOKING_URL}`,
    '',
    'This alert does not reserve an appointment. Complete the booking manually on Migri.'
  ].join('\n')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.ALERT_FROM, to: [recipients[0]], bcc: recipients.slice(1), subject: `Migri Oulu appointment · ${flow.label}`, text: body })
  })
  if (!response.ok) throw new Error(`Email failed: ${response.status} ${await response.text()}`)
}

const subscriptions = await getSubscriptions()
const groups = Object.groupBy ? Object.groupBy(subscriptions, (subscription) => subscription.flow) : subscriptions.reduce((result, subscription) => ({ ...result, [subscription.flow]: [...(result[subscription.flow] || []), subscription] }), {})
const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { alerts: {} }
const alerts = {}

for (const [flowId, group] of Object.entries(groups)) {
  if (!flows[flowId]) continue
  const slots = await findSlots(flowId)
  const oldSlots = previous.alerts?.[flowId] || []
  const newSlots = slots.filter((slot) => !oldSlots.includes(slot))
  if (newSlots.length > 0 && process.env.DRY_RUN !== 'true') await sendEmail(flowId, newSlots, group)
  if (newSlots.length > 0) console.log(`${process.env.DRY_RUN === 'true' ? 'Dry run — ' : ''}${flowId}: ${newSlots.join(' | ')}`)
  else console.log(`${flowId}: no new slots; visible slots: ${slots.length}`)
  alerts[flowId] = slots
}

writeFileSync(stateFile, JSON.stringify({ status: 'ok', alerts, slots: Object.values(alerts).flat(), checkedAt: new Date().toISOString(), check: 'Oulu · all configured subscriptions', bookingUrl: BOOKING_URL }, null, 2))
