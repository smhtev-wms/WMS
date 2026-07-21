@echo off
REM WMS-GitPush.bat
REM Initializes git if needed, sets remote, commits, and pushes to GitHub.
cd /d "%~dp0"
echo === WMS Git Push Script ===

REM Ensure Git is available
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git is not installed or not available in PATH.
  pause
  exit /b 1
)

REM Initialize repository if needed
if not exist .git (
  echo Initializing git repository...
  git init
)

REM Ensure git identity is configured (needed before first commit)
git config user.email >nul 2>&1
if errorlevel 1 (
  echo Git user identity not set. Configuring default identity...
  git config --global user.email "smhtevwms@gmail.com"
  git config --global user.name "Sakthi Murugan High Tech Engineering"
)

REM Set remote origin if missing
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Adding origin remote...
  git remote add origin https://github.com/smhtev-wms/WMS.git
) else (
  echo Origin remote already configured.
)

REM Add files and stage changes
git add .

REM Make sure HEAD is on main before first commit
git symbolic-ref HEAD refs/heads/main >nul 2>&1

REM Commit only if there are staged changes
git diff --cached --quiet --exit-code
if errorlevel 1 (
  echo Committing changes...
  git commit -m "Initial commit"
) else (
  echo No staged changes to commit.
)

REM Push to GitHub, but only if there's at least one commit
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
  echo No commits exist yet - nothing to push.
) else (
  echo Pushing to GitHub...
  git push -u origin main
)

echo.
echo Done. If the push requires authentication, follow GitHub's prompts.
pause