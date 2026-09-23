import { getActivity, clearActivity, logActivity } from "@/lib/activity";
import { jsonResponse } from "@/lib/http/response";
import type { ActivityKind } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") ?? undefined) as ActivityKind | undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const activities = await getActivity({ kind, limit });
  return jsonResponse(request, { activities });
}

export async function POST(request: Request) {
  let body: { kind?: unknown; action?: unknown; detail?: unknown; actor?: unknown; meta?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.action !== "string" || !body.action.trim()) {
    return jsonResponse(request, { error: "A human-readable action is required" }, { status: 400 });
  }
  const kind = (typeof body.kind === "string" ? body.kind : "chat") as ActivityKind;
  const detail = typeof body.detail === "string" ? body.detail : "";
  const actor = body.actor === "automation" ? "automation" : body.actor === "techy" ? "techy" : "user";
  await logActivity({ actor, kind, action: body.action, detail, meta: typeof body.meta === "object" && body.meta !== null ? (body.meta as Record<string, unknown>) : undefined });
  return jsonResponse(request, { ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  await clearActivity();
  return jsonResponse(request, { ok: true });
}