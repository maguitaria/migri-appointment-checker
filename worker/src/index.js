const locations = {
  Ahvenanmaa: 'Ahvenanmaa Åland : Maarianhaminan palvelupiste',
  Helsinki: 'Helsinki : Helsingin palvelupiste (Malmi)',
  Kuopio: 'Kuopio : Kuopion palvelupiste',
  Lahti: 'Lahti : Lahden palvelupiste',
  Lappeenranta: 'Lappeenranta : Lappeenrannan palvelupiste',
  Oulu: 'Oulu : Oulun palvelupiste',
  Rovaniemi: 'Rovaniemi : Rovaniemen palvelupiste',
  Tampere: 'Tampere : Tampereen palvelupiste',
  Turku: 'Turku : Raision palvelupiste',
  Vaasa: 'Vaasa : Vaasan palvelupiste'
}
const allowedLocations = new Set(Object.keys(locations))
const publicSite = 'https://maguitaria.github.io/migri-appointment-checker/'

function headers(origin = '*') {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization, x-telegram-bot-api-secret-token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' }
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) })
}

async function telegram(env, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`Telegram API failed: ${response.status}`)
  return response.json()
}

async function sendCurrentAvailability(env, chatId, location) {
  try {
    const response = await fetch(`${publicSite}state.json?ts=${Date.now()}`)
    if (!response.ok) throw new Error(`state.json returned ${response.status}`)
    const state = await response.json()
    const slots = (state.availableSlots || []).filter((slot) => slot.location === location)
    const shown = slots.slice(0, 20)
    const lines = shown.map((slot) => `• ${slot.date} ${slot.time} — ${slot.flow || 'Migri appointment'}`)
    const fullListUrl = `${publicSite}?location=${encodeURIComponent(location)}#slots`
    const text = [
      `Current Migri times in ${location}`,
      '',
      slots.length ? `Found ${slots.length} available time${slots.length === 1 ? '' : 's'}.` : 'No available times are visible in the latest check.',
      ...lines,
      '',
      slots.length > shown.length ? `Full paginated list: ${fullListUrl}` : fullListUrl,
      'Future messages are sent when a newly detected time appears.'
    ].join('\n')
    await telegram(env, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
  } catch (error) {
    console.error(`Could not send current availability for ${location}:`, error)
    await telegram(env, 'sendMessage', { chat_id: chatId, text: 'Your alert is active. I could not load the current slot list right now; future new slots will still be sent.' })
  }
}

function isAdmin(request, env) {
  return request.headers.get('Authorization') === `Bearer ${env.MONITOR_API_KEY}`
}

async function handleTelegramUpdate(update, env) {
  const message = update.message
  if (!message?.chat?.id || !message.text) return
  const chatId = String(message.chat.id)
  const text = message.text.trim()

  if (text.startsWith('/stop')) {
    await env.DB.prepare('UPDATE telegram_subscriptions SET active = 0 WHERE chat_id = ?').bind(chatId).run()
    await telegram(env, 'sendMessage', { chat_id: chatId, text: 'Migri alerts stopped. Send /start to subscribe again.' })
    return
  }

  if (text.startsWith('/help')) {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: 'Choose a location on the website and press Start in Telegram. Use /status to see your active alerts. Use /stop to unsubscribe.' })
    return
  }

  if (text.startsWith('/status')) {
    const { results } = await env.DB.prepare('SELECT location FROM telegram_subscriptions WHERE chat_id = ? AND active = 1 ORDER BY location').bind(chatId).all()
    const locationsText = results.length ? results.map((row) => `• ${row.location}`).join('\n') : 'No active alerts.'
    await telegram(env, 'sendMessage', { chat_id: chatId, text: `Your active Migri alerts:\n${locationsText}\n\nThe checker runs every 15 minutes. Use /stop to unsubscribe.` })
    return
  }

  if (!text.startsWith('/start')) return
  const payload = text.split(/\s+/)[1] || 'Oulu'
  const [location] = payload.split(':')
  const flow = 'all'
  if (!allowedLocations.has(location)) {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: 'Choose a notification from the website and use its Telegram button to subscribe.' })
    return
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(`INSERT INTO telegram_subscriptions (id, chat_id, username, location, flow, active, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now')) ON CONFLICT(chat_id, location, flow) DO UPDATE SET active = 1, username = excluded.username`).bind(id, chatId, message.from?.username || '', location, flow).run()
    await telegram(env, 'sendMessage', { chat_id: chatId, text: `You are subscribed to all Migri appointment times in ${location}. I will send newly detected times automatically. Send /stop to unsubscribe.` })
    await sendCurrentAvailability(env, chatId, location)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.SITE_ORIGIN || '*'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) })

    if (url.pathname === '/telegram/webhook' && request.method === 'POST') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'Unauthorized' }, 401)
      await handleTelegramUpdate(await request.json(), env)
      return json({ ok: true })
    }

    if (url.pathname === '/internal/telegram-subscriptions' && request.method === 'GET') {
      if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401)
      const { results } = await env.DB.prepare('SELECT chat_id, username, location, flow FROM telegram_subscriptions WHERE active = 1').all()
      return json(results)
    }

  if (url.pathname === '/internal/telegram/setup' && request.method === 'POST') {
    if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401)
      const webhook = `${new URL(request.url).origin}/telegram/webhook`
      const result = await telegram(env, 'setWebhook', { url: webhook, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'] })
      const commands = await telegram(env, 'setMyCommands', { commands: [{ command: 'start', description: 'activate alerts from the website' }, { command: 'status', description: 'show active alert locations' }, { command: 'stop', description: 'stop all alerts' }, { command: 'help', description: 'show instructions' }] })
      return json({ ok: result.ok && commands.ok, webhook, commands: commands.ok })
    }

    if (url.pathname === '/internal/telegram/status' && request.method === 'GET') {
      if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401)
      const result = await telegram(env, 'getWebhookInfo', {})
      return json({ ok: result.ok, result: result.result })
    }

    if (url.pathname === '/public/stats' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT location, COUNT(DISTINCT chat_id) AS watchers FROM telegram_subscriptions WHERE active = 1 GROUP BY location').all()
      const counts = Object.fromEntries(results.map((row) => [row.location, Number(row.watchers)]))
      return json({ locations: Object.keys(locations).map((location) => ({ location, watchers: counts[location] || 0 })), total: Object.values(counts).reduce((sum, count) => sum + count, 0) }, 200, origin)
    }

    return json({ service: 'Migri Telegram notification service', status: 'ok' }, 200, origin)
  }
}
