import { addWorkspace, getWorkspaces } from "@/lib/workspaces";
import { jsonResponse } from "@/lib/http/response";
import type { WorkspaceSlot } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSITIONS = ["left", "right", "secondary", "bottom", "overlay"];

function cleanSlots(value: unknown): WorkspaceSlot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => ({
      id: typeof item.id === "string" ? item.id : `slot-${index}`,
      appId: typeof item.appId === "string" ? item.appId : undefined,
      appName: typeof item.appName === "string" ? item.appName : undefined,
      position: POSITIONS.includes(String(item.position)) ? (item.position as WorkspaceSlot["position"]) : "left",
      display: typeof item.display === "string" ? item.display : "Main work",
    }))
    .slice(0, 24);
}

export async function GET(request: Request) {
  const workspaces = await getWorkspaces();
  return jsonResponse(request, { workspaces }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { name?: unknown; description?: unknown; slots?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonResponse(request, { error: "Workspace name is required" }, { status: 400 });

  const workspace = await addWorkspace({
    name,
    description: typeof body.description === "string" ? body.description : undefined,
    slots: cleanSlots(body.slots),
  });
  return jsonResponse(request, { workspace }, { status: 201, headers: { "Cache-Control": "no-store" } });
}