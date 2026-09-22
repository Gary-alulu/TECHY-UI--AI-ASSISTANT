import type { NextRequest } from "next/server";
import { launchInstalledApp } from "@/lib/system/apps";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let id: unknown;
  try {
    const body = await request.json();
    id = body?.id;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (typeof id !== "string" || !id.trim()) {
    return Response.json({ ok: false, error: "Missing app id" }, { status: 400 });
  }

  try {
    const result = await launchInstalledApp(id);
    return Response.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Launch failed" },
      { status: 500 }
    );
  }
}