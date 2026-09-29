import { getConfig } from "./config";
import { generateArticle } from "./gemini";
import { Shopify } from "./shopify";
import { scheduledTopic } from "./topics";

export async function runPipeline(now = new Date()) {
  const config = getConfig();
  if (!config.AUTOMATION_ENABLED) return { status: "skipped", reason: "Automation is paused." };
  const selection = scheduledTopic(now, config.SCHEDULE_ANCHOR, config.PUBLISH_EVERY_WEEKS);
  if (!selection.due) return { status: "skipped", reason: "This is not a publishing week." };
  const shopify = new Shopify(config);
  const blog = await shopify.blog();
  const existing = await shopify.existing(blog, selection.handle);
  if (existing) return { status: "already_exists", article: existing, url: shopify.url(blog, existing) };
  const content = await generateArticle(config, selection.topic.title);
  // Check again after generation to reduce races with a manual invocation.
  const createdMeanwhile = await shopify.existing(blog, selection.handle);
  if (createdMeanwhile) return { status: "already_exists", article: createdMeanwhile, url: shopify.url(blog, createdMeanwhile) };
  // Never automatically retry a create: a timeout can follow a successful write.
  const article = await shopify.create(blog, selection.handle, content);
  return { status: article.isPublished ? "published" : "draft_created", article, url: shopify.url(blog, article), topic: selection.topic.title, period: selection.period };
}
