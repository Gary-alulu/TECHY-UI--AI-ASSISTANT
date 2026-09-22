import { jsonResponse } from "@/lib/http/response";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/system/favorites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const favorites = await listFavorites();
  return jsonResponse(request, { favorites }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { path?: unknown; name?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  const target = typeof body.path === "string" ? body.path.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = body.kind === "directory" ? "directory" : "file";
  if (!target) return jsonResponse(request, { error: "A path is required" }, { status: 400 });

  const favorites = await addFavorite({ path: target, name: name || target, kind });
  return jsonResponse(request, { favorites }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  let body: { path?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  const target = typeof body.path === "string" ? body.path.trim() : "";
  if (!target) return jsonResponse(request, { error: "A path is required" }, { status: 400 });

  const favorites = await removeFavorite(target);
  return jsonResponse(request, { favorites }, { headers: { "Cache-Control": "no-store" } });
}