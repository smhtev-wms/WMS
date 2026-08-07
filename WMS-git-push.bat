@echo off
REM git-push-all.bat — Stage, commit and push current branch
REM Usage: git-push-all.bat "your commit message"

setlocal enabledelayedexpansion

:: Use the script directory as working dir (assumes script is in repo root)
pushd "%~dp0"

:: Commit message (use all args joined)
if "%~1"=="" (
  set "MSG=chore: workspace changes %DATE% %TIME%"
) else (
  set "MSG=%*"
)

:: Check for changes
set "CHANGED="
for /f "usebackq delims=" %%A in (`git status --porcelain`) do set "CHANGED=1"
if not defined CHANGED (
  echo No changes to commit. Running git pull && git push to ensure up-to-date.
  git pull --ff-only
  for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
  git push origin %BRANCH%
  popd
  exit /b 0
)

:: Stage all changes
echo Staging all changes...
git add -A

:: Commit
echo Committing: %MSG%
git commit -m "%MSG%"
if errorlevel 1 (
  echo Commit failed (maybe nothing to commit or commit hook failed). Aborting.
  popd
  exit /b 1
)

:: Get current branch
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo Pushing to origin/%BRANCH%...
git push origin %BRANCH%

:: Return to original dir
popd

endlocal
echo Done.
