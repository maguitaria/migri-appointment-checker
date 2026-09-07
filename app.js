const form = document.querySelector('#checker-form')
const result = document.querySelector('#result')
const applicantSelect = document.querySelector('#applicants')
const resultFooter = result?.querySelector('footer')

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
