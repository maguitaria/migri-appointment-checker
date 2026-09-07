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
const bookingUrl = 'https://migri.vihta.com/public/migri/#/home'
const authorityUrls = {
  en: 'https://migri.fi/en',
  fi: 'https://migri.fi/etusivu',
  ru: 'https://migri.fi/en',
  uk: 'https://migri.fi/uk/titul-na-storinka-sajtu'
}
const flowLabels = {
  fi: {
    'Residence permit · Work': 'Oleskelulupa · työ',
    'Residence permit · Family': 'Oleskelulupa · perhe',
    'Residence permit · Study': 'Oleskelulupa · opiskelu',
    'Residence permit · Permanent': 'Oleskelulupa · pysyvä'
  },
  ru: {
    'Residence permit · Work': 'ВНЖ · работа',
    'Residence permit · Family': 'ВНЖ · семья',
    'Residence permit · Study': 'ВНЖ · учёба',
    'Residence permit · Permanent': 'ВНЖ · постоянное проживание'
  },
  uk: {
    'Residence permit · Work': 'Посвідка на проживання · робота',
    'Residence permit · Family': 'Посвідка на проживання · сімʼя',
    'Residence permit · Study': 'Посвідка на проживання · навчання',
    'Residence permit · Permanent': 'Посвідка на проживання · постійне проживання'
  }
}
const messages = {
  en: {
    stopped: 'Migri alerts stopped. Send /start to subscribe again.',
    invalid: 'Choose a location on the website and press its Telegram button.',
    subscribed: (location) => `You are subscribed to all Migri appointment times in ${location}. I will send newly detected times automatically.`,
    currentTitle: (location) => `Current Migri times in ${location}`,
    currentCount: (count) => count ? `Found ${count} available time${count === 1 ? '' : 's'}.` : 'No available times are visible in the latest check.',
    currentMore: (url) => `Full paginated list: ${url}`,
    currentLink: (url) => `See the current list: ${url}`,
    currentFuture: 'Future messages are sent when a newly detected time appears.',
    unavailable: 'Your alert is active. I could not load the current slot list right now; future new slots will still be sent.',
    status: (list) => `Your active Migri alerts:\n${list}\n\nThe checker runs every 15 minutes. Use /stop to unsubscribe.`,
    help: (authority) => `How Migri alerts work:\n1. Choose a location on the website.\n2. Press the Telegram button and Start.\n3. You receive current available times first.\n4. New times are checked every 15 minutes.\n5. Open Migri and complete the booking yourself; this bot never reserves an appointment.\n\nOfficial Migri authority: ${authority}\nOfficial booking service: ${bookingUrl}\n\n/status — active locations\n/stop — stop alerts\n/help — show instructions.`
  },
  fi: {
    stopped: 'Migri-ilmoitukset on lopetettu. Lähetä /start tilataksesi ilmoitukset uudelleen.',
    invalid: 'Valitse palvelupiste verkkosivustolta ja paina sen Telegram-painiketta.',
    subscribed: (location) => `Olet tilannut kaikki Migri-ajat sijainnissa ${location}. Lähetän automaattisesti uudet löydetyt ajat.`,
    currentTitle: (location) => `Migri-ajat sijainnissa ${location}`,
    currentCount: (count) => count ? `Löytyi ${count} vapaata aikaa.` : 'Viimeisimmässä tarkistuksessa ei näkynyt vapaita aikoja.',
    currentMore: (url) => `Kaikki ajat sivuston sivutuksessa: ${url}`,
    currentLink: (url) => `Katso ajantasainen lista: ${url}`,
    currentFuture: 'Saat uuden ilmoituksen, kun järjestelmä löytää uuden ajan.',
    unavailable: 'Ilmoitus on aktiivinen. Nykyisiä aikoja ei voitu ladata juuri nyt, mutta uudet ajat ilmoitetaan edelleen.',
    status: (list) => `Aktiiviset Migri-ilmoituksesi:\n${list}\n\nTarkistus tehdään 15 minuutin välein. Lopeta /stop-komennolla.`,
    help: (authority) => `Näin Migri-ilmoitukset toimivat:\n1. Valitse palvelupiste verkkosivustolta.\n2. Paina Telegram-painiketta ja Start.\n3. Saat ensin tällä hetkellä vapaat ajat.\n4. Uudet ajat tarkistetaan 15 minuutin välein.\n5. Avaa Migri ja tee varaus itse; botti ei varaa aikaa puolestasi.\n\nMigri-viranomaisen sivu: ${authority}\nVirallinen ajanvaraus: ${bookingUrl}\n\n/status — aktiiviset palvelupisteet\n/stop — lopeta ilmoitukset\n/help — näytä ohjeet.`
  },
  ru: {
    stopped: 'Уведомления Migri остановлены. Отправьте /start, чтобы подписаться снова.',
    invalid: 'Выберите место обслуживания на сайте и нажмите кнопку Telegram.',
    subscribed: (location) => `Вы подписались на все доступные записи Migri в городе ${location}. Я буду автоматически отправлять новые найденные времена.`,
    currentTitle: (location) => `Текущие записи Migri: ${location}`,
    currentCount: (count) => count ? `Найдено доступных записей: ${count}.` : 'В последней проверке доступных записей не найдено.',
    currentMore: (url) => `Полный список с разбивкой по страницам: ${url}`,
    currentLink: (url) => `Открыть текущий список: ${url}`,
    currentFuture: 'Новое сообщение будет отправлено, когда появится новое найденное время.',
    unavailable: 'Подписка активна. Сейчас не удалось загрузить список, но новые найденные времена будут отправлены.',
    status: (list) => `Ваши активные уведомления Migri:\n${list}\n\nПроверка выполняется каждые 15 минут. Для отмены используйте /stop.`,
    help: (authority) => `Как работают уведомления Migri:\n1. Выберите место обслуживания на сайте.\n2. Нажмите кнопку Telegram и Start.\n3. Сначала вы получите уже доступные времена.\n4. Новые времена проверяются каждые 15 минут.\n5. Откройте Migri и завершите запись самостоятельно; бот не бронирует время за вас.\n\nОфициальный сайт Migri: ${authority}\nОфициальная система записи: ${bookingUrl}\n\n/status — активные места\n/stop — остановить уведомления\n/help — показать инструкцию.`
  },
  uk: {
    stopped: 'Сповіщення Migri вимкнено. Надішліть /start, щоб підписатися знову.',
    invalid: 'Виберіть місце обслуговування на сайті та натисніть кнопку Telegram.',
    subscribed: (location) => `Ви підписалися на всі доступні записи Migri у місті ${location}. Я автоматично надсилатиму нові знайдені часи.`,
    currentTitle: (location) => `Поточні записи Migri: ${location}`,
    currentCount: (count) => count ? `Знайдено доступних записів: ${count}.` : 'Під час останньої перевірки доступних записів не знайдено.',
    currentMore: (url) => `Повний список зі сторінками: ${url}`,
    currentLink: (url) => `Відкрити поточний список: ${url}`,
    currentFuture: 'Нове повідомлення буде надіслано, коли зʼявиться новий знайдений час.',
    unavailable: 'Підписка активна. Зараз не вдалося завантажити список, але нові знайдені часи все одно буде надіслано.',
    status: (list) => `Ваші активні сповіщення Migri:\n${list}\n\nПеревірка виконується кожні 15 хвилин. Для скасування використовуйте /stop.`,
    help: (authority) => `Як працюють сповіщення Migri:\n1. Виберіть місце обслуговування на сайті.\n2. Натисніть кнопку Telegram і Start.\n3. Спочатку ви отримаєте вже доступні часи.\n4. Нові часи перевіряються кожні 15 хвилин.\n5. Відкрийте Migri та завершіть запис самостійно; бот не бронює час замість вас.\n\nОфіційний сайт Migri: ${authority}\nОфіційна система запису: ${bookingUrl}\n\n/status — активні місця\n/stop — зупинити сповіщення\n/help — показати інструкцію.`
  }
}

