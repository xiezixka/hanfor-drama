import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`)
  }
}

function assertPath(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(`${label} 不存在：${target}`)
  }
}

run('npm', ['run', 'generate'], path.join(root, 'frontend'))
run('npm', ['run', 'build'], path.join(root, 'backend'))

assertPath(path.join(root, 'frontend', '.output', 'public', 'index.html'), '前端静态文件')
assertPath(path.join(root, 'backend', 'dist', 'index.js'), '后端编译文件')
assertPath(path.join(root, 'backend', 'node_modules'), '后端依赖')

console.log('桌面应用打包素材准备完成。')
