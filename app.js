const statusText = document.querySelector('#runner-status')
const lastCheckedText = document.querySelector('#last-checked')
const subscribeForm = document.querySelector('#subscribe-form')
const formMessage = document.querySelector('#form-message')
const locationSelect = document.querySelector('#location')
const subscribeButton = document.querySelector('#subscribe-button')
const slotLocation = document.querySelector('#slot-location')
const previousPage = document.querySelector('#previous-page')
const nextPage = document.querySelector('#next-page')
const pageInfo = document.querySelector('#slot-page-info')
const pageNumber = document.querySelector('#slot-page-number')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const pageSize = 30
let allSlots = []
let page = 1

const requestedLocation = new URLSearchParams(window.location.search).get('location')
if (requestedLocation && slotLocation && [...slotLocation.options].some((option) => option.value === requestedLocation)) slotLocation.value = requestedLocation

function selectedLocationLabel() {
  return locationSelect?.selectedOptions?.[0]?.textContent?.split(' · ')[0] || 'location'
}

function updateSubscribeButton() {
  if (subscribeButton) subscribeButton.innerHTML = `Get ${escapeHtml(selectedLocationLabel())} alerts in Telegram <span>↗</span>`
}

function renderSlots() {
  const slotList = document.querySelector('#slot-list')
  if (!slotList) return
  const filtered = slotLocation?.value === 'all' ? allSlots : allSlots.filter((slot) => slot.location === slotLocation?.value)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  page = Math.min(page, pageCount)
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  slotList.innerHTML = visible.length ? visible.map(({ location, date, time, flow }) => `<li><b>${escapeHtml(date || 'Date pending')} · ${escapeHtml(time)}</b><span>${escapeHtml(location)} · ${escapeHtml(flow || 'Reason pending')}</span></li>`).join('') : '<li class="empty-slot">No slots in this selection.</li>'
  const first = filtered.length ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, filtered.length)
  if (pageInfo) pageInfo.textContent = filtered.length ? `Showing ${first}–${last} of ${filtered.length}` : '0 slots'
  if (pageNumber) pageNumber.textContent = filtered.length ? `Page ${page} of ${pageCount}` : ''
  if (previousPage) previousPage.disabled = page <= 1
  if (nextPage) nextPage.disabled = page >= pageCount
}

locationSelect?.addEventListener('change', updateSubscribeButton)
slotLocation?.addEventListener('change', () => { page = 1; renderSlots() })
previousPage?.addEventListener('click', () => { page -= 1; renderSlots() })
nextPage?.addEventListener('click', () => { page += 1; renderSlots() })
updateSubscribeButton()

fetch(`state.json?ts=${Date.now()}`)
  .then((response) => (response.ok ? response.json() : null))
  .then((state) => {
    if (!state) throw new Error('Slot data is unavailable')
    if (statusText) statusText.textContent = state.status === 'ok' ? 'Runner online' : 'Runner needs attention'
    if (lastCheckedText && state.checkedAt) lastCheckedText.textContent = `Last checked ${new Date(state.checkedAt).toLocaleString()}`
    allSlots = state.availableSlots || []
    renderSlots()
  })
  .catch(() => {
    if (statusText) statusText.textContent = 'Slot list unavailable'
    if (lastCheckedText) lastCheckedText.textContent = 'Open the deployed website to load the latest check'
    const slotList = document.querySelector('#slot-list')
    if (slotList) slotList.innerHTML = '<li class="empty-slot">The live slot list could not be loaded. Please open the GitHub Pages URL, not the local file.</li>'
  })

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
