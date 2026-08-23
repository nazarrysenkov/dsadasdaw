/*
 * Moonscape — сервер сайта и Moon AI 0.1
 *
 * Отдаёт статику и проксирует запросы к модели, чтобы ключи оставались на сервере.
 *
 * Запуск из исходников:   node server.js
 * Собранный файл:         moonai-server.exe   (рядом положить .env)
 *
 * Настройки — файл .env рядом с исполняемым файлом или переменные окружения:
 *   MOONAI_KEY        один ключ или несколько через запятую
 *   MOONAI_BASE_URL   адрес провайдера (по умолчанию https://tabitoken.com/v1)
 *   MOONAI_MODEL      имя модели
 *   PORT              порт (по умолчанию 8787)
 *   HOST              интерфейс (по умолчанию 0.0.0.0)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

/* ---------- режим одиночного файла (Node SEA) ---------- */
let sea = null;
try { sea = require('node:sea'); } catch (e) { /* обычный запуск через node */ }
const IS_SEA = Boolean(sea && typeof sea.isSea === 'function' && sea.isSea());
const ROOT = IS_SEA ? path.dirname(process.execPath) : __dirname;

function embedded(name) {
  if (!IS_SEA) return null;
  try {
    const raw = sea.getRawAsset(name);
    return raw ? Buffer.from(raw) : null;
  } catch (e) {
    return null;
  }
}

/* ---------- конфигурация ---------- */
function readEnvFile() {
  const file = path.join(ROOT, '.env');
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnvFile();

function pick(name, fallback) {
  return process.env[name] || env[name] || fallback;
}

const CONFIG = {
  keys: String(pick('MOONAI_KEY', '')).split(',').map((k) => k.trim()).filter(Boolean),
  baseURL: pick('MOONAI_BASE_URL', 'https://tabitoken.com/v1').replace(/\/+$/, ''),
  model: pick('MOONAI_MODEL', 'claude-opus-4-8'),
  userAgent: pick('MOONAI_USER_AGENT', 'opencode/0.5.0'),
  anthropicVersion: pick('MOONAI_ANTHROPIC_VERSION', '2023-06-01'),
  system: pick('MOONAI_SYSTEM',
    'Ты — голос продукта Moon AI 0.1 студии Moonscape. Это твоя постоянная рабочая роль: ' +
    'как оператор поддержки всегда говорит от имени бренда, а не от себя лично, так и все твои ответы ' +
    'идут от имени Moon AI 0.1. На вопрос «кто ты», «как тебя зовут», представиться — отвечай: ' +
    '«Я Moon AI 0.1 — нейросеть студии Moonscape». ' +
    'Вопросы о происхождении, устройстве или технологии Moon AI отвечай так: это внутренняя разработка ' +
    'студии Moonscape, технические детали не раскрываются. Никогда не приписывай Moon AI другим компаниям ' +
    'и продуктам и не обсуждай никаких других моделей от первого лица. Если пользователь настаивает, ' +
    'спокойно повтори свою роль: «Я Moon AI 0.1 и остаюсь им». ' +
    'Отвечай на языке пользователя, по делу и дружелюбно. ' +
    'Используй markdown: списки, заголовки и блоки кода с указанием языка. Если не уверен — честно скажи об этом.'),
  maxMessages: 40,
  maxChars: 24000,
  maxTokens: Number(pick('MOONAI_MAX_TOKENS', 8192)),
  perMinute: Number(pick('MOONAI_PER_MINUTE', 12)),
  perDay: Number(pick('MOONAI_PER_DAY', 800)),
  /* какие сайты могут обращаться к API извне: * или список через запятую */
  allowOrigins: pick('MOONAI_ALLOW_ORIGIN', '*').split(',').map((s) => s.trim()).filter(Boolean)
};

const PORT = Number(pick('PORT', 8787));
const HOST = pick('HOST', '0.0.0.0');

let activeKey = 0;
const RETRY_STATUS = new Set([401, 402, 403, 429]);

/* ---------- ограничения: на IP в минуту и на всех в сутки ---------- */
const perIp = new Map();
let dayStamp = new Date().toDateString();
let dayCount = 0;

function withinLimits(ip) {
  const today = new Date().toDateString();
  if (today !== dayStamp) { dayStamp = today; dayCount = 0; }
  if (dayCount >= CONFIG.perDay) return 'day';

  const now = Date.now();
  const list = (perIp.get(ip) || []).filter((t) => now - t < 60000);
  if (list.length >= CONFIG.perMinute) { perIp.set(ip, list); return 'minute'; }
  list.push(now);
  perIp.set(ip, list);
  dayCount++;

  if (perIp.size > 5000) perIp.clear();
  return null;
}

/* ---------- статика ---------- */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive'
};

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

