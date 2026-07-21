@echo off
REM WMS-InitGit.bat
REM Initialize Git repository in the current project folder.

cd /d "%~dp0"

echo === WMS Initialize Git ===

git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed or not available in PATH.
  pause
  exit /b 1
)

if exist .git (
  echo Git repository already exists.
) else (
  echo Initializing git repository...
  git init
  echo Created .git directory.
)

echo.
echo Done.
pause
