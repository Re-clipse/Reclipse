import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const courseId = '44444444-4444-4444-8444-444444444444';
const material = {
  summary: '- Cells use energy.',
  flashcards: [{ question: 'What powers cells?', answer: 'ATP', type: 'basic' }],
  quiz: [{ question: 'Which molecule?', options: ['ATP', 'DNA', 'RNA', 'Water'], correctIndex: 0, explanation: 'ATP stores energy.' }],
};
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${alice}'), ('${bob}');
  `);
  for (const name of ['schema.sql', '002_features.sql', '003_syllabus_discover_collab.sql', '004_campus_archive.sql', '005_fix_rls_recursion.sql']) {
    await db.exec(await readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8'));
  }
  // Match the existing Data API grants; migrations must explicitly narrow them.
  await db.exec(`grant all on all tables in schema public to anon, authenticated, service_role;
    insert into public.usage_limits values ('${alice}', (now() at time zone 'UTC')::date, 2);
    insert into public.courses(id,user_id,name) values ('${courseId}','${bob}','Private course');`);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = await readdir(directory).catch(() => []);
  for (const file of files.filter(f => f.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    await db.exec(sql);
    await db.exec(sql); // A retry must not reset usage or duplicate data.
  }
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback'); });

async function asUser(id = alice) {
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  await db.exec('set local role authenticated');
}
async function save(payload = material, id = requestId, course = null) {
  const result = await db.query('select public.save_study_set($1::uuid,$2,$3,$4::uuid,$5::jsonb) as id',
    [id, 'Cell biology', 'Notes about how cells use chemical energy.', course, JSON.stringify(payload)]);
  return result.rows[0].id;
}

test('users cannot reset their legacy generation counter', async () => {
  await asUser();
  await assert.rejects(db.query('update public.usage_limits set generations_count=0 where user_id=$1', [alice]), { code: '42501' });
});
test('only the server can reserve or modify AI usage', async () => {
  await asUser();
  await assert.rejects(db.query("select public.reserve_ai_usage($1::uuid,'generation',5)", [alice]), { code: '42501' });
});
test('users cannot insert forged AI usage', async () => {
  await asUser();
  await assert.rejects(db.query("insert into public.ai_usage(user_id,operation,usage_date,attempts) values ($1,'generation',current_date,0)", [alice]), { code: '42501' });
});
test('generation budget preserves old counts and never exceeds the cap', async () => {
  await db.exec('set local role service_role');
  const results = await Promise.all(Array.from({ length: 12 }, () =>
    db.query("select public.reserve_ai_usage($1::uuid,'generation',5) as allowed", [alice])));
  assert.equal(results.filter(r => r.rows[0].allowed).length, 3);
  const { rows } = await db.query("select attempts from public.ai_usage where user_id=$1 and operation='generation'", [alice]);
  assert.equal(rows[0].attempts, 5);
});
test('budgets are independent across users, operations and UTC days', async () => {
  await db.exec('set local role service_role');
  await db.query("insert into public.ai_usage values ($1, (now() at time zone 'UTC')::date - 1, 'image', 99)", [alice]);
  for (const [id, op] of [[alice,'image'],[alice,'syllabus'],[bob,'generation']]) {
    assert.equal((await db.query('select public.reserve_ai_usage($1::uuid,$2,1) as ok',[id,op])).rows[0].ok,true);
    assert.equal((await db.query('select public.reserve_ai_usage($1::uuid,$2,1) as ok',[id,op])).rows[0].ok,false);
  }
});
test('invalid server limit is rejected', async () => {
  await db.exec('set local role service_role');
  await assert.rejects(db.query("select public.reserve_ai_usage($1::uuid,'generation',0)",[alice]), { code: '22023' });
});
test('save creates deck, cards and quiz once and returns the same ID on retry', async () => {
  await asUser();
  const id = await save();
  assert.equal(await save(), id);
  for (const table of ['decks','flashcards','quiz_questions']) {
    assert.equal((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count, 1);
  }
});
test('a child insert failure rolls back the entire study set', async () => {
  await db.exec("alter table public.quiz_questions add constraint force_failure check (question <> 'Which molecule?')");
  await asUser();
  await db.exec('savepoint attempted_save');
  await assert.rejects(save(), { code: '23514' });
  await db.exec('rollback to savepoint attempted_save');
  for (const table of ['decks','flashcards','quiz_questions']) {
    assert.equal((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count, 0);
  }
});
test('users cannot attach a new deck to someone else’s course', async () => {
  await asUser();
  await assert.rejects(save(material, requestId, courseId), { code: '42501' });
});
test('an anonymous user cannot call save', async () => {
  await db.exec('set local role anon');
  await assert.rejects(save(), { code: '42501' });
});
test('idempotency keys are scoped to each owner', async () => {
  await asUser(alice);
  const first = await save();
  await asUser(bob);
  const second = await save();
  assert.notEqual(first, second);
  assert.equal((await db.query('select count(*)::int as count from public.decks')).rows[0].count, 1);
});
for (const payload of [
  { ...material, flashcards: [] },
  { ...material, flashcards: [{ question: null, answer: 'a' }] },
  { ...material, quiz: [{ ...material.quiz[0], correctIndex: 4 }] },
  { ...material, quiz: [{ ...material.quiz[0], options: ['one'] }] },
  { ...material, quiz: null },
]) {
  test(`invalid study data is rejected: ${JSON.stringify(payload)}`, async () => {
    await asUser();
    await assert.rejects(save(payload), { code: '22023' });
  });
}
