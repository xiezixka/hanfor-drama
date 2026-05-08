import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const shimDir = path.join(root, '.tmp', 'mac-build-bin')
fs.mkdirSync(shimDir, { recursive: true })

const bundledPython = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3')
const pythonCommand = process.env.MAC_BUILD_PYTHON || (fs.existsSync(bundledPython) ? bundledPython : 'python3')
const pythonShim = path.join(shimDir, 'python')
fs.writeFileSync(
  pythonShim,
  `#!/bin/sh\nexec "${pythonCommand}" "$@"\n`,
  'utf8',
)
fs.chmodSync(pythonShim, 0o755)

const electronBuilder = path.join(root, 'node_modules', '.bin', 'electron-builder')
const result = spawnSync(electronBuilder, ['--mac', 'dmg', '--arm64', '--publish', 'never'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${shimDir}${path.delimiter}${process.env.PATH || ''}`,
  },
})

if (result.status !== 0) process.exit(result.status || 1)
