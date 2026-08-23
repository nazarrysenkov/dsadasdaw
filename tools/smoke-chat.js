/*
 * Проверка связи с моделью через локальный сервер.
 * Запуск: node server.js  (в отдельном окне), затем node tools/smoke-chat.js
 */
'use strict';

const PORT = process.env.PORT || 8788;
const BASE = 'http://localhost:' + PORT;

async function main() {
  const cfg = await fetch(BASE + '/api/config').then((r) => r.json());
  console.log('config:', cfg);
  if (!cfg.ready) { console.log('Ключ не задан — проверка прервана.'); process.exit(1); }

  const started = Date.now();
  const res = await fetch(BASE + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Ответь ровно одним словом: работает' }] })
  });

  console.log('POST /api/chat ->', res.status, res.headers.get('content-type'));
  if (!res.ok) { console.log('тело ошибки:', (await res.text()).slice(0, 300)); process.exit(1); }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let frames = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      for (const row of part.split('\n')) {
        const line = row.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        frames++;
        try {
          const json = JSON.parse(payload);
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) answer += piece;
        } catch { /* неполный кадр */ }
      }
    }
  }

  console.log('SSE-кадров:', frames, '| время:', (Date.now() - started) + ' мс');
  console.log('ответ модели:', JSON.stringify(answer.slice(0, 200)));
  console.log(answer.trim() ? 'СВЯЗЬ С МОДЕЛЬЮ РАБОТАЕТ' : 'ОТВЕТ ПУСТОЙ');
  process.exit(answer.trim() ? 0 : 1);
}

main().catch((e) => { console.error('сбой:', e.message); process.exit(1); });
