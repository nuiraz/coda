@echo off
chcp 65001 >nul
rem Lance Coda en local sur http://localhost:8080 (Windows)
cd /d "%~dp0"
set PORT=8080
echo Coda demarre sur http://localhost:%PORT%  (fermez cette fenetre pour arreter)
start "" http://localhost:%PORT%
where py >nul 2>nul && (py -m http.server %PORT% --bind 127.0.0.1 & goto :eof)
where python >nul 2>nul && (python -m http.server %PORT% --bind 127.0.0.1 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p %PORT% -a 127.0.0.1 -c-1 -s & goto :eof)
echo Python est necessaire : https://www.python.org/downloads/  (cochez "Add python to PATH")
pause
