@echo off
chcp 65001 >nul
rem Lance Coda Bureau (Windows). Necessite Node.js : https://nodejs.org
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js est necessaire. Installez la version LTS : https://nodejs.org & pause & exit /b 1)
if not exist node_modules\electron (
  echo Premiere installation, environ 100 Mo, une seule fois...
  call npm install --no-fund --no-audit || (pause & exit /b 1)
)
call npm start
