# Build with AI — Shopify publishing demo

A Next.js + TypeScript backend that rotates developer topics, generates an article through Gemini, validates and sanitizes the response, and publishes to the **Build with AI** Shopify blog. Includes a small public landing page and Vercel Cron configuration. No database, paid AI fallback, Shopify theme changes or external images are required.

**This demo uses Gemini, not Claude.** Claude Pro is not needed. Client-funded Claude support would be a separate provider integration and live test. Shopify uses GraphQL Admin API rather than the legacy REST endpoint in the original job description.

## Start on Windows

Use Node.js 22.12 or newer. Open a terminal in the project directory:

```powershell
npm.cmd ci
npm.cmd run setup
```

`setup` creates `.env.local` with a random cron secret and never overwrites an existing file. Open `.env.local` in your editor and fill these three values:

- `GEMINI_API_KEY`: a replacement for any key exposed in screenshots; keep the Google project on the free tier.
- `SHOPIFY_CLIENT_ID`: AI Blog Publisher's client ID.
- `SHOPIFY_CLIENT_SECRET`: the app's client secret.

The store `sigma-ai-blog.myshopify.com` and blog handle `build-with-ai` are already configured. Leave `SHOPIFY_BLOG_ID` blank: the app finds it automatically. `.env.local` is ignored by Git. Do not put secrets in screenshots, code, README files, or `NEXT_PUBLIC_` variables.

## Verify before deployment

```powershell
npm.cmd run check:shopify
npm.cmd run preview:article
```

The first command checks Shopify access and prints the destination blog's ID, handle and title. It makes no publishing request. The second uses Gemini quota and saves `preview/article.html` and `preview/article.json`; it publishes nothing. Review both files.

Publish one freshly generated article for the current week:

```powershell
npm.cmd run publish:article -- --confirm
```

This generates again; it does not publish the saved preview. Inspect the output URL, Shopify's published status, title, tags and excerpt. Your development storefront remains password-protected. Repeating the command normally returns `already_exists` rather than generating another article.

Run the website and test its protected route:

```powershell
npm.cmd run dev
```

In a second terminal:

```powershell
npm.cmd run trigger
```

Opening `/api/cron/generate-blog` in a browser without the secret returns 401. `trigger` reads the secret from `.env.local`; it never prints it. It uses the same weekly slot as direct publishing, so a completed test post is not published again.

## Push to GitHub

Commit the project, including `package-lock.json`, `.env.example`, and `vercel.json`. Do not commit `.env.local`, `node_modules`, `.next`, or previews. The supplied `.gitignore` excludes them.

```powershell
git init
git add .
git status
git commit -m "Build Gemini to Shopify blog automation"
```

Create an empty GitHub repository, then use the remote/push commands GitHub provides. Inspect `git status` before committing to confirm no secrets are staged.

## Deploy to Vercel

1. Import the GitHub repository as a Next.js project.
2. Select Node.js 22.x or newer. Leave the standard Next.js build and output settings.
3. Before deployment, add the variables from `.env.local` to **Production** environment settings. At minimum: Gemini key, Shopify client ID/secret, store domain, blog handle, and the same generated `CRON_SECRET`. Use the other values from `.env.example` as needed. `.env.local` is not uploaded by GitHub.
4. Deploy. The repository's `vercel.json` registers the cron job automatically on production deployments. No additional cron service or secret header configuration is needed.
5. Check **Project Settings → Cron Jobs** for `/api/cron/generate-blog`.
6. To run immediately, use `npm.cmd run trigger -- https://YOUR-PROJECT.vercel.app`. Verify the hostname and type `yes` when asked. Vercel deployment protection may block external manual calls; in that case use the dashboard's Cron **Run** action while signed in.
7. Inspect runtime logs and the article in Shopify. If this week's post already exists from local testing, `already_exists` is the correct result. Do not delete it just to test the schedule.

**Deployment registers the schedule; it does not immediately publish.** The schedule is `0 8 * * 1`: Monday 08:00 UTC / 13:00 Pakistan time. Hobby timing can occur anywhere within that hour. Vercel cron runs only against production. Preview deployments explicitly reject publishing. Enable Fluid Compute if your project does not already have it: the route requests a 300-second duration; Gemini itself has a 100-second timeout.

Vercel Hobby is limited to personal, non-commercial use. A client-facing commercial deployment requires an appropriate hosting plan; do not assume a free plan is eligible for commercial use. You can demonstrate the entire generation/publishing flow locally at no hosting charge. Gemini free quotas depend on account/model availability; leave billing disabled to keep the $0 constraint. The app never enables billing or changes provider when quota is exhausted.

## Environment reference

