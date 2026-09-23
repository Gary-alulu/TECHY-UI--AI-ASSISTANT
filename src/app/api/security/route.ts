import { getSecurityPolicy, updateSecurityPolicy, CATEGORY_LABELS } from "@/lib/security";
import { jsonResponse } from "@/lib/http/response";
import type { SecurityPolicy } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const policy = await getSecurityPolicy();
  return jsonResponse(request, { policy, categories: CATEGORY_LABELS });
}

export async function POST(request: Request) {
  let body: Partial<SecurityPolicy>;
  try {
    body = (await request.json()) as Partial<SecurityPolicy>;
  } catch {
    return jsonResponse(request, { error: "Invalid request body" }, { status: 400 });
  }
  const allowed = ["fileAccess", "appLaunch", "terminal", "deleteFiles", "systemSettings", "network", "localOnly", "logActivity"] as const;
  const patch: Partial<SecurityPolicy> = {};
  for (const key of allowed) {
    const value = body[key];
    if (key === "localOnly" || key === "logActivity") {
      if (typeof value === "boolean") patch[key] = value;
    } else {
      if (value === "allowed" || value === "confirm" || value === "restricted") patch[key] = value;
    }
  }
  const policy = await updateSecurityPolicy(patch);
  return jsonResponse(request, { policy });
}