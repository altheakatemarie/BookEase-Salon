@echo off
cd /d "%~dp0"
echo =======================================
echo  BookEase Salon - First-time Setup
 echo =======================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 24 LTS, then open this again.
  pause
  exit /b 1
)
call npm run install:all
if errorlevel 1 (
  echo Installation failed. Check the messages above.
  pause
  exit /b 1
)
call npm run dev
pause