| Variable | Default / purpose |
| --- | --- |
| GEMINI_API_KEY | Required, server only |
| GEMINI_MODEL | `gemini-2.5-flash`; choose an available free-tier text model supporting structured output |
| SHOPIFY_STORE_DOMAIN | `sigma-ai-blog.myshopify.com`; no scheme or path |
| SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET | Same-organization installed app credentials |
| SHOPIFY_ADMIN_ACCESS_TOKEN | Optional alternative for an existing suitable token; leave blank with client credentials |
| SHOPIFY_API_VERSION | `2026-07` |
| SHOPIFY_BLOG_HANDLE | `build-with-ai` |
| SHOPIFY_BLOG_ID | Optional numeric ID or `gid://shopify/Blog/...`; takes precedence over handle |
| BLOG_AUTHOR | `Sigma Web Hub` |
| CRON_SECRET | Required for the HTTP route, at least 32 characters; generated by setup |
| PUBLISH_ARTICLES | `true`; set `false` for drafts |
| AUTOMATION_ENABLED | `true`; set `false` to pause |
| PUBLISH_EVERY_WEEKS | `1`; use `2` for alternate weeks |
| SCHEDULE_ANCHOR | `2026-09-28`; must be a Monday in UTC |

For every-other-week publishing, keep the weekly Vercel schedule and set `PUBLISH_EVERY_WEEKS=2`. The code skips alternate weeks anchored to `SCHEDULE_ANCHOR`. Update `lib/topics.ts` to edit the 12-topic rotation. Topics repeat after the list ends. A weekly handle is stable even if you edit the topic list.

## Reliability and scope

- Checks the Bearer secret before making external calls; responses are never cached.
- Gets a fresh Shopify token per run; the 24-hour client-credentials token is not saved as a permanent environment value. The app and store must be in the same Shopify organization, with the app installed and `read_content,write_content` approved.
- Validates title, summary, tags and body; requires headings and at least 300 words after cleaning. Removes scripts, attributes, links, images and unsupported HTML.
- Requires Gemini's normal completion status and rejects truncated or malformed output.
- Checks for the same weekly handle before and after generation. A process-local guard also stops concurrent requests in the same instance.
- **Duplicate prevention is best effort, not exactly-once delivery.** Shopify search indexing and concurrent serverless instances can race. Strict cross-instance guarantees require a durable lock/idempotency design beyond this database-free demo. Avoid simultaneous manual and scheduled runs.
- Does not automatically retry article creation because a timeout might follow a successful write. Inspect Shopify before retrying. Vercel cron does not provide automatic failed-job retries here; inspect logs and manually rerun as needed.
- Drafts occupy the weekly slot too. Changing `PUBLISH_ARTICLES` to true does not automatically publish an existing draft; publish that draft in Shopify.
- Logs only run IDs and safe status/error messages, never credentials or provider response bodies.
- The public landing page is static descriptive content, not a live health dashboard.
- Model-generated text is not fact-checked against live sources. Review the first outputs; SEO rankings are not guaranteed.

## Troubleshooting

| Result | Action |
| --- | --- |
| CONFIGURATION_ERROR | Fill the named environment variables; redeploy after Vercel changes |
| Shopify authentication HTTP 400/401/403 | Check client credentials, installation, and same-organization ownership |
| SHOPIFY_GRAPHQL_ERROR | Confirm scopes and API version; release/reinstall after scope changes |
| BLOG_NOT_FOUND | Confirm the blog is saved and its handle is `build-with-ai` |
| Gemini HTTP 400/404 | Check model availability and structured-output support |
| RATE_LIMITED | Free quota is exhausted; wait or select another eligible free model manually |
| INVALID_AI_OUTPUT / AI_GENERATION_INCOMPLETE | Nothing published; review model settings and retry within quota |
| UPSTREAM_UNREACHABLE during publishing | Inspect Shopify before retrying to avoid duplicates |
| already_exists | This week's article or draft is already present |
| 401 | Cron secret missing from request or does not match |
| 503 | Required server configuration is missing |
| Store password page | Expected for a development store; use its storefront password |

## Development checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Automated tests use mocked API responses and no credentials. They cover authorization, preview isolation, UTC scheduling, validation, HTML cleaning, success, duplicate checks, drafts, paused runs, quota failures and ambiguous timeouts. They cannot prove that your live credentials or free API quota work. Complete the live checks above after adding keys.

## Verification at delivery

- 18 automated tests passed using Node's built-in test tools.
- Strict TypeScript checking passed.
- Dependency audit reported zero known vulnerabilities at installation time.
- Production build was attempted but the build environment denied process creation (`spawn EPERM`). Production build completion is **not verified**; run `npm.cmd run build` in your normal terminal or review the Vercel build result.
- Live Gemini quota, Shopify authentication, article publishing and a real Vercel cron execution remain unverified until you add credentials and deploy.
- The requested destination was `D:\Jibran\shopify-ai-blog`, but this chat did not receive write access to that folder. Extract the supplied source archive there, then run `npm.cmd ci` and `npm.cmd run setup`.

## Official references

- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini pricing and free-tier availability](https://ai.google.dev/gemini-api/docs/pricing)
- [Shopify same-organization authentication](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant)
- [Shopify articleCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/articleCreate)
- [Vercel cron security and management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
