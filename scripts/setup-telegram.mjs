const workerUrl = (process.env.SUBSCRIPTION_API_URL || '').replace(/\/$/, '')
const monitorKey = process.env.MONITOR_API_KEY

if (!workerUrl) throw new Error('Set SUBSCRIPTION_API_URL in .env')
if (!monitorKey) throw new Error('Set MONITOR_API_KEY in .env')

const headers = { Authorization: `Bearer ${monitorKey}` }
const setup = await fetch(`${workerUrl}/internal/telegram/setup`, { method: 'POST', headers })
console.log('Setup:', await setup.text())
if (!setup.ok) process.exitCode = 1

const status = await fetch(`${workerUrl}/internal/telegram/status`, { headers })
console.log('Status:', await status.text())
if (!status.ok) process.exitCode = 1
