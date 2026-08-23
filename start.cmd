@echo off
title Moonscape — Moon AI 0.1
cd /d "%~dp0"

if not exist ".env" (
  echo Файл .env не найден. Скопируйте .env.example в .env и укажите ключ MOONAI_KEY.
  pause
  exit /b 1
)

start "" http://localhost:8788/moonai.html
node server.js
pause
