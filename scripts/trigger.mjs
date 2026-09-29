import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 32) throw new Error('Set CRON_SECRET in .env.local first.');
const raw = process.argv[2] || 'http://localhost:3000';
const url = new URL(raw);
const local = ['localhost', '127.0.0.1'].includes(url.hostname);
if (!local && url.protocol !== 'https:') throw new Error('Remote URLs must use HTTPS.');
if (url.username || url.password) throw new Error('Do not include credentials in the URL.');
if (!local) {
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(`Send your cron secret to ${url.origin} and run publishing? Type yes: `);
  prompt.close();
  if (answer.trim().toLowerCase() !== 'yes') process.exit(0);
}
const response = await fetch(new URL('/api/cron/generate-blog', url.origin), {
  headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(300000)
});
console.log(`HTTP ${response.status}`);
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
