import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BOOKING_URL = 'https://migri.vihta.com/public/migri/#/home'
const stateFile = new URL('./state.json', import.meta.url)
const recipients = (process.env.ALERT_TO || '').split(',').map((value) => value.trim()).filter(Boolean)

if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM || recipients.length === 0) {
  throw new Error('Set RESEND_API_KEY, ALERT_FROM, and ALERT_TO in .env')
}

async function findSlots() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(BOOKING_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.getByRole('link', { name: 'Varaa uusi aika' }).click()
    await page.getByRole('button', { name: 'Valitse palvelukategoria' }).click()
    await page.getByRole('option', { name: 'Oleskelulupa' }).click()
    await page.getByRole('button', { name: 'Valitse palvelu' }).click()
    await page.getByRole('option', { name: '1. Työ' }).click()
    await page.getByRole('button', { name: 'Valitse toimipiste' }).click()
    await page.getByRole('option', { name: 'Oulu : Oulun palvelupiste' }).click()
    await page.getByRole('button', { name: 'Hae vapaat ajat' }).click()
    await page.waitForTimeout(2_000)

    const lines = (await page.locator('body').innerText()).split('\n').map((line) => line.trim()).filter(Boolean)
    const slots = lines.filter((line) => /\b(?:[01]?\d|2[0-3])[:.]\d{2}\b/.test(line))
    return [...new Set(slots)]
  } finally {
    await browser.close()
  }
}

async function sendEmail(slots) {
  const body = [
    'A Migri appointment may be available in Oulu.',
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
    body: JSON.stringify({ from: process.env.ALERT_FROM, to: recipients, subject: 'Migri Oulu appointment available', text: body })
  })

  if (!response.ok) throw new Error(`Email failed: ${response.status} ${await response.text()}`)
}

const slots = await findSlots()
const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).slots || [] : []
const newSlots = slots.filter((slot) => !previous.includes(slot))

if (newSlots.length > 0) {
  await sendEmail(newSlots)
  console.log(`Sent alert for ${newSlots.length} new slot(s).`)
} else {
  console.log(`No new slots. Visible slots: ${slots.length}.`)
}

writeFileSync(stateFile, JSON.stringify({ slots, checkedAt: new Date().toISOString() }, null, 2))
