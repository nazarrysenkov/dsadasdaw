@echo off
rem Сборка moonai-server.exe (Node SEA). Требуется Node 20+ и интернет для postject.
title Moonscape — сборка exe
cd /d "%~dp0"

if not exist "build" mkdir "build"
if not exist "dist" mkdir "dist"

echo [1/3] готовим blob со сервером и страницами...
node --experimental-sea-config sea-config.json || goto :error

echo [2/3] копируем node.exe...
for /f "delims=" %%i in ('where node') do set NODE_BIN=%%i
copy /y "%NODE_BIN%" "dist\moonai-server.exe" >nul || goto :error

echo [3/3] внедряем blob...
call npx --yes postject "dist\moonai-server.exe" NODE_SEA_BLOB "build\sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 || goto :error

if not exist "dist\.env" copy /y ".env" "dist\.env" >nul

echo.
echo Готово: dist\moonai-server.exe
echo Рядом должен лежать dist\.env с ключами.
pause
exit /b 0

:error
echo.
echo Сборка не удалась.
pause
exit /b 1
