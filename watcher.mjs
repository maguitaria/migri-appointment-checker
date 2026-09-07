import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BOOKING_URL = 'https://migri.vihta.com/public/migri/#/home'
const stateFile = new URL('./state.json', import.meta.url)
const locations = {
  Ahvenanmaa: { label: 'Ahvenanmaa / Mariehamn', office: 'Ahvenanmaa Åland : Maarianhaminan palvelupiste' },
  Helsinki: { label: 'Helsinki', office: 'Helsinki : Helsingin palvelupiste (Malmi)' },
  Kuopio: { label: 'Kuopio', office: 'Kuopio : Kuopion palvelupiste' },
  Lahti: { label: 'Lahti', office: 'Lahti : Lahden palvelupiste' },
  Lappeenranta: { label: 'Lappeenranta', office: 'Lappeenrannan palvelupiste' },
  Oulu: { label: 'Oulu', office: 'Oulu : Oulun palvelupiste' },
  Rovaniemi: { label: 'Rovaniemi', office: 'Rovaniemi : Rovaniemen palvelupiste' },
  Tampere: { label: 'Tampere', office: 'Tampere : Tampereen palvelupiste' },
  Turku: { label: 'Turku / Raisio', office: 'Turku : Raision palvelupiste' },
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

async function findSlots(browser, locationId, flowId) {
  const location = locations[locationId]
  const flow = flows[flowId]
  if (!location || !flow) throw new Error(`Unsupported location or flow: ${locationId}/${flowId}`)
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
    await page.waitForTimeout(1_500)

    const slots = []
    const weekCount = await page.locator('a.week-indicatorsLink').count()
    for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
      await page.locator('a.week-indicatorsLink').nth(weekIndex).click()
      await page.waitForTimeout(450)
      const buttons = await page.locator('button[aria-label^="Vapaa aika"]').all()
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label')
        const match = ariaLabel?.match(/(\d{2}\.\d{2}\.\d{4}).*?(\d{1,2})\.(\d{2})$/)
        if (match) slots.push({ date: match[1], time: `${match[2].padStart(2, '0')}:${match[3]}` })
      }
    }
    return [...new Map(slots.map((slot) => [`${slot.date}|${slot.time}`, slot])).values()]
  } finally {
    await page.close()
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

async function sendTelegram(locationId, slots, subscriptions) {
  const location = locations[locationId]
  const recipients = [...new Set(subscriptions.map((subscription) => String(subscription.chat_id)))]
  const lines = slots.map((slot) => `• ${slot.date} ${slot.time} — ${slot.flow}`)
  const chunks = []
  let chunk = []
  for (const line of lines) {
    if (chunk.join('\n').length + line.length + 1 > 3_200 && chunk.length) {
      chunks.push(chunk)
      chunk = []
    }
    chunk.push(line)
  }
  if (chunk.length) chunks.push(chunk)
  for (const chat_id of recipients) {
    for (let index = 0; index < chunks.length; index += 1) {
      const text = [`Migri availability in ${location.label} · part ${index + 1}/${chunks.length}`, '', ...chunks[index], '', 'This alert does not reserve an appointment. Complete the booking manually on Migri.'].join('\n')
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text, reply_markup: { inline_keyboard: [[{ text: 'Open Migri booking now', url: BOOKING_URL }]] } }) })
      if (!response.ok) throw new Error(`Telegram failed: ${response.status} ${await response.text()}`)
      await new Promise((resolve) => setTimeout(resolve, 75))
    }
  }
}

const subscriptions = await getSubscriptions()
const groups = Object.fromEntries(Object.keys(locations).map((locationId) => [locationId, subscriptions.filter((subscription) => (subscription.location || 'Oulu') === locationId)]))
const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { alerts: {} }
const alerts = {}

const availableSlots = []

const slotOrder = (a, b) => {
  const dateValue = (slot) => {
    const [day, month, year] = slot.date.split('.').map(Number)
    return new Date(year, month - 1, day, ...slot.time.split(':').map(Number)).getTime()
  }
  return dateValue(a) - dateValue(b) || a.location.localeCompare(b.location) || a.flow.localeCompare(b.flow)
}

const browser = await chromium.launch({ headless: true })
const failures = []

try {
  for (const [locationId, group] of Object.entries(groups)) {
    if (!locations[locationId]) continue
    const flowIds = Object.keys(flows)
    const foundByFlow = []
    for (let index = 0; index < flowIds.length; index += 2) {
      const batch = flowIds.slice(index, index + 2)
      const results = await Promise.allSettled(batch.map((flowId) => findSlots(browser, locationId, flowId)))
      results.forEach((result, resultIndex) => {
        const flowId = batch[resultIndex]
        if (result.status === 'fulfilled') foundByFlow.push({ flowId, slots: result.value })
        else {
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
          failures.push(`${locationId}/${flowId}: ${message}`)
          console.error(`Scan failed for ${locationId}/${flowId}: ${message}`)
        }
      })
    }

    const oldSlots = previous.alerts?.[locationId] || []
    if (foundByFlow.length !== flowIds.length) {
      console.error(`Keeping the previous ${locationId} result because one or more permit reasons failed.`)
      alerts[locationId] = oldSlots
      availableSlots.push(...oldSlots.filter((slot) => typeof slot === 'object').map(({ date, time, flow }) => ({ location: locationId, date, time, flow })))
      continue
    }

    const slots = foundByFlow.flatMap(({ flowId, slots: flowSlots }) => flowSlots.map((slot) => ({ ...slot, flow: flows[flowId].label, flowId })))
    const uniqueSlots = [...new Map(slots.map((slot) => [`${slot.date}|${slot.time}|${slot.flowId}`, slot])).values()]
    const oldKeys = new Set(oldSlots.map((slot) => typeof slot === 'string' ? `${slot}|legacy` : `${slot.date}|${slot.time}|${slot.flowId}`))
    const newSlots = uniqueSlots.filter((slot) => !oldKeys.has(`${slot.date}|${slot.time}|${slot.flowId}`))
    if (newSlots.length > 0 && group.length > 0 && process.env.DRY_RUN !== 'true') await sendTelegram(locationId, newSlots, group)
    if (newSlots.length > 0) console.log(`${process.env.DRY_RUN === 'true' ? 'Dry run — ' : ''}${locationId}: ${newSlots.map((slot) => `${slot.date} ${slot.time} — ${slot.flow}`).join(' | ')}`)
    else console.log(`${locationId}: no new slots; visible slots: ${uniqueSlots.length}`)
    uniqueSlots.sort((a, b) => slotOrder({ ...a, location: locationId }, { ...b, location: locationId }))
    alerts[locationId] = uniqueSlots
    availableSlots.push(...uniqueSlots.map(({ date, time, flow }) => ({ location: locationId, date, time, flow })))
  }
} finally {
  await browser.close()
}

availableSlots.sort(slotOrder)
writeFileSync(stateFile, JSON.stringify({ status: failures.length ? 'partial' : 'ok', alerts, slots: availableSlots.map(({ date, time, flow }) => `${date} ${time} — ${flow}`), availableSlots, checkedAt: new Date().toISOString(), failures, check: 'All residence-permit flows for all supported locations', bookingUrl: BOOKING_URL }, null, 2))
