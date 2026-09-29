import { z } from "zod";
import { AppError } from "./errors";

const flag = z.enum(["true", "false"]).transform(value => value === "true");
const schema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MODEL: z.string().regex(/^[a-zA-Z0-9.-]+$/).default("gemini-2.5-flash"),
  SHOPIFY_STORE_DOMAIN: z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/),
  SHOPIFY_CLIENT_ID: z.string().default(""),
  SHOPIFY_CLIENT_SECRET: z.string().default(""),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().default(""),
  SHOPIFY_API_VERSION: z.string().regex(/^20\d{2}-(01|04|07|10)$/).default("2026-07"),
  SHOPIFY_BLOG_ID: z.string().regex(/^(|\d+|gid:\/\/shopify\/Blog\/\d+)$/).default(""),
  SHOPIFY_BLOG_HANDLE: z.string().regex(/^[a-z0-9-]+$/).default("build-with-ai"),
  BLOG_AUTHOR: z.string().trim().min(1).max(100).default("Sigma Web Hub"),
  PUBLISH_ARTICLES: flag.default(true),
  AUTOMATION_ENABLED: flag.default(true),
  PUBLISH_EVERY_WEEKS: z.enum(["1", "2"]).default("1").transform(Number),
  SCHEDULE_ANCHOR: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-09-28")
});
export type Config = z.infer<typeof schema>;

export function getConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join(".")))];
    throw new AppError("CONFIGURATION_ERROR", `Missing or invalid settings: ${fields.join(", ")}`, 503);
  }
  const c = parsed.data;
  if (!c.SHOPIFY_ADMIN_ACCESS_TOKEN && (!c.SHOPIFY_CLIENT_ID || !c.SHOPIFY_CLIENT_SECRET)) {
    throw new AppError("CONFIGURATION_ERROR", "Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.", 503);
  }
  const anchor = new Date(`${c.SCHEDULE_ANCHOR}T00:00:00Z`);
  if (!Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== c.SCHEDULE_ANCHOR || anchor.getUTCDay() !== 1) {
    throw new AppError("CONFIGURATION_ERROR", "SCHEDULE_ANCHOR must be a valid Monday date.", 503);
  }
  return c;
}
