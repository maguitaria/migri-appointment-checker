const form = document.querySelector('#checker-form')
const result = document.querySelector('#result')
const applicantSelect = document.querySelector('#applicants')
const resultFooter = result?.querySelector('footer')
const statusText = document.querySelector('#runner-status')
const lastCheckedText = document.querySelector('#last-checked')
const subscribeForm = document.querySelector('#subscribe-form')
const formMessage = document.querySelector('#form-message')
const watcherSummary = document.querySelector('#watcher-summary')

form?.addEventListener('submit', (event) => {
  event.preventDefault()
  result?.classList.add('flash')
  window.setTimeout(() => result?.classList.remove('flash'), 850)
  result?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

applicantSelect?.addEventListener('change', () => {
  if (resultFooter) {
    const count = applicantSelect.value.startsWith('Family') ? 'family appointment' : '1 person'
    const location = document.querySelector('#office')?.value?.split(' · ')[0] || 'selected service point'
    resultFooter.firstChild.textContent = `Result for ${location} · ${count} `
  }
})

document.querySelector('#office')?.addEventListener('change', (event) => {
  const location = event.target.value.split(' · ')[0]
  const selected = document.querySelector('.selected b')
  if (selected) selected.textContent = `${location} selected`
})

fetch(`state.json?ts=${Date.now()}`)
  .then((response) => (response.ok ? response.json() : null))
  .then((state) => {
    if (!state) return
    if (statusText) statusText.textContent = state.status === 'ok' ? 'Runner online' : 'Runner needs attention'
    if (lastCheckedText && state.checkedAt) lastCheckedText.textContent = `Last checked ${new Date(state.checkedAt).toLocaleString()}`
    const heading = result?.querySelector('h2')
    const copy = result?.querySelector('p')
    if (state.slots?.length && heading && copy) {
      heading.textContent = `${state.slots.length} time${state.slots.length === 1 ? '' : 's'} visible`
      copy.textContent = `${state.slots.join(', ')}. Open Migri now to complete the booking manually.`
      result?.classList.add('has-slots')
    }
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
  const flow = subscribeForm.flow.value
  window.open(`https://t.me/${bot}?start=${encodeURIComponent(`${location}:${flow}`)}`, '_blank', 'noopener,noreferrer')
  if (formMessage) formMessage.textContent = 'Telegram opened. Press Start in the bot to activate alerts.'
})

fetch(`${window.MIGRI_CONFIG?.API_URL || ''}/public/stats?ts=${Date.now()}`)
  .then((response) => (response.ok ? response.json() : null))
  .then((stats) => {
    if (!stats || !watcherSummary) return
    const total = Number(stats.total || 0)
    watcherSummary.textContent = `${total} ${total === 1 ? 'person is' : 'people are'} currently watching these locations`
    for (const item of stats.locations || []) {
      const element = document.querySelector(`[data-watchers="${item.location}"]`)
      if (element) element.textContent = `${item.watchers} watching`
    }
  })
  .catch(() => {
    if (watcherSummary) watcherSummary.textContent = 'Watcher counts will appear when the notification service is online'
  })
