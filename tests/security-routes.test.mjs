import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';

const notes = 'Photosynthesis converts light energy into chemical energy in plants.';

async function extraction({ valid = true, authThrows = false, allowed = true, quotaError = null } = {}) {
  const calls = { auth: 0, pdf: 0, ai: 0, body: 0, reservations: 0 };
  const route = await loadRoute('app/api/extract-pdf/route.js', {
    'pdf-parse': { default: async () => { calls.pdf++; return { text: notes }; } },
    '@anthropic-ai/sdk': { default: class {
      messages = { create: async () => { calls.ai++; return { content: [{ type: 'text', text: notes }] }; } };
    } },
    '@/lib/supabaseServer': { supabaseFromRequest: () => ({ auth: {
      getUser: async () => {
        calls.auth++;
        if (authThrows) throw new Error('Auth unavailable');
        return { data: { user: valid ? { id: 'user-1' } : null }, error: valid ? null : new Error('Expired') };
      },
    } }) },
    '@/lib/supabaseAdmin': { supabaseAdmin: () => ({ rpc: async () => {
      calls.reservations++; return { data: allowed, error: quotaError };
    } }) },
  });
  const request = (token, file = new File([notes], 'notes.txt', { type: 'text/plain' })) => ({
    headers: new Headers(token ? { authorization: token } : {}),
    formData: async () => {
      calls.body++;
      return { get: () => file };
    },
  });
  return { route, calls, request };
}

for (const [settings, status] of [[{ allowed: false }, 429], [{ quotaError: {} }, 503]]) {
  test(`image quota blocks paid transcription with ${status}`, async () => {
    const { route, calls, request } = await extraction(settings);
    const response = await route.POST(request('Bearer valid', new File([notes], 'photo.png', { type: 'image/png' })));
    assert.equal(response.status, status);
    assert.equal(calls.ai, 0);
  });
}
test('PDF extraction does not consume AI quota', async () => {
  const { route, calls, request } = await extraction({ allowed: false });
  assert.equal((await route.POST(request('Bearer valid', new File([notes], 'notes.pdf', { type: 'application/pdf' })))).status, 200);
  assert.equal(calls.reservations, 0);
});

for (const token of [undefined, 'Basic credentials', 'Bearer']) {
  test(`upload rejects missing/malformed credentials: ${token}`, async () => {
    const { route, calls, request } = await extraction();
    assert.equal((await route.POST(request(token))).status, 401);
    assert.equal(calls.body, 0);
    assert.equal(calls.ai, 0);
  });
}

test('expired upload token is rejected before parsing or AI charges', async () => {
  const { route, calls, request } = await extraction({ valid: false });
  assert.equal((await route.POST(request('Bearer expired'))).status, 401);
  assert.equal(calls.body, 0);
  assert.equal(calls.auth, 1);
});

test('authentication outage does not process uploads', async () => {
  const { route, calls, request } = await extraction({ authThrows: true });
  assert.equal((await route.POST(request('Bearer token'))).status, 503);
  assert.equal(calls.body, 0);
});

for (const [name, type, processor] of [
  ['notes.txt', 'text/plain', null],
  ['notes.pdf', 'application/pdf', 'pdf'],
  ['notes.png', 'image/png', 'ai'],
]) {
  test(`verified user can extract ${type}`, async () => {
    const { route, calls, request } = await extraction();
    const response = await route.POST(request('Bearer valid-token', new File([notes], name, { type })));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, notes);
    assert.equal(calls.auth, 1);
    if (processor) assert.equal(calls[processor], 1);
  });
}

test('a string file field returns a validation error', async () => {
  const { route, request } = await extraction();
  const response = await route.POST(request('Bearer valid', 'not a file'));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /file/i);
});

test('oversized files are rejected before their bytes are read', async () => {
  const { route, request } = await extraction();
  let bytesRead = false;
  const response = await route.POST(request('Bearer valid', {
    name: 'large.pdf', type: 'application/pdf', size: 16 * 1024 * 1024,
    arrayBuffer: async () => { bytesRead = true; return new ArrayBuffer(16 * 1024 * 1024); },
  }));
  assert.equal(response.status, 400);
  assert.equal(bytesRead, false);
});

async function reminders(secret) {
  let adminCalls = 0;
  const query = {
    select() { return this; }, is() { return this; }, lte() { return this; },
    gte: async () => ({ data: [], error: null }),
  };
  const route = await loadRoute('app/api/send-reminders/route.js', {
    '@/lib/supabaseAdmin': { supabaseAdmin: () => { adminCalls++; return { from: () => query }; } },
  }, secret === undefined ? {} : { CRON_SECRET: secret });
  return { route, adminCalls: () => adminCalls };
}

for (const secret of [undefined, '', '   ']) {
  test(`reminders fail closed when secret is unset/blank: ${JSON.stringify(secret)}`, async () => {
    const { route, adminCalls } = await reminders(secret);
    const response = await route.GET(new Request('https://reclipse.test/api/send-reminders'));
    assert.equal(response.status, 503);
    assert.equal(adminCalls(), 0);
  });
}

for (const token of [undefined, 'Bearer wrong']) {
  test(`reminders reject unauthorized callers: ${token}`, async () => {
    const { route, adminCalls } = await reminders('scheduled-secret');
    const response = await route.GET(new Request('https://reclipse.test/api/send-reminders', {
      headers: token ? { authorization: token } : {},
    }));
    assert.equal(response.status, 401);
    assert.equal(adminCalls(), 0);
  });
}

test('authorized reminder job can query due events', async () => {
  const { route, adminCalls } = await reminders('scheduled-secret');
  const response = await route.GET(new Request('https://reclipse.test/api/send-reminders', {
    headers: { authorization: 'Bearer scheduled-secret' },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 0 });
  assert.equal(adminCalls(), 1);
});
