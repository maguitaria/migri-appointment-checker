const form = document.querySelector('#checker-form')
const result = document.querySelector('#result')
const applicantSelect = document.querySelector('#applicants')
const resultFooter = result?.querySelector('footer')
const statusText = document.querySelector('#runner-status')
const lastCheckedText = document.querySelector('#last-checked')
const subscribeForm = document.querySelector('#subscribe-form')
const formMessage = document.querySelector('#form-message')

form?.addEventListener('submit', (event) => {
  event.preventDefault()
  result?.classList.add('flash')
  window.setTimeout(() => result?.classList.remove('flash'), 850)
  result?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

applicantSelect?.addEventListener('change', () => {
  if (resultFooter) {
    const count = applicantSelect.value.startsWith('Family') ? 'family appointment' : '1 person'
    resultFooter.firstChild.textContent = `Result for Oulu · ${count} `
  }
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
  const apiUrl = window.MIGRI_CONFIG?.API_URL
  if (!apiUrl || apiUrl.includes('REPLACE_WITH')) {
    if (formMessage) formMessage.textContent = 'The service is not connected yet. Add the worker URL in config.js.'
    return
  }
  const button = subscribeForm.querySelector('button')
  if (button) button.disabled = true
  try {
    const response = await fetch(`${apiUrl}/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: subscribeForm.email.value, location: subscribeForm.location.value, flow: subscribeForm.flow.value }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Could not subscribe')
    subscribeForm.reset()
    if (formMessage) formMessage.textContent = result.message
  } catch (error) {
    if (formMessage) formMessage.textContent = error.message
  } finally {
    if (button) button.disabled = false
  }
})
