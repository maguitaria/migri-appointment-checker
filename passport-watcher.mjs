import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const QUEUE_URL = 'https://berlin.pasport.org.ua/solutions/e-queue'
const BOOKING_URL = QUEUE_URL
const stateFile = new URL('./passport-state.json', import.meta.url)
const location = 'Berlin'
const subscriptionFlow = 'passport_berlin'
const serviceLabel = 'Foreign passport and/or ID card'

if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Set TELEGRAM_BOT_TOKEN in .env')

function parseDate(value) {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function parseTimeOption(text) {
  const match = text.match(/(\d{1,2}:\d{2}).*?(\d+)\s+(?:вільн|free)/i)
  return match ? { time: match[1], availableCount: Number(match[2]) } : null
}

async function findSlots() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(QUEUE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    if ((await page.title()).toLowerCase().includes('just a moment')) throw new Error('Passport Service returned a Cloudflare verification page')
    await page.locator('#service').waitFor({ state: 'visible', timeoutMs: 30_000 })
    await page.locator('#service').selectOption('4')
    await page.waitForTimeout(900)

    const dates = await page.locator('#date option').evaluateAll((options) => options.map((option) => ({ value: option.value, text: option.textContent.trim() })).filter((option) => option.value))
    const slots = []
    for (const date of dates) {
      await page.locator('#date').selectOption(date.value)
      await page.waitForTimeout(700)
      const times = await page.locator('#time option').evaluateAll((options) => options.map((option) => ({ value: option.value, text: option.textContent.trim() })).filter((option) => option.value))
      for (const time of times) {
        const parsed = parseTimeOption(time.text)
        if (parsed) slots.push({ location, service: serviceLabel, flow: serviceLabel, date: parseDate(date.value), time: parsed.time, availableCount: parsed.availableCount })
      }
    }
    return [...new Map(slots.map((slot) => [`${slot.date}|${slot.time}|${slot.service}`, slot])).values()]
  } finally {
    await page.close()
    await browser.close()
  }
}

async function getSubscriptions() {
  if (!process.env.SUBSCRIPTION_API_URL || !process.env.MONITOR_API_KEY) throw new Error('Set SUBSCRIPTION_API_URL and MONITOR_API_KEY in .env')
  const response = await fetch(`${process.env.SUBSCRIPTION_API_URL.replace(/\/$/, '')}/internal/telegram-subscriptions`, { headers: { Authorization: `Bearer ${process.env.MONITOR_API_KEY}` } })
  if (!response.ok) throw new Error(`Subscription API failed: ${response.status}`)
  return (await response.json()).filter((subscription) => subscription.location === location && subscription.flow === subscriptionFlow)
}

async function sendTelegram(slots, subscriptions) {
  if (!subscriptions.length) return
  const lines = slots.map((slot) => `• ${slot.date} ${slot.time} — ${slot.availableCount} free slots`)
  const text = [`Passport Service Berlin`, serviceLabel, '', ...lines, '', `Open the official queue: ${BOOKING_URL}`, 'This alert does not reserve a slot. Complete the booking manually.'].join('\n')
  for (const subscription of [...new Map(subscriptions.map((item) => [String(item.chat_id), item])).values()]) {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: subscription.chat_id, text, disable_web_page_preview: true }) })
    if (!response.ok) throw new Error(`Telegram failed: ${response.status} ${await response.text()}`)
  }
}

const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { availableSlots: [] }
const subscriptions = await getSubscriptions()
let slots = []
let failures = []
try {
  slots = await findSlots()
} catch (error) {
  failures = [error instanceof Error ? error.message : String(error)]
  console.error(`Passport scan failed: ${failures[0]}`)
  slots = previous.availableSlots || []
}

const slotKey = (slot) => `${slot.date}|${slot.time}|${slot.service || slot.flow}`
const oldKeys = new Set((previous.availableSlots || []).map(slotKey))
const newSlots = failures.length ? [] : slots.filter((slot) => !oldKeys.has(slotKey(slot)))
if (newSlots.length) await sendTelegram(newSlots, subscriptions)
console.log(failures.length ? `Passport Service Berlin: keeping ${slots.length} previous slots` : `Passport Service Berlin: ${slots.length} visible slots; ${newSlots.length} new`)

const slotOrder = (a, b) => {
  const value = (slot) => {
    const [day, month, year] = slot.date.split('.').map(Number)
    const [hour, minute] = slot.time.split(':').map(Number)
    return new Date(year, month - 1, day, hour, minute).getTime()
  }
  return value(a) - value(b)
}
slots.sort(slotOrder)
writeFileSync(stateFile, JSON.stringify({ status: failures.length ? 'partial' : 'ok', location, service: serviceLabel, bookingUrl: BOOKING_URL, availableSlots: slots, checkedAt: new Date().toISOString(), failures }, null, 2))
