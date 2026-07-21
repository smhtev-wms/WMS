# Zion Solutions WMS Companion

A Windows companion app scaffold for the Zion Solutions WMS authorization workflow.

## Setup

1. Open PowerShell in `c:\Projects\WMS`
2. Run `npm install`
3. Run `npm start` to launch the app in development mode

## Build

- `npm run dist` builds a Windows installer (`setup.exe`) into `dist\`

## Notes

- The installer is configured to install per-machine.
- It will not create desktop or Start menu shortcuts.
- After installation, the app will launch automatically.

## App behavior

- Captures system details and enrollment information.
- Saves user details to the Electron `userData` path.
- Intended for secure device enrollment and companion app deployment.
