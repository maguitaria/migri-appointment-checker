const statusText = document.querySelector('#runner-status')
const lastCheckedText = document.querySelector('#last-checked')
const subscribeForm = document.querySelector('#subscribe-form')
const formMessage = document.querySelector('#form-message')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

fetch(`state.json?ts=${Date.now()}`)
  .then((response) => (response.ok ? response.json() : null))
  .then((state) => {
    if (!state) return
    if (statusText) statusText.textContent = state.status === 'ok' ? 'Runner online' : 'Runner needs attention'
    if (lastCheckedText && state.checkedAt) lastCheckedText.textContent = `Last checked ${new Date(state.checkedAt).toLocaleString()}`
    const slotList = document.querySelector('#slot-list')
    const slots = state.availableSlots || []
    if (slotList) slotList.innerHTML = slots.length ? slots.map(({ location, date, time, flow }) => `<li><b>${escapeHtml(date || 'Date pending')} · ${escapeHtml(time)}</b><span>${escapeHtml(location)} · ${escapeHtml(flow || 'Reason pending')}</span></li>`).join('') : '<li class="empty-slot">No times visible in the latest check.</li>'
  })
  .catch(() => {})

subscribeForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const bot = window.MIGRI_CONFIG?.TELEGRAM_BOT_USERNAME
  if (!bot || bot.includes('REPLACE_WITH')) {
    if (formMessage) formMessage.textContent = 'The Telegram bot is not connected yet. Add its username in config.js.'
    return
  }
  const location = subscribeForm.location.value
  window.open(`https://t.me/${bot}?start=${encodeURIComponent(location)}`, '_blank', 'noopener,noreferrer')
  if (formMessage) formMessage.textContent = 'Telegram opened. Press Start. The bot should immediately confirm your alert.'
})