function languageFor(message) {
  const language = String(message.from?.language_code || '').toLowerCase()
  if (language.startsWith('fi')) return 'fi'
  if (language.startsWith('ru')) return 'ru'
  if (language.startsWith('uk')) return 'uk'
  return 'en'
}

function localizedFlow(flow, language) {
  return flowLabels[language]?.[flow] || flow
}

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

async function sendCurrentAvailability(env, chatId, location, language) {
  const copy = messages[language]
  try {
    const response = await fetch(`${publicSite}state.json?ts=${Date.now()}`)
    if (!response.ok) throw new Error(`state.json returned ${response.status}`)
    const state = await response.json()
    const slots = (state.availableSlots || []).filter((slot) => slot.location === location)
    const shown = slots.slice(0, 20)
    const lines = shown.map((slot) => `• ${slot.date} ${slot.time} — ${localizedFlow(slot.flow || 'Migri appointment', language)}`)
    const fullListUrl = `${publicSite}?location=${encodeURIComponent(location)}#slots`
    const text = [
      copy.currentTitle(location),
      '',
      copy.currentCount(slots.length),
      ...lines,
      '',
      slots.length > shown.length ? copy.currentMore(fullListUrl) : copy.currentLink(fullListUrl),
      copy.currentFuture,
      `Migri: ${authorityUrls[language]}`,
      `Booking: ${bookingUrl}`
    ].join('\n')
    await telegram(env, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
  } catch (error) {
    console.error(`Could not send current availability for ${location}:`, error)
    await telegram(env, 'sendMessage', { chat_id: chatId, text: copy.unavailable })
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
  const language = languageFor(message)
  const copy = messages[language]

  if (text.startsWith('/stop')) {
    await env.DB.prepare('UPDATE telegram_subscriptions SET active = 0 WHERE chat_id = ?').bind(chatId).run()
    await telegram(env, 'sendMessage', { chat_id: chatId, text: copy.stopped })
    return
  }

  if (text.startsWith('/help')) {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: copy.help(authorityUrls[language]) })
    return
  }

  if (text.startsWith('/status')) {
    const { results } = await env.DB.prepare('SELECT location FROM telegram_subscriptions WHERE chat_id = ? AND active = 1 ORDER BY location').bind(chatId).all()
    const locationsText = results.length ? results.map((row) => `• ${row.location}`).join('\n') : 'No active alerts.'
    await telegram(env, 'sendMessage', { chat_id: chatId, text: copy.status(locationsText) })
    return
  }

  if (!text.startsWith('/start')) return
  const payload = text.split(/\s+/)[1] || 'Oulu'
  const [location] = payload.split(':')
  const flow = 'all'
  if (!allowedLocations.has(location)) {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: copy.invalid })
    return
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(`INSERT INTO telegram_subscriptions (id, chat_id, username, location, flow, active, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now')) ON CONFLICT(chat_id, location, flow) DO UPDATE SET active = 1, username = excluded.username`).bind(id, chatId, message.from?.username || '', location, flow).run()
    await telegram(env, 'sendMessage', { chat_id: chatId, text: `${copy.subscribed(location)}\n\nMigri: ${authorityUrls[language]}\nBooking: ${bookingUrl}\n\nUse /help for instructions.` })
    await sendCurrentAvailability(env, chatId, location, language)
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
