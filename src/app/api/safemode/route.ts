import { getSafeMode, safeModeBlocks, setSafeCapability, setSafeMode } from "@/lib/safemode";
import { jsonResponse } from "@/lib/http/response";
import type { SafeModeCapability } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const state = await getSafeMode();
  return jsonResponse(request, { state }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;

  if (action === "toggle") {
    const active = body.active === true;
    const state = await setSafeMode(active);
    return jsonResponse(request, { state }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "capability") {
    const capability = body.capability as SafeModeCapability | undefined;
    const allowed = body.allowed === true;
    if (!capability || typeof capability !== "string") {
      return jsonResponse(request, { error: "capability is required" }, { status: 400 });
    }
    if (!["chat", "fileRead", "systemMonitor", "fileModify", "appControl", "terminal", "automation"].includes(capability)) {
      return jsonResponse(request, { error: "Unknown capability" }, { status: 400 });
    }
    const state = await setSafeCapability(capability, allowed);
    return jsonResponse(request, { state }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "check") {
    const capability = body.capability as SafeModeCapability | undefined;
    if (!capability || typeof capability !== "string") {
      return jsonResponse(request, { error: "capability is required" }, { status: 400 });
    }
    const blocked = await safeModeBlocks(capability);
    return jsonResponse(request, { blocked }, { headers: { "Cache-Control": "no-store" } });
  }

  return jsonResponse(request, { error: "Unknown action" }, { status: 400 });
}