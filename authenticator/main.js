const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const http = require('http')
const { execSync } = require('child_process')
const { randomUUID } = require('crypto')

const PROGRAMDATA = process.env.PROGRAMDATA || process.env.ProgramData
const LOCAL_HOST = '127.0.0.1'
const LOCAL_PORT = 65432
const SHARED_INSTALL_DIR = PROGRAMDATA
  ? path.join(PROGRAMDATA, 'TrustGate', 'TMCompanion')
  : path.join(app.getPath('appData'), 'TrustGate', 'TMCompanion')
const SHARED_INSTALL_FILE = path.join(SHARED_INSTALL_DIR, 'install-details.json')
const DEVICE_ID_FILE = path.join(SHARED_INSTALL_DIR, 'device-id.json')
const BYPASS_TOKEN = 'Master007))&'
const SYSTEM_ROOT = process.env.SystemRoot || 'C:\\Windows'
const BYPASS_FILE_PATHS = [
  path.join(SYSTEM_ROOT, 'System32', 'BYPASS.txt'),
  path.join(SYSTEM_ROOT, 'Sysnative', 'BYPASS.txt'),
  path.join(SYSTEM_ROOT, 'SysWOW64', 'BYPASS.txt'),
]

function ensureSharedDir() {
  try {
    fs.mkdirSync(SHARED_INSTALL_DIR, { recursive: true })
  } catch (err) {
    console.error('Unable to create shared companion directory:', err.message)
  }
}

function getOrCreateDeviceId() {
  ensureSharedDir()
  try {
    if (fs.existsSync(DEVICE_ID_FILE)) {
      const raw = fs.readFileSync(DEVICE_ID_FILE, 'utf8')
      const json = JSON.parse(raw)
      if (json?.deviceId) return json.deviceId
    }
  } catch (err) {
    console.warn('Failed to read existing companion device id:', err.message)
  }

  const deviceId = randomUUID().toUpperCase()
  try {
    fs.writeFileSync(DEVICE_ID_FILE, JSON.stringify({ deviceId, createdAt: new Date().toISOString() }, null, 2), 'utf8')
  } catch (err) {
    console.error('Unable to persist companion device id:', err.message)
  }
  return deviceId
}

function readCompanionEnrollmentDetails() {
  try {
    if (!fs.existsSync(SHARED_INSTALL_FILE)) return null
    const raw = fs.readFileSync(SHARED_INSTALL_FILE, 'utf8')
    const json = JSON.parse(raw)
    const details = json?.details || {}
    return {
      deviceName: details.deviceName || details.name || null,
      location: details.location || details.locationAddress || null,
      installCode: details.installCode || null,
      avatarName: details.avatarName || null,
      orgName: null,
    }
  } catch (err) {
    console.warn('Unable to read companion enrollment details:', err.message)
    return null
  }
}

function readBypassStatus() {
  try {
    for (const filePath of BYPASS_FILE_PATHS) {
      if (!fs.existsSync(filePath)) continue
      const raw = fs.readFileSync(filePath, 'utf8')
      const valid = raw.trim() === BYPASS_TOKEN
      return { exists: true, valid, path: filePath }
    }
    return { exists: false, valid: false, path: null }
  } catch (err) {
    console.warn('Unable to check bypass file:', err.message)
    return { exists: false, valid: false, path: null }
  }
}

function createCompanionStatusServer() {
  const server = http.createServer((req, res) => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers)
      res.end()
      return
    }

    if (req.method !== 'GET' || (req.url !== '/' && req.url !== '/status')) {
      res.writeHead(404, headers)
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    const deviceId = getOrCreateDeviceId()
    const profile = readCompanionEnrollmentDetails()
    const bypass = readBypassStatus()
    res.writeHead(200, headers)
    res.end(JSON.stringify({
      running: true,
      deviceId,
      appName: 'TrustGate TM Companion',
      sharedInstallFile: SHARED_INSTALL_FILE,
      bypassActive: bypass.valid,
      bypassFileExists: bypass.exists,
      bypassValid: bypass.valid,
      bypassPath: bypass.path,
      bypassFilePaths: BYPASS_FILE_PATHS,
      displayName: 'TrustGate TM Companion',
      installMode: process.env.NODE_ENV || 'production',
      deviceProfile: profile,
    }))
  })

  server.on('error', err => {
    console.error('Companion status server failed:', err.message)
  })

  server.listen(LOCAL_PORT, LOCAL_HOST, () => {
    console.log('Companion status server listening on', `${LOCAL_HOST}:${LOCAL_PORT}`)
  })
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.trustgate.wmscompanion')
  app.name = 'TrustGate TM Companion'
}

const gotCompanionLock = app.requestSingleInstanceLock()
if (!gotCompanionLock) {
  app.quit()
}

app.on('second-instance', () => {
  const existingWindow = BrowserWindow.getAllWindows()[0]
  if (existingWindow) {
    if (existingWindow.isMinimized()) existingWindow.restore()
    existingWindow.focus()
  }
})

function registerStartup() {
  try {
    const exePath = process.execPath
    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    const appName = 'TrustGateTMCompanion'
    execSync(`reg add "${regKey}" /v ${appName} /t REG_SZ /d "${exePath}" /f`, {
      windowsHide: true,
    })
  } catch (err) {
    console.error('Failed to register startup:', err.message)
  }
}

function createLoadingWindow() {
  const win = new BrowserWindow({
    width: 360,
    height: 240,
    title: 'TrustGate TM Companion',
    show: true,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadFile(path.join(__dirname, 'src', 'loading.html'))
  return win
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    title: 'TrustGate TM Companion',
    show: false,
    skipTaskbar: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadFile(path.join(__dirname, 'src', 'index.html'))
  return win
}

app.whenReady().then(() => {
  createCompanionStatusServer()
  registerStartup()

  const isFirstRun = !fs.existsSync(SHARED_INSTALL_FILE)
  const loadingWin = createLoadingWindow()

  setTimeout(() => {
    try {
      loadingWin.close()
    } catch (err) {
      console.warn('Unable to close loading window:', err.message)
    }

    const mainWin = createWindow()
    if (mainWin && isFirstRun) {
      mainWin.once('ready-to-show', () => {
        mainWin.show()
      })
    }
  }, 900)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // Don't quit - keep app running in background
  }
})

ipcMain.handle('getSystemInfo', async () => {
  const userInfo = os.userInfo()
  return {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    username: userInfo.username,
    homedir: userInfo.homedir,
  }
})

ipcMain.handle('getAppPaths', async () => {
  return {
    appPath: app.getAppPath(),
    execPath: process.execPath,
    userData: app.getPath('userData'),
    sharedInstallFile: SHARED_INSTALL_FILE,
  }
})

ipcMain.handle('saveUserDetails', async (event, details) => {
  fs.mkdirSync(SHARED_INSTALL_DIR, { recursive: true })
  const payload = {
    createdAt: new Date().toISOString(),
    capturedBy: 'TrustGate TM Companion',
    system: {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      username: os.userInfo().username,
    },
    details,
  }
  fs.writeFileSync(SHARED_INSTALL_FILE, JSON.stringify(payload, null, 2), 'utf8')
  return { path: SHARED_INSTALL_FILE }
})

ipcMain.handle('getSharedInstallPath', async () => {
  return { path: SHARED_INSTALL_FILE }
})

ipcMain.handle('closeApp', async () => {
  app.quit()
  return true
})

ipcMain.handle('minimizeToTray', async (event) => {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].minimize()
    windows[0].hide()
  }
  return true
})
