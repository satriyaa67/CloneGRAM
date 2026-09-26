import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramClient, TelegramApiError, TelegramRateLimitError } from '../src/telegram/client.js';

const respond = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });

test('returns result on success and posts JSON to the method URL', async () => {
  let seen;
  const client = createTelegramClient({
    token: 'T0KEN',
    fetchImpl: async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ ok: true, result: { id: 1 } })); },
  });
  assert.deepEqual(await client.getChat(-100), { id: 1 });
  assert.equal(seen.url, 'https://api.telegram.org/botT0KEN/getChat');
  assert.deepEqual(JSON.parse(seen.init.body), { chat_id: -100 });
});

test('surfaces 429 as a rate-limit error with retry_after', async () => {
  const client = createTelegramClient({ token: 'T', fetchImpl: respond({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 7', parameters: { retry_after: 7 } }, 429) });
  await assert.rejects(client.getMe(), (error) => error instanceof TelegramRateLimitError && error.retryAfter === 7);
});

test('API errors never contain the token', async () => {
  const client = createTelegramClient({ token: 'SECRET-TOKEN', fetchImpl: respond({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }, 400) });
  await assert.rejects(client.getChat(1), (error) => error instanceof TelegramApiError && !error.message.includes('SECRET-TOKEN') && error.code === 400);
});

test('requires a token', () => {
  assert.throws(() => createTelegramClient({ token: '' }), /not configured/);
});
