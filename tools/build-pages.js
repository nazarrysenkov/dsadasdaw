/*
 * Сборка страниц: обфускация встроенного JS и сжатие разметки.
 * Результат: build/pages/index.html и build/pages/moonai.html
 */
'use strict';

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');

const SRC = path.join(__dirname, '..');
const OUT = path.join(SRC, 'build', 'pages');
fs.mkdirSync(OUT, { recursive: true });

/* настройки мягкие: анимация canvas и рендер markdown не должны терять скорость */
const obfuscatorOptions = {
  compact: true,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  renameGlobals: false,
  selfDefending: false,
  target: 'browser'
};

async function buildPage(name) {
  const source = fs.readFileSync(path.join(SRC, name), 'utf8');

  /* 1. обфусцируем каждый встроенный <script> */
  let touched = 0;
  let html = source.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => {
    if (!code.trim()) return m;
    touched++;
    const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
    return '<script>' + result.getObfuscatedCode() + '</script>';
  });

  /* 2. сжимаем разметку, CSS и комментарии */
  html = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    conservativeCollapse: false,
    keepClosingSlash: true
  });

  fs.writeFileSync(path.join(OUT, name), html);
  const kb = (n) => (n / 1024).toFixed(1) + ' КБ';
  console.log(name + ': скриптов ' + touched +
    ', ' + kb(Buffer.byteLength(source)) + ' -> ' + kb(Buffer.byteLength(html)));
}

(async () => {
  for (const page of ['index.html', 'moonai.html']) await buildPage(page);
})();
