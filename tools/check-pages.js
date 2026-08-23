/* Локальная проверка страниц Moonscape: синтаксис JS, ссылки, id, кодировка. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = process.argv.slice(2);
let failures = 0;

function check(name, ok, extra) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
  if (!ok) failures++;
}

for (const file of files) {
  const full = path.resolve(file);
  const raw = fs.readFileSync(full);
  const html = raw.toString('utf8');
  console.log('\n=== ' + path.basename(file) + ' (' + raw.length + ' bytes) ===');

  check('нет BOM', raw[0] !== 0xef);
  check('кодировка UTF-8 без потерь', !html.includes('\uFFFD'));
  check('есть <!doctype>', /^<!doctype html>/i.test(html.trim()));
  check('закрыт </html>', html.trim().endsWith('</html>'));

  const open = (html.match(/<(section|div|article|form|nav|header|footer|main|aside|button)\b/g) || []).length;
  const close = (html.match(/<\/(section|div|article|form|nav|header|footer|main|aside|button)>/g) || []).length;
  check('блочные теги сбалансированы', open === close, open + ' / ' + close);

  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  check('есть встроенный скрипт', scripts.length > 0);
  scripts.forEach((code, i) => {
    let ok = true, err = '';
    try { new vm.Script(code); } catch (e) { ok = false; err = e.message; }
    check('скрипт #' + (i + 1) + ' парсится', ok, err);
  });

  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
  const missing = [...used].filter(id => !ids.has(id));
  check('все id из JS существуют', missing.length === 0, missing.join(', '));

  const anchors = new Set([...html.matchAll(/href="#([A-Za-z][\w-]*)"/g)].map(m => m[1]));
  const broken = [...anchors].filter(a => a !== 'top' ? !ids.has(a) : !ids.has('top'));
  check('anchor-ссылки валидны', broken.length === 0, broken.join(', '));

  const localLinks = [...html.matchAll(/href="([^"#:]+\.html)"/g)].map(m => m[1]);
  const deadLinks = [...new Set(localLinks)].filter(l => !fs.existsSync(path.join(path.dirname(full), l)));
  check('локальные ссылки на файлы существуют', deadLinks.length === 0, deadLinks.join(', '));

  const secrets = /sk-[A-Za-z0-9]{20,}/.test(html);
  check('нет API-ключа в разметке', !secrets);
}

console.log('\n' + (failures ? failures + ' проверок провалено' : 'Все проверки пройдены'));
process.exit(failures ? 1 : 0);
