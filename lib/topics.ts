export const topics = [
  { slug: "first-ai-automation", title: "Build your first AI automation: a practical guide for developers" },
  { slug: "debug-with-ai", title: "How to debug code with AI while checking every suggestion" },
  { slug: "structured-ai-output", title: "Why structured JSON makes AI integrations more reliable" },
  { slug: "protect-api-keys", title: "How to protect API keys in a Next.js application" },
  { slug: "ai-code-review", title: "A practical checklist for reviewing AI-generated code" },
  { slug: "prompt-context", title: "How to give an AI coding assistant useful project context" },
  { slug: "cron-automation", title: "From manual task to scheduled automation: understanding cron jobs" },
  { slug: "api-failure-handling", title: "Handling timeouts and API failures in AI-powered applications" },
  { slug: "ai-test-design", title: "Using AI to suggest meaningful tests for your application" },
  { slug: "human-review", title: "Where human judgment belongs in an automated content workflow" },
  { slug: "small-ai-projects", title: "Five small AI integration projects to practice backend development" },
  { slug: "ai-output-validation", title: "Validate before you publish: working safely with generated HTML" }
] as const;

export function scheduledTopic(now: Date, anchor: string, cadence: number) {
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const week = Math.floor((monday.getTime() - Date.parse(`${anchor}T00:00:00Z`)) / 604800000);
  const due = week >= 0 && week % cadence === 0;
  const rotation = Math.floor(week / cadence);
  const topic = topics[((rotation % topics.length) + topics.length) % topics.length];
  const period = monday.toISOString().slice(0, 10);
  return { topic, period, due, handle: `build-with-ai-${period}` };
}
