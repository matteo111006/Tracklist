@echo off
setlocal
cd /d "%~dp0app"
set "HOST=127.0.0.1"
set "PORT=3000"
set "TRACKLIST_DATA_DIR=%CD%"
echo TRACKLIST - apri http://127.0.0.1:3000 nel browser.
echo Se la porta 3000 e' gia' in uso, chiudi l'altra copia del sito.
echo Lascia questa finestra aperta mentre usi TRACKLIST.
"%~dp0runtime\node.exe" "dist-server\index.js"
pause
