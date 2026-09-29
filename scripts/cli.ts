import { mkdir, writeFile } from "node:fs/promises";
import { getConfig } from "../lib/config";
import { publicError } from "../lib/errors";
import { generateArticle } from "../lib/gemini";
import { runPipeline } from "../lib/pipeline";
import { Shopify } from "../lib/shopify";
import { scheduledTopic } from "../lib/topics";

async function main() {
  const command = process.argv[2];
  const config = getConfig();
  if (command === "check") {
    const blog = await new Shopify(config).blog();
    console.log(JSON.stringify({ status: "connected", blog }, null, 2));
  } else if (command === "preview") {
    const selection = scheduledTopic(new Date(), config.SCHEDULE_ANCHOR, config.PUBLISH_EVERY_WEEKS);
    const article = await generateArticle(config, selection.topic.title);
    await mkdir("preview", { recursive: true });
    await writeFile("preview/article.json", JSON.stringify(article, null, 2));
    await writeFile("preview/article.html", `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Article preview</title><body><main style="max-width:760px;margin:50px auto;padding:24px;font:18px/1.7 system-ui">${article.body_html}</main></body></html>`);
    console.log("Generated preview/article.html and preview/article.json. Nothing was published.");
  } else if (command === "publish") {
    if (!process.argv.includes("--confirm")) throw new Error("Use npm run publish:article -- --confirm to publish this week's article.");
    console.log(JSON.stringify(await runPipeline(), null, 2));
  } else throw new Error("Unknown command. Use check, preview or publish.");
}
main().catch(error => {
  if (error instanceof Error && (error.message.startsWith("Use npm") || error.message.startsWith("Unknown"))) console.error(error.message);
  else console.error(publicError(error));
  process.exitCode = 1;
});
