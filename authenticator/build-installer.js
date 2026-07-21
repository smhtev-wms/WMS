const packager = require('electron-packager')
const path = require('path')
const fs = require('fs')
const electronWinstaller = require('electron-winstaller')

async function buildInstaller() {
  const appDir = path.resolve(__dirname)
  const outDir = path.join(appDir, 'dist', 'packaged')
  const setupDir = path.join(appDir, 'dist', 'installer')

  fs.rmSync(setupDir, { recursive: true, force: true })
  fs.mkdirSync(setupDir, { recursive: true })

  const appPaths = await packager({
    dir: appDir,
    arch: 'x64',
    platform: 'win32',
    out: outDir,
    overwrite: true,
    asar: false,
    prune: false,
    executableName: 'TrustGateTMCompanion',
    name: 'TrustGateTMCompanion',
    appVersion: '0.1.0',
    icon: undefined,
    ignore: [/dist/, /node_modules/, /build-installer\.js/],
  })

  if (appPaths.length === 0) {
    throw new Error('No packaged app found')
  }

  const target = appPaths[0]
  const appRoot = path.join(target, 'resources', 'app')
  const installRoot = path.join(target)

  fs.copyFileSync(path.join(appDir, 'uninstall.ps1'), path.join(installRoot, 'uninstall.ps1'))
  fs.copyFileSync(path.join(appDir, 'uninstall.ps1'), path.join(appRoot, 'uninstall.ps1'))

  await electronWinstaller.createWindowsInstaller({
    appDirectory: target,
    outputDirectory: setupDir,
    authors: 'TrustGate',
    exe: 'TrustGateTMCompanion.exe',
    setupExe: 'TrustGate - Setup.exe',
    title: 'TrustGate TM Companion',
    description: 'TrustGate TM Companion app for WMS enrollment and install validation.',
    setupIcon: undefined,
    noMsi: true,
    createDesktopShortcut: false,
    createStartMenuShortcut: false,
    noRegistry: false,
    runAfterFinish: false,
  })

  console.log('Installer generated at:', path.join(setupDir, 'TrustGateTMCompanion-Setup.exe'))
}

buildInstaller().catch((error) => {
  console.error(error)
  process.exit(1)
})


