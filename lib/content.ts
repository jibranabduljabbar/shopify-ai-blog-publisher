import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { AppError } from "./errors";

const articleSchema = z.object({
  title: z.string().trim().min(10).max(150),
  body_html: z.string().min(200).max(60000),
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  summary: z.string().trim().min(30).max(500)
});
export type ArticleContent = z.infer<typeof articleSchema>;
const plain = (value: string) => sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();

export function parseArticle(raw: string): ArticleContent {
  let result: z.infer<typeof articleSchema>;
  try { result = articleSchema.parse(JSON.parse(raw)); }
  catch { throw new AppError("INVALID_AI_OUTPUT", "AI returned incomplete or invalid article JSON. Nothing was published."); }
  const cleaned = {
    title: plain(result.title),
    summary: plain(result.summary),
    tags: [...new Set(result.tags.map(plain).filter(Boolean))],
    body_html: sanitizeHtml(result.body_html, {
      allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "blockquote", "pre", "code", "br"],
      allowedAttributes: {}
    })
  };
  const valid = articleSchema.safeParse(cleaned);
  if (!valid.success || plain(cleaned.body_html).split(/\s+/).length < 300 || !/<h2>/.test(cleaned.body_html)) {
    throw new AppError("INVALID_AI_OUTPUT", "Article is too short or missing headings after HTML cleaning. Nothing was published.");
  }
  return valid.data;
}
