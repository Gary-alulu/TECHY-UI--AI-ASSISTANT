import { getBranding, updateBranding, ALLOWED_FIELDS } from "@/lib/branding";
import { jsonResponse } from "@/lib/http/response";
import type { BrandingLite } from "@/lib/accents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const branding = await getBranding();
  return jsonResponse(request, { branding }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: Partial<BrandingLite>;
  try {
    body = (await request.json()) as Partial<BrandingLite>;
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse(request, { error: "Invalid body" }, { status: 400 });
  }
  const patch: Partial<BrandingLite> = {};
  for (const key of ALLOWED_FIELDS) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") Object.assign(patch, { [key]: value });
  }
  if (Object.keys(patch).length === 0) {
    return jsonResponse(request, { error: "No updatable fields provided" }, { status: 400 });
  }
  const branding = await updateBranding(patch);
  const { logActivity } = await import("@/lib/activity");
  await logActivity({ actor: "user", kind: "system", action: "Personalization updated", detail: patch.aiName ? `AI name is now “${patch.aiName}”` : "Appearance / preferences changed" });
  return jsonResponse(request, { ok: true, branding }, { status: 200, headers: { "Cache-Control": "no-store" } });
}