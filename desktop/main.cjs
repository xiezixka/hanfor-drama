const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const net = require('net')
const path = require('path')

let mainWindow = null
let serverProcess = null
let serverPort = Number(process.env.HANFOR_PORT || 5679)

function resourcesRoot() {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..')
}

function copyDirectoryIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(source, target, { recursive: true })
}

function ensureWritableFolders() {
  const userData = app.getPath('userData')
  const dataRoot = path.join(userData, 'data')
  const staticRoot = path.join(dataRoot, 'static')
  const skillsRoot = path.join(userData, 'skills')
  fs.mkdirSync(staticRoot, { recursive: true })
  copyDirectoryIfMissing(path.join(resourcesRoot(), 'skills'), skillsRoot)
  return { userData, dataRoot, staticRoot, skillsRoot }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(false))
    tester.once('listening', () => {
      tester.close(() => resolve(true))
    })
    tester.listen(port, '127.0.0.1')
  })
}

async function findPort(start) {
  for (let port = start; port < start + 40; port += 1) {
    if (await checkPort(port)) return port
  }
  return 0
}

function waitForHealth(port, timeoutMs = 20000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/v1/health`, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })
      req.on('error', retry)
      req.setTimeout(1200, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('本地服务启动超时'))
        return
      }
      setTimeout(tick, 450)
    }
    tick()
  })
}

function resolveFfmpegPath() {
  try {
    const ffmpegPath = require('ffmpeg-static')
    return ffmpegPath && fs.existsSync(ffmpegPath) ? ffmpegPath : ''
  } catch {
    return ''
  }
}

async function startBackend() {
  const root = resourcesRoot()
  const folders = ensureWritableFolders()
  serverPort = await findPort(serverPort)
  if (!serverPort) throw new Error('没有找到可用端口')

  const backendEntry = path.join(root, 'backend', 'dist', 'index.js')
  const frontendDist = app.isPackaged
    ? path.join(root, 'frontend', 'dist')
    : path.join(root, 'frontend', '.output', 'public')
  if (!fs.existsSync(backendEntry)) throw new Error(`找不到后端文件：${backendEntry}`)
  if (!fs.existsSync(frontendDist)) throw new Error(`找不到前端文件：${frontendDist}`)

  const ffmpegPath = resolveFfmpegPath()
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(serverPort),
    APP_ROOT: root,
    DATA_PATH: folders.dataRoot,
    DB_PATH: path.join(folders.dataRoot, 'huobao_drama.db'),
    STORAGE_PATH: folders.staticRoot,
    SKILLS_PATH: folders.skillsRoot,
    FRONTEND_DIST: frontendDist,
  }
  if (ffmpegPath) {
    env.FFMPEG_PATH = ffmpegPath
    env.PATH = `${path.dirname(ffmpegPath)}${path.delimiter}${env.PATH || ''}`
  }

  serverProcess = spawn(process.execPath, [backendEntry], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess.stdout.on('data', (chunk) => console.log(`[server] ${chunk}`))
  serverProcess.stderr.on('data', (chunk) => console.error(`[server] ${chunk}`))
  serverProcess.on('exit', (code) => {
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox('涵锋AI服务已停止', `本地服务退出，代码：${code}`)
    }
  })

  await waitForHealth(serverPort)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: '涵锋AI',
    backgroundColor: '#F3F6FB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.removeMenu()
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`)
}

app.whenReady().then(async () => {
  try {
    await startBackend()
    createWindow()
  } catch (error) {
    dialog.showErrorBox('涵锋AI启动失败', error instanceof Error ? error.message : String(error))
    app.quit()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill()
})
