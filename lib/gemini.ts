import type { Config } from "./config";
import { parseArticle } from "./content";
import { AppError } from "./errors";
import { requestJson } from "./http";

export async function generateArticle(config: Config, topic: string) {
  const prompt = `Write an original educational article for Build with AI, a developer blog by Sigma Web Hub.
Topic: ${topic}
Audience: beginner to intermediate web developers. Use clear English and concrete examples.
Write 600-900 words, with an introduction, descriptive h2/h3 headings, practical steps and a short conclusion.
Return only the requested JSON. body_html must be an HTML fragment, never Markdown fences or a full document.
Use only h2,h3,p,ul,ol,li,strong,em,blockquote,pre,code,br. Escape code inside code elements.
No links, images, scripts, CSS, h1 tags or event attributes. The title is displayed separately.
Include 3-5 relevant tags and a plain-text excerpt of 120-250 characters.
Do not invent research, statistics, citations, benchmarks, product claims or personal experience.
Avoid current pricing, release claims and exact software versions. Explain stable concepts.
No promises of SEO rankings. Do not imply this Gemini-powered demo uses Claude.
Use a useful, natural title rather than clickbait.`;
  const result = await requestJson<{
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  }>(`https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" }, body_html: { type: "STRING" },
            tags: { type: "ARRAY", items: { type: "STRING" } }, summary: { type: "STRING" }
          },
          required: ["title", "body_html", "tags", "summary"]
        }
      }
    })
  }, "Gemini", 100000);
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== "STOP") {
    throw new AppError("AI_GENERATION_INCOMPLETE", "Gemini blocked or truncated the article. Nothing was published.");
  }
  return parseArticle(candidate.content?.parts?.filter(p => !p.thought).map(p => p.text ?? "").join("") ?? "");
}
