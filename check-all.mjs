import { spawn } from 'node:child_process'

const scripts = ['watcher.mjs', 'passport-watcher.mjs']
let failed = false

for (const script of scripts) {
  await new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit', env: process.env })
    child.on('close', (code) => {
      if (code) failed = true
      resolve()
    })
  })
}

if (failed) process.exitCode = 1
