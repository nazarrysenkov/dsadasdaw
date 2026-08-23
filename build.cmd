@echo off
rem Полная сборка: обфускация страниц и сервера -> SEA-blob -> moonai-server.exe
title Moonscape — сборка
cd /d "%~dp0"

if not exist "build" mkdir "build"
if not exist "dist" mkdir "dist"

if not exist "node_modules\javascript-obfuscator" (
  echo Устанавливаю зависимости сборки...
  call npm install || goto :error
)

echo [1/5] обфускация server.js...
call npx --yes javascript-obfuscator server.js --output build\server-obf.js ^
  --target node --compact true ^
  --control-flow-flattening true --control-flow-flattening-threshold 1 ^
  --string-array true --string-array-encoding rc4 --string-array-threshold 1 ^
  --identifier-names-generator hexadecimal --rename-globals false --self-defending false || goto :error

echo [2/5] обфускация страниц...
node tools\build-pages.js || goto :error

echo [3/5] подготовка SEA-blob...
node --experimental-sea-config sea-config.json || goto :error

echo [4/5] копирование node.exe...
for /f "delims=" %%i in ('where node') do set NODE_BIN=%%i
copy /y "%NODE_BIN%" "dist\moonai-server.exe" >nul || goto :error

echo [5/5] внедрение...
call npx --yes postject "dist\moonai-server.exe" NODE_SEA_BLOB "build\sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 || goto :error

if not exist "dist\.env" copy /y ".env" "dist\.env" >nul

rem обновляем комплект для GitHub Pages собранными страницами
copy /y "build\pages\index.html" "pages\index.html" >nul
copy /y "build\pages\moonai.html" "pages\moonai.html" >nul

echo.
echo Готово:
echo   dist\moonai-server.exe   — сервер (весь код обфусцирован)
echo   pages\                   — комплект для GitHub Pages (тоже обфусцирован)
pause
exit /b 0

:error
echo.
echo Сборка не удалась.
pause
exit /b 1
