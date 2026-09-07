const allowedFlows = new Set(['residence_work', 'residence_family', 'residence_study', 'residence_permanent'])
const locations = {
  Oulu: 'Oulu : Oulun palvelupiste',
  Rovaniemi: 'Rovaniemi : Rovaniemen palvelupiste',
  Vaasa: 'Vaasa : Vaasan palvelupiste'
}
const allowedLocations = new Set(Object.keys(locations))

function headers(origin = '*') {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, x-telegram-bot-api-secret-token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' }
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) })
}

async function telegram(env, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`Telegram API failed: ${response.status}`)
  return response.json()
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

  if (!text.startsWith('/start')) return
  const payload = text.split(/\s+/)[1] || 'Oulu:residence_work'
  const [location = 'Oulu', flow = 'residence_work'] = payload.split(':')
  if (!allowedFlows.has(flow) || !allowedLocations.has(location)) {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: 'Choose a notification from the website and use its Telegram button to subscribe.' })
    return
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(`INSERT INTO telegram_subscriptions (id, chat_id, username, location, flow, active, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now')) ON CONFLICT(chat_id, location, flow) DO UPDATE SET active = 1, username = excluded.username`).bind(id, chatId, message.from?.username || '', location, flow).run()
  await telegram(env, 'sendMessage', { chat_id: chatId, text: `You are subscribed to Migri ${location} alerts. We will message you when a new time appears. Send /stop to unsubscribe.` })
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
      if (request.headers.get('Authorization') !== `Bearer ${env.MONITOR_API_KEY}`) return json({ error: 'Unauthorized' }, 401)
      const { results } = await env.DB.prepare('SELECT chat_id, username, location, flow FROM telegram_subscriptions WHERE active = 1').all()
      return json(results)
    }

    if (url.pathname === '/public/stats' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT location, COUNT(DISTINCT chat_id) AS watchers FROM telegram_subscriptions WHERE active = 1 GROUP BY location').all()
      const counts = Object.fromEntries(results.map((row) => [row.location, Number(row.watchers)]))
      return json({ locations: Object.keys(locations).map((location) => ({ location, watchers: counts[location] || 0 })), total: Object.values(counts).reduce((sum, count) => sum + count, 0) }, 200, origin)
    }

    return json({ service: 'Migri Telegram notification service', status: 'ok' }, 200, origin)
  }
}
