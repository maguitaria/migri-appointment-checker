const form = document.querySelector('#checker-form')
const result = document.querySelector('#result')
const applicantSelect = document.querySelector('#applicants')
const resultFooter = result?.querySelector('footer')
const statusText = document.querySelector('#runner-status')
const lastCheckedText = document.querySelector('#last-checked')

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
