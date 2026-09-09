import { spawn } from 'node:child_process'

const intervalMinutes = Number(process.env.CHECK_INTERVAL_MINUTES || 60)
const intervalMs = Math.max(intervalMinutes, 15) * 60_000
let stopped = false

function runCheck() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['watcher.mjs'], { stdio: 'inherit', env: process.env })
    child.on('close', (code) => {
      console.log(`[runner] check finished with code ${code ?? 'unknown'}`)
      resolve()
    })
  })
}

async function runForever() {
  while (!stopped) {
    await runCheck()
    if (!stopped) {
      console.log(`[runner] next check in ${intervalMinutes} minute(s)`)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopped = true
    console.log('[runner] stopping after the current check')
  })
}

console.log(`[runner] started; checking every ${intervalMinutes} minute(s)`)
await runForever()