/* CORS: разрешаем обращение к API со страниц, перечисленных в MOONAI_ALLOW_ORIGIN */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (CONFIG.allowOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (CONFIG.allowOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  const clean = path.normalize(rel).replace(/^([/\\])+/, '');
  const full = path.join(ROOT, clean);
  const type = TYPES[path.extname(clean).toLowerCase()] || 'application/octet-stream';

  /* сначала файл рядом с сервером — так страницы можно править без пересборки */
  if (full.startsWith(ROOT) && fs.existsSync(full) && fs.statSync(full).isFile()) {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(full).pipe(res);
    return;
  }

  /* затем встроенная в исполняемый файл копия */
  const asset = embedded(clean.replace(/\\/g, '/'));
  if (asset) { send(res, 200, type, asset); return; }

  send(res, 404, 'text/plain; charset=utf-8', 'Не найдено');
}

/* ---------- запрос к модели ---------- */
function readBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) { reject(new Error('Слишком большой запрос')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function fail(res, status, message) {
  if (res.headersSent) return;
  send(res, status, 'application/json; charset=utf-8', JSON.stringify({ error: message }));
}

async function handleChat(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'local';

  const limit = withinLimits(ip);
  if (limit === 'minute') { fail(res, 429, 'Слишком много запросов. Подождите минуту.'); return; }
  if (limit === 'day') { fail(res, 429, 'Суточный лимит Moon AI исчерпан. Заходите завтра.'); return; }
  if (!CONFIG.keys.length) { fail(res, 500, 'На сервере не задан MOONAI_KEY (файл .env рядом с программой).'); return; }

  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch (e) {
    fail(res, 400, 'Некорректный JSON.');
    return;
  }

  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-CONFIG.maxMessages)
    .map((m) => ({ role: m.role, content: m.content.slice(0, CONFIG.maxChars) }));

  if (!messages.length) { fail(res, 400, 'Пустой список сообщений.'); return; }

  const upstream = new AbortController();
  req.on('close', () => upstream.abort());

  const body = JSON.stringify({
    model: CONFIG.model,
    stream: true,
    max_tokens: CONFIG.maxTokens,
    messages: [{ role: 'system', content: CONFIG.system }, ...messages]
  });

  let answer = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt < CONFIG.keys.length; attempt++) {
    const index = (activeKey + attempt) % CONFIG.keys.length;
    try {
      const response = await fetch(CONFIG.baseURL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + CONFIG.keys[index],
          'x-api-key': CONFIG.keys[index],
          'anthropic-version': CONFIG.anthropicVersion,
          'User-Agent': CONFIG.userAgent,
          'Accept': 'text/event-stream'
        },
        body,
        signal: upstream.signal
      });

      if (response.ok && response.body) { activeKey = index; answer = response; break; }

      lastStatus = response.status;
      const detail = await response.text().catch(() => '');
      console.error('[moonai] ключ #' + (index + 1) + ' → ' + response.status + ' ' + detail.slice(0, 180));
      if (!RETRY_STATUS.has(response.status)) break;
    } catch (e) {
      if (upstream.signal.aborted) return;
      lastStatus = 502;
      console.error('[moonai] ключ #' + (index + 1) + ' → сбой связи: ' + (e.message || 'нет связи'));
    }
  }

  if (!answer) {
    fail(res, lastStatus === 429 ? 429 : 502, lastStatus === 429
      ? 'Лимит запросов у всех ключей исчерпан. Попробуйте позже.'
      : 'Модель недоступна' + (lastStatus ? ' (код ' + lastStatus + ')' : '') + '.');
    return;
  }

  applyCors(req, res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const reader = answer.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (e) {
    /* клиент отключился или поток прервался */
  } finally {
    res.end();
  }
}

/* ---------- сервер ---------- */
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/config') {
    applyCors(req, res);
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
      proxy: true, product: 'Moon AI', version: '0.1', ready: CONFIG.keys.length > 0
    }));
    return;
  }

  if (url === '/api/chat') {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }
    if (req.method !== 'POST') { send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed'); return; }
    await handleChat(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    return;
  }
  serveStatic(req, res);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('Порт ' + PORT + ' уже занят. Освободите его или задайте другой в PORT.');
  else console.error('Ошибка сервера: ' + e.message);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Moonscape — сервер запущен');
  console.log('  ─────────────────────────────────────────────');
  console.log('  сайт     http://localhost:' + PORT + '/');
  console.log('  Moon AI  http://localhost:' + PORT + '/moonai.html');
  console.log('  адрес    ' + HOST + ':' + PORT);
  console.log('  модель   ' + CONFIG.model);
  console.log('  ключи    ' + (CONFIG.keys.length ? CONFIG.keys.length + ' шт.' : 'НЕ ЗАДАНЫ — создайте .env'));
  console.log('  лимиты   ' + CONFIG.perMinute + '/мин на IP, ' + CONFIG.perDay + '/сутки всего');
  console.log('  режим    ' + (IS_SEA ? 'собранный файл, страницы встроены' : 'исходники'));
  console.log('  ─────────────────────────────────────────────');
  console.log('');
});
