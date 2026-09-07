const allowedFlows = new Set(['residence_work', 'residence_family', 'residence_study', 'residence_permanent'])
const allowedLocations = new Set(['Oulu'])

function headers(origin = '*') {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' }
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.SITE_ORIGIN || '*'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) })

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const { email, location, flow } = await request.json().catch(() => ({}))
      if (!/^\S+@\S+\.\S+$/.test(email || '') || !allowedFlows.has(flow) || !allowedLocations.has(location)) return json({ error: 'Enter a valid email, location, and supported service.' }, 400, origin)
      const id = crypto.randomUUID()
      const token = crypto.randomUUID()
      await env.DB.prepare(`INSERT INTO subscriptions (id, email, location, flow, token, active, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now')) ON CONFLICT(email, location, flow) DO UPDATE SET active = 1`).bind(id, email.trim().toLowerCase(), location, flow, token).run()
      return json({ ok: true, message: 'You are subscribed. We will email you when a new Oulu time appears.' }, 201, origin)
    }

    if (url.pathname === '/unsubscribe' && request.method === 'GET') {
      const token = url.searchParams.get('token')
      if (token) await env.DB.prepare('UPDATE subscriptions SET active = 0 WHERE token = ?').bind(token).run()
      return new Response('<h1>Unsubscribed</h1><p>You will no longer receive Migri alerts.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    if (url.pathname === '/internal/subscriptions' && request.method === 'GET') {
      if (request.headers.get('Authorization') !== `Bearer ${env.MONITOR_API_KEY}`) return json({ error: 'Unauthorized' }, 401)
      const { results } = await env.DB.prepare('SELECT email, location, flow, token FROM subscriptions WHERE active = 1').all()
      return json(results)
    }

    return json({ service: 'Migri notification service', status: 'ok' }, 200, origin)
  }
}
