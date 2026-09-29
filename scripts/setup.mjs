import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local')) {
  console.log('.env.local already exists; no values were changed.');
} else {
  const template = readFileSync('.env.example', 'utf8');
  writeFileSync('.env.local', template.replace('CRON_SECRET=\n', `CRON_SECRET=${randomBytes(32).toString('hex')}\n`), { flag: 'wx' });
  console.log('Created .env.local with a random cron secret. Fill in GEMINI_API_KEY, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.');
}
