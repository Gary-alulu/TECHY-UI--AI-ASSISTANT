import { buildBriefing, getBriefingConfig, updateBriefingConfig } from "@/lib/briefing";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [briefing, config] = await Promise.all([buildBriefing(), getBriefingConfig()]);
  return jsonResponse(request, { briefing, config }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { sections?: Record<string, unknown>; greeting?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  const sections: Record<string, boolean> = {};
  if (body.sections && typeof body.sections === "object") {
    for (const [key, value] of Object.entries(body.sections)) {
      if (typeof value === "boolean") sections[key] = value;
    }
  }
  const config = await updateBriefingConfig({
    sections,
    greeting: typeof body.greeting === "string" ? body.greeting : undefined,
  });
  return jsonResponse(request, { config });
}