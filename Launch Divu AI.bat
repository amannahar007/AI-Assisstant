@echo off
title Divu AI Assistant
set BACKEND_DIR=%~dp0backend-node
set NODE_EXE=%BACKEND_DIR%\node_bin\node.exe
set FRONTEND=%~dp0frontend-web\index.html

:: ── 1. Start MongoDB if not running ──────────────────────────────────────
tasklist /fi "imagename eq mongod.exe" 2>nul | find /i "mongod.exe" >nul
if %errorlevel% neq 0 (
    net start MongoDB >nul 2>&1
    if %errorlevel% neq 0 (
        start /min "MongoDB" mongod --dbpath "C:\data\db" --logpath "C:\data\log\mongod.log" --logappend
    )
)

:: ── 2. Start Ollama if not running ────────────────────────────────────────
tasklist /fi "imagename eq ollama.exe" 2>nul | find /i "ollama.exe" >nul
if %errorlevel% neq 0 (
    start /min "Ollama" ollama serve
)

:: ── 3. Start Node.js backend if not already running on port 3000 ─────────
netstat -ano | find "LISTENING" | find ":3000" >nul 2>&1
if %errorlevel% neq 0 (
    start /min "Divu Backend" "%NODE_EXE%" "%BACKEND_DIR%\server.js"
)

:: ── 4. Open the frontend in default browser ───────────────────────────────
start "" "%FRONTEND%"

exit
