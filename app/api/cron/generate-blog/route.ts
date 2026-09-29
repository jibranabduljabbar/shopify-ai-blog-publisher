import { authorized } from "../../../../lib/auth";
import { publicError } from "../../../../lib/errors";
import { runPipeline } from "../../../../lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
let running = false;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) {
    return Response.json({ error: "Configure CRON_SECRET with at least 32 characters." }, { status: 503, headers });
  }
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return Response.json({ error: "Publishing is disabled on preview deployments." }, { status: 403, headers });
  }
  // Best effort within one process, not a distributed lock across Vercel instances.
  if (running) return Response.json({ error: "A run is already in progress." }, { status: 409, headers });
  running = true;
  const runId = crypto.randomUUID();
  try {
    const result = await runPipeline();
    console.info(JSON.stringify({ runId, status: result.status }));
    return Response.json({ runId, ...result }, { headers });
  } catch (error) {
    const safe = publicError(error);
    console.error(JSON.stringify({ runId, code: safe.code, message: safe.message }));
    return Response.json({ runId, error: safe.code, message: safe.message }, { status: safe.status, headers });
  } finally { running = false; }
}
