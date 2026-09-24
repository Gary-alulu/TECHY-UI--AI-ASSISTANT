import { getLab, saveLab, toggleLoadModel } from "@/lib/models";
import { jsonResponse } from "@/lib/http/response";
import type { ModelLabState, RouterRule } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { lab, online } = await getLab();
  return jsonResponse(request, { lab, online }, { headers: { "Cache-Control": "no-store" } });
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
    const name = typeof body.name === "string" ? body.name : "";
    const loaded = body.loaded === true;
    if (!name) return jsonResponse(request, { error: "Model name required" }, { status: 400 });
    const lab = await toggleLoadModel(name, loaded);
    return jsonResponse(request, { lab }, { headers: { "Cache-Control": "no-store" } });
  }

  const patch: Partial<Pick<ModelLabState, "router" | "loadedModelNames" | "settings">> = {};
  if (Array.isArray(body.router)) patch.router = body.router as RouterRule[];
  if (Array.isArray(body.loadedModelNames)) patch.loadedModelNames = body.loadedModelNames.filter((item): item is string => typeof item === "string");
  if (body.settings && typeof body.settings === "object") patch.settings = body.settings as Partial<Pick<ModelLabState, "settings">>["settings"];

  const lab = await saveLab(patch);
  return jsonResponse(request, { lab }, { headers: { "Cache-Control": "no-store" } });
}