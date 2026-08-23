/*
 * Диагностика провайдера: какие эндпоинты, ключи и модели отвечают.
 * Ключи берутся из .env (MOONAI_KEY, можно несколько через запятую).
 * Запуск: node tools/probe-provider.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const env = {};
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const KEYS = String(env.MOONAI_KEY || '').split(',').map((k) => k.trim()).filter(Boolean);
const BASE = (env.MOONAI_BASE_URL || 'https://tabitoken.com/v1').replace(/\/+$/, '');
const MODEL = env.MOONAI_MODEL || 'claude-opus-4-8';
const UA = env.MOONAI_USER_AGENT || 'opencode/0.5.0';

if (!KEYS.length) {
  console.log('В .env нет MOONAI_KEY — нечего проверять.');
  process.exit(1);
}

function mask(key) {
  return key.slice(0, 6) + '…' + key.slice(-4);
}

async function call(name, url, options) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(40000) });
    const text = (await res.text()).replace(/\s+/g, ' ').slice(0, 170);
    console.log((res.status === 200 ? '>>> ' : '    ') + String(res.status).padEnd(4) + name);
    console.log('         ' + text);
  } catch (e) {
    console.log('    ERR  ' + name + ' -> ' + e.message);
  }
}

(async () => {
  console.log('провайдер: ' + BASE + '\nмодель:    ' + MODEL + '\nUser-Agent: ' + UA + '\n');

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    const label = 'ключ #' + (i + 1) + ' (' + mask(key) + ')';

    await call(label + ' · GET /models', BASE + '/models', {
      headers: { Authorization: 'Bearer ' + key, 'x-api-key': key, 'User-Agent': UA }
    });

    await call(label + ' · POST /chat/completions', BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'User-Agent': UA
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] })
    });

    await call(label + ' · POST /messages (Anthropic)', BASE + '/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'User-Agent': UA
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] })
    });
  }
})();
