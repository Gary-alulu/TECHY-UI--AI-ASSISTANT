import { conductResearch, researchGate, type ResearchGate } from "@/lib/research";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { question?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const scope = body.scope === "local" ? "local" : body.scope === "web" ? "web" : "web";
  if (!question) {
    return jsonResponse(request, { error: "question is required" }, { status: 400 });
  }
  if (question.length > 500) {
    return jsonResponse(request, { error: "question is too long (max 500 chars)" }, { status: 400 });
  }

  const gate: ResearchGate = await researchGate(scope);
  if (!gate.allowed) {
    return jsonResponse(request, { error: "gated", reason: gate.reason, internet: gate.internet, network: gate.network }, { status: 403 });
  }

  const report = await conductResearch(question, gate.mode, {
    internet: gate.internet,
    fallback: scope === "web" && gate.mode === "local" ? "no-internet" : undefined,
  });
  return jsonResponse(request, report, { headers: { "Cache-Control": "no-store" } });
}