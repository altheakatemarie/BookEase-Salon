@echo off
cd /d "%~dp0"
echo Starting BookEase Salon...
echo Open http://127.0.0.1:5180 after Vite says ready.
call npm run dev
pause
