@echo off
setlocal
cd /d "%~dp0"
set "OMR_NODE_HOME="
if exist .runtime\node-path.txt set /p OMR_NODE_HOME=<.runtime\node-path.txt
if not exist "%OMR_NODE_HOME%\node.exe" set "OMR_NODE_HOME=%~dp0.runtime\node-v24.21.0-win-x64"
set "PATH=%OMR_NODE_HOME%;%PATH%"
if not exist "%OMR_NODE_HOME%\node.exe" (
  echo Local Node runtime missing. Run: python scripts\bootstrap_node.py
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project dependencies...
  call "%OMR_NODE_HOME%\npm.cmd" install
  if errorlevel 1 pause & exit /b 1
)
call "%OMR_NODE_HOME%\npm.cmd" run build
if errorlevel 1 pause & exit /b 1
echo Open http://127.0.0.1:8000 in your browser.
"%OMR_NODE_HOME%\node.exe" dist\server\index.js
pause
