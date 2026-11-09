@echo off
setlocal
cd /d "%~dp0app"
set "TRACKLIST_DATA_DIR=%CD%"
echo Modalita' sviluppo: apri l'indirizzo mostrato da Vite.
"%~dp0runtime\node.exe" "node_modules\vite\bin\vite.js" --host 127.0.0.1
pause
