const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { authorized } = require('../.test-build/lib/auth');
const { getConfig } = require('../.test-build/lib/config');
const { parseArticle } = require('../.test-build/lib/content');
const { scheduledTopic } = require('../.test-build/lib/topics');
const { runPipeline } = require('../.test-build/lib/pipeline');
const { GET } = require('../.test-build/app/api/cron/generate-blog/route');

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
let replies = [], calls = [];
const blog = { id: 'gid://shopify/Blog/123', handle: 'build-with-ai', title: 'Build with AI' };
const article = { id: 'gid://shopify/Article/456', handle: 'build-with-ai-2026-09-28', title: 'Build your first AI automation', isPublished: true };
const content = { title: article.title, body_html: `<h2>Practical steps</h2><p>${'Check each generated suggestion before using it. '.repeat(60)}</p>`, tags: ['AI', 'Development'], summary: 'A practical introduction to creating and checking your first AI automation.' };
const blogs = { data: { blogs: { nodes: [blog], pageInfo: { hasNextPage: false, endCursor: null } } } };
const empty = { data: { articles: { nodes: [] } } };
const existing = { data: { articles: { nodes: [{ ...article, blog }] } } };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const push = (...bodies) => replies.push(...bodies.map(b => reply(b)));
const initial = () => push({ access_token: 'token' }, blogs, empty);
const generated = (raw = JSON.stringify(content), finishReason = 'STOP') => push({ candidates: [{ finishReason, content: { parts: [{ text: raw }] } }] });
const now = new Date('2026-09-29');
beforeEach(() => {
  Object.assign(process.env, {
    GEMINI_API_KEY: 'test-gemini-secret', SHOPIFY_CLIENT_ID: 'test-id', SHOPIFY_CLIENT_SECRET: 'test-shopify-secret',
    SHOPIFY_STORE_DOMAIN: 'sigma-ai-blog.myshopify.com', CRON_SECRET: 'x'.repeat(64), SCHEDULE_ANCHOR: '2026-09-28',
    SHOPIFY_ADMIN_ACCESS_TOKEN: '', SHOPIFY_BLOG_ID: '', SHOPIFY_BLOG_HANDLE: 'build-with-ai',
    AUTOMATION_ENABLED: 'true', PUBLISH_ARTICLES: 'true', PUBLISH_EVERY_WEEKS: '1', VERCEL_ENV: '', BLOG_AUTHOR: 'Sigma Web Hub'
  });
  replies = []; calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    assert.ok(replies.length, 'Unexpected external call');
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next;
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test('exact Bearer secret required; missing or short secret fails closed', () => {
  assert.equal(authorized(`Bearer ${process.env.CRON_SECRET}`, process.env.CRON_SECRET), true);
  assert.equal(authorized(`bearer ${process.env.CRON_SECRET}`, process.env.CRON_SECRET), false);
  assert.equal(authorized('Bearer undefined', undefined), false);
  assert.equal(authorized('Bearer short', 'short'), false);
});
test('unauthorized route makes no external calls', async () => {
  assert.equal((await GET(new Request('http://localhost'))).status, 401);
  assert.equal(calls.length, 0);
});
test('missing cron secret fails closed', async () => {
  process.env.CRON_SECRET = '';
  assert.equal((await GET(new Request('http://localhost'))).status, 503);
  assert.equal(calls.length, 0);
});
test('preview deployment cannot publish', async () => {
  process.env.VERCEL_ENV = 'preview';
  assert.equal((await GET(new Request('http://localhost', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))).status, 403);
  assert.equal(calls.length, 0);
});
test('rejects unsafe domains and impossible dates', () => {
  assert.throws(() => getConfig({ ...process.env, SHOPIFY_STORE_DOMAIN: 'localhost' }));
  assert.throws(() => getConfig({ ...process.env, SCHEDULE_ANCHOR: '2026-02-30' }));
});
test('cleans scripts, attributes and links while preserving headings', () => {
  const result = parseArticle(JSON.stringify({ ...content, body_html: content.body_html + '<script>alert(1)</script><p onclick="alert(1)">Hello</p><a href="javascript:alert(1)">link</a>' }));
  assert.doesNotMatch(result.body_html, /script|onclick|href|alert/);
  assert.match(result.body_html, /<h2>/);
});
test('rejects invalid JSON and short content', () => {
  assert.throws(() => parseArticle('```json invalid'));
  assert.throws(() => parseArticle(JSON.stringify({ ...content, body_html: '<p>short</p>' })));
});
test('one handle per UTC week and topics rotate on Monday', () => {
  const monday = scheduledTopic(new Date('2026-09-28T08:00:00Z'), '2026-09-28', 1);
  assert.equal(monday.handle, scheduledTopic(new Date('2026-10-04T23:59:59Z'), '2026-09-28', 1).handle);
  assert.notEqual(monday.topic.slug, scheduledTopic(new Date('2026-10-05T00:00:00Z'), '2026-09-28', 1).topic.slug);
});
test('alternate weeks and dates before anchor are skipped', () => {
  assert.equal(scheduledTopic(new Date('2026-10-05'), '2026-09-28', 2).due, false);
  assert.equal(scheduledTopic(new Date('2026-10-12'), '2026-09-28', 2).due, true);
  assert.equal(scheduledTopic(new Date('2026-09-21'), '2026-09-28', 1).due, false);
});
test('full mocked pipeline authenticates, generates, cleans and publishes', async () => {
  initial(); generated(); push(empty, { data: { articleCreate: { article, userErrors: [] } } });
  const result = await runPipeline(now);
  assert.equal(result.status, 'published');
  assert.equal(calls.length, 6);
  const payload = JSON.parse(calls[5][1].body).variables.article;
  assert.equal(payload.blogId, blog.id); assert.equal(payload.handle, article.handle);
  assert.equal(payload.isPublished, true); assert.deepEqual(payload.tags, content.tags);
  assert.deepEqual(payload.author, { name: 'Sigma Web Hub' });
  assert.equal(result.url, `https://sigma-ai-blog.myshopify.com/blogs/build-with-ai/${article.handle}`);
  assert.equal(calls[3][1].headers['x-goog-api-key'], 'test-gemini-secret');
});
test('existing article avoids generation entirely', async () => {
  push({ access_token: 'token' }, blogs, existing);
  assert.equal((await runPipeline(now)).status, 'already_exists');
  assert.equal(calls.length, 3);
});
test('second duplicate check catches a run completed during generation', async () => {
  initial(); generated(); push(existing);
  assert.equal((await runPipeline(now)).status, 'already_exists');
  assert.equal(calls.length, 5);
});
test('truncated AI output never reaches article creation', async () => {
  initial(); generated('{}', 'MAX_TOKENS');
  await assert.rejects(runPipeline(now), { code: 'AI_GENERATION_INCOMPLETE' });
  assert.equal(calls.length, 4);
});
test('quota exhaustion stops without paid fallback', async () => {
  initial(); replies.push(reply({ error: 'quota' }, 429));
  await assert.rejects(runPipeline(now), { code: 'RATE_LIMITED' });
  assert.equal(calls.length, 4);
});
test('GraphQL userErrors fail the run', async () => {
  initial(); generated(); push(empty, { data: { articleCreate: { article: null, userErrors: [{ field: ['article', 'title'], message: 'invalid' }] } } });
  await assert.rejects(runPipeline(now), { code: 'SHOPIFY_ARTICLE_REJECTED' });
});
test('ambiguous create timeout is not automatically retried', async () => {
  initial(); generated(); push(empty); replies.push(new Error('timeout'));
  await assert.rejects(runPipeline(now), { code: 'UPSTREAM_UNREACHABLE' });
  assert.equal(calls.length, 6);
});
test('pause switch makes no API calls', async () => {
  process.env.AUTOMATION_ENABLED = 'false';
  assert.equal((await runPipeline(now)).status, 'skipped');
  assert.equal(calls.length, 0);
});
test('draft creation never claims the article was published', async () => {
  process.env.PUBLISH_ARTICLES = 'false';
  initial(); generated(); push(empty, { data: { articleCreate: { article: { ...article, isPublished: false }, userErrors: [] } } });
  assert.equal((await runPipeline(now)).status, 'draft_created');
  assert.equal(JSON.parse(calls[5][1].body).variables.article.isPublished, false);
});
