# Shopify AI Blog Publisher

A Next.js and TypeScript application that generates developer-focused articles with Google Gemini and publishes them to a Shopify blog.

The workflow selects a topic, requests structured article content, validates and sanitizes the response, and publishes through Shopify’s GraphQL Admin API. Vercel Cron provides scheduled execution.

## Features

- AI article generation with Google Gemini.
- A configurable rotation of 12 development and AI topics.
- Structured output containing a title, HTML body, tags, and excerpt.
- Content validation and HTML sanitization before publishing.
- Shopify blog discovery by handle or explicit ID.
- Automatic Shopify access-token acquisition for same-organization apps.
- A protected publishing endpoint.
- Weekly or alternate-week publishing.
- Draft mode and an automation pause setting.
- Best-effort duplicate prevention.
- Local preview and publishing commands.
- Automated tests using mocked API responses.

No database or Shopify theme modifications are required.

## Workflow

```text
Vercel Cron or authorized manual request
    → Select the current week's topic
    → Find the destination Shopify blog
    → Check for an existing weekly article
    → Generate content with Gemini
    → Validate and sanitize the response
    → Check again for an existing article
    → Publish to Shopify
```

The included landing page describes the workflow. It does not display live connection or publishing status.

## Technology

- Next.js App Router
- TypeScript
- Google Gemini API
- Shopify GraphQL Admin API
- Vercel Cron
- Zod
- sanitize-html
- Node.js built-in test tools

## Requirements

- Node.js 22.12 or newer.
- A Gemini API key with access to a supported text-generation model.
- A Shopify store with a destination blog.
- A Shopify app installed on that store with `read_content` and `write_content` permissions.
- A Vercel account for hosted scheduling, if required.

For the client-credentials authentication flow, the Shopify app and store must belong to the same Shopify organization.

Development stores can be used for testing. Their storefronts remain password-protected.

## Quick Start

Clone the repository and open a terminal in its directory.

```bash
npm ci
npm run setup
```

On Windows PowerShell, use `npm.cmd` if execution policy prevents `npm` from running.

The setup command creates `.env.local` and generates a random `CRON_SECRET`. It does not overwrite an existing environment file.

Fill in these values:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.1-flash-lite

SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret
SHOPIFY_BLOG_HANDLE=your-blog-handle
```

Keep the generated `CRON_SECRET`.

**Set `GEMINI_MODEL` explicitly to `gemini-3.1-flash-lite`.** This model was used in the successful live demonstration. If your copy of `.env.example` contains `gemini-2.5-flash`, replace that value.

The supplied demo configuration points to `sigma-ai-blog.myshopify.com` and the `build-with-ai` blog. Replace these with your own store and blog when reusing the project.

Leave `SHOPIFY_BLOG_ID` blank to discover the blog by handle.

## Test the Connections

### Check Shopify access

```bash
npm run check:shopify
```

This authenticates with Shopify and returns the destination blog’s ID, handle, and title. It does not publish an article.

### Generate a local preview

```bash
npm run preview:article
```

This calls Gemini and saves:

```text
preview/article.html
preview/article.json
```

Review the generated content before testing publication.

The preview command consumes API quota but does not write to Shopify.

### Publish an article

```bash
npm run publish:article -- --confirm
```

This generates a new article for the current publishing week and sends it to Shopify. It does not publish the previously saved preview.

The result includes the article ID, publication status, and storefront URL.

If an article already exists for that week, the command normally returns:

```text
already_exists
```

### Test the HTTP endpoint

Start the application:

```bash
npm run dev
```

In another terminal, run:

```bash
npm run trigger
```

The trigger command reads `CRON_SECRET` from `.env.local` and sends an authorized request to:

```text
http://localhost:3000/api/cron/generate-blog
```

A request without a valid secret is rejected. The HTTP endpoint and local publishing command use the same weekly article identifier.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required Gemini API key. |
| `GEMINI_MODEL` | Set explicitly to `gemini-3.1-flash-lite`, the model used in the live demo. |
| `SHOPIFY_STORE_DOMAIN` | Your `myshopify.com` domain, without a scheme or path. |
| `SHOPIFY_CLIENT_ID` | Shopify app client ID. |
| `SHOPIFY_CLIENT_SECRET` | Shopify app client secret. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Optional alternative for an app with a suitable existing access token. Leave blank when using client credentials. |
| `SHOPIFY_API_VERSION` | Shopify API version. The demo uses `2026-07`. |
| `SHOPIFY_BLOG_HANDLE` | Destination blog handle, such as `build-with-ai`. |
| `SHOPIFY_BLOG_ID` | Optional numeric blog ID or Shopify GraphQL ID. Overrides handle-based discovery. |
| `BLOG_AUTHOR` | Article author name. The supplied configuration uses `Sigma Web Hub`. |
| `CRON_SECRET` | Secret protecting the HTTP endpoint. Must contain at least 32 characters. Generated by setup. |
| `PUBLISH_ARTICLES` | `true` publishes immediately; `false` creates drafts. |
| `AUTOMATION_ENABLED` | Set to `false` to pause publishing. |
| `PUBLISH_EVERY_WEEKS` | `1` for weekly publishing or `2` for alternate weeks. |
| `SCHEDULE_ANCHOR` | A Monday date in `YYYY-MM-DD` format used to calculate topic rotation and alternate weeks. |

Store credentials only in `.env.local` or your hosting platform’s environment settings. Never expose them through `NEXT_PUBLIC_` variables.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import it into Vercel as a Next.js project.
3. Select a supported Node.js version satisfying the project’s requirements.
4. Add your environment variables to Vercel’s **Production** environment.
5. Set `GEMINI_MODEL=gemini-3.1-flash-lite` explicitly.
6. Deploy the project.
7. Confirm the publishing route appears under **Settings → Cron Jobs**.
8. Inspect deployment and runtime logs before relying on scheduled publishing.

Your local `.env.local` file is excluded from Git and will not be uploaded through GitHub. Add its values separately in Vercel.

The route requests a maximum execution duration of 300 seconds. Confirm that your Vercel project configuration supports this duration.

### Run immediately after deployment

From your local project directory:

```bash
npm run trigger -- https://YOUR-PROJECT.vercel.app
```

The command asks you to confirm the destination before sending the cron secret.

If deployment protection blocks the request, use the Cron **Run** action in the Vercel dashboard.

An article created during local testing already occupies that week’s publishing slot. Receiving `already_exists` after deployment is expected.

## Publishing Schedule

The included `vercel.json` contains:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/generate-blog",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

This schedules publishing every Monday at:

- **08:00 UTC**
- **13:00 Pakistan time**

Vercel registers the schedule from the production deployment. Deployment itself does not immediately publish an article.

On Vercel Hobby, execution may occur within the scheduled hour. Preview deployments are explicitly prevented from publishing by the route.

### Publish every other week

Keep the weekly cron expression and set:

```dotenv
PUBLISH_EVERY_WEEKS=2
```

The application skips alternate weeks based on `SCHEDULE_ANCHOR`.

### Pause publishing

Set:

```dotenv
AUTOMATION_ENABLED=false
```

Redeploy after changing Vercel environment variables so the new settings take effect.

## Customize the Content

Edit `lib/topics.ts` to change the topic rotation.

The included topics cover AI integration, development workflows, API security, debugging, testing, and automation. Topics repeat after the rotation finishes.

Edit `lib/gemini.ts` to adjust the audience, tone, requested article length, and generation instructions.

The current prompt requests 600–900 words. Validation requires at least 300 words after HTML cleaning; it does not enforce the full requested range.

Generated articles include:

- A title.
- An HTML body with section headings.
- Tags.
- A summary excerpt.

Links, images, scripts, styling, and HTML attributes are removed from the article body by the sanitizer.

## Reliability and Limitations

### Duplicate prevention

Each publishing week has a predictable article handle. The application checks for that handle before and after AI generation.

A process-local guard also prevents overlapping HTTP runs within the same server instance.

**This is best-effort duplicate prevention, not an exactly-once guarantee.** Concurrent serverless instances and Shopify search-indexing delays can still create races. Strict guarantees require durable coordination beyond this database-free implementation.

Avoid running manual and scheduled publication simultaneously.

### Failure handling

The application rejects malformed, truncated, or invalid AI output before publication.

It does not automatically retry article creation because a failed response may occur after Shopify has accepted the article. Inspect the store before retrying an ambiguous publishing failure.

Failure notifications and automatic retry scheduling are not included. Check runtime logs and rerun manually when appropriate.

### Draft mode

Set:

```dotenv
PUBLISH_ARTICLES=false
```

to create drafts.

Drafts occupy the weekly publishing slot. Changing this setting to `true` does not publish an existing draft automatically; publish it through Shopify.

### Content quality

Generated content is not independently fact-checked against live sources. Review initial outputs and adjust the prompts for your audience.

The project does not guarantee search-engine rankings or content accuracy.

### API usage and hosting

Gemini free-tier availability and quotas depend on the model and account. The application does not enable billing or switch to a paid provider when a request fails.

Vercel Hobby is intended for personal, non-commercial use. Choose an appropriate hosting plan for commercial deployments.

The generation and Shopify publishing workflow can also run locally without hosted scheduling.

## Security

- The HTTP publishing route requires a Bearer token matching `CRON_SECRET`.
- Authorization is checked before external API calls.
- Responses from the publishing route are not cached.
- Credentials remain server-side.
- Logs contain run identifiers and controlled error messages rather than credentials.
- Generated HTML is sanitized before publication.
- Preview deployments cannot publish through the HTTP route.

The supplied `.gitignore` excludes:

```text
.env.local
node_modules/
.next/
.vercel/
preview/
.test-build/
```

Commit `.env.example` with placeholder values only. Check staged files before pushing to a public repository.

## Verification Status

The following checks were completed during development:

- 18 automated tests passed.
- Strict TypeScript checking passed.
- The dependency audit reported no known vulnerabilities at the time of testing.
- Shopify authentication and blog discovery succeeded.
- Gemini generated a valid article using `gemini-3.1-flash-lite`.
- An article was published to the development store.
- The saved article’s publication status, headings, tags, and excerpt were verified through Shopify’s API.
- A repeated publishing run returned `already_exists`.

The following remain unverified:

- Successful production build completion.
- Deployment to Vercel.
- Execution from an actual Vercel cron schedule.

The development environment blocked the production build with a process-creation permission error. Run the build in your own environment and verify the deployed schedule before relying on unattended publishing.

## Development Checks

```bash
npm test
npm run typecheck
npm run build
```

Automated tests use mocked API responses and do not require credentials.

They cover authorization, preview-deployment protection, scheduling, configuration validation, HTML sanitization, successful publishing, duplicate checks, draft creation, paused execution, quota errors, and ambiguous publishing timeouts.

## Troubleshooting

| Result | Suggested action |
| --- | --- |
| `CONFIGURATION_ERROR` | Fill in the named environment variables and verify their format. |
| Shopify authentication failure | Check app credentials, installation, and same-organization ownership. |
| `SHOPIFY_GRAPHQL_ERROR` | Verify API version and approved content permissions. |
| `BLOG_NOT_FOUND` | Check the destination blog handle or ID. |
| Gemini HTTP 400 or 404 | Check model availability and structured-output support. Set the tested model explicitly. |
| `RATE_LIMITED` | Check quota and rate limits; wait before retrying. |
| `INVALID_AI_OUTPUT` | The generated content failed validation and was not published. |
| `AI_GENERATION_INCOMPLETE` | Generation was blocked or truncated; no article was published. |
| `UPSTREAM_UNREACHABLE` | Check service availability. Inspect Shopify before retrying a publishing attempt. |
| `already_exists` | An article or draft already occupies the current week’s slot. |
| HTTP 401 | The request’s cron secret is missing or incorrect. |
| HTTP 403 on a preview deployment | Publishing is intentionally disabled outside production. |
| HTTP 503 | Check the response message for missing application configuration. |
| Storefront password page | Expected for a Shopify development store. |

## Documentation

- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini pricing and free-tier availability](https://ai.google.dev/gemini-api/docs/pricing)
- [Shopify client-credentials authentication](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant)
- [Shopify article creation](https://shopify.dev/docs/api/admin-graphql/latest/mutations/articleCreate)
- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
