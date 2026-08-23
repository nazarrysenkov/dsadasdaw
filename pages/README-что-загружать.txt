# Что загрузить в репозиторий для GitHub Pages

В корень ветки (main) кладутся три файла из этой папки:

  index.html   — главная страница
  moonai.html  — чат (сам ходит за ответами на VPS)
  CNAME        — одна строка: moonscape.qd.je

Больше ничего. Особенно НЕ загружайте:

  server.js          — сервер нужен только на VPS
  .env               — КЛЮЧИ. Попадёт в публичный репозиторий = их украдут за минуты
  WorldGrid.apk      — на сайте ссылок на него больше нет
  tools/, build/, dist/, sea-config.json, build.cmd, start.cmd

Кнопки «Потестить Moon AI» уже ведут на http://194.87.126.31:8787/moonai.html
— они открывают чат в новой вкладке прямо с сервера.

После загрузки: Settings → Pages → Custom domain: moonscape.qd.je → Save.
Когда DNS подтянется — включите Enforce HTTPS.
