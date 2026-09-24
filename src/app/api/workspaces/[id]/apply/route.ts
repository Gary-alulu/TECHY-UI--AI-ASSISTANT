import { getWorkspace } from "@/lib/workspaces";
import { getInstalledApps, launchInstalledApp } from "@/lib/system/apps";
import { getDisplays } from "@/lib/system/devices";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const workspace = await getWorkspace(id);
  if (!workspace) return jsonResponse(request, { error: "Workspace not found" }, { status: 404 });

  const installed = await getInstalledApps();

  const resolveAppId = (appId?: string, appName?: string): string | null => {
    if (appId && installed.some((app) => app.id === appId)) return appId;
    if (appName) {
      const byName = installed.find((app) => app.name.toLowerCase() === appName.toLowerCase())
        ?? installed.find((app) => app.name.toLowerCase().includes(appName.toLowerCase().slice(0, 12)));
      if (byName) return byName.id;
    }
    return null;
  };

  const results: Array<{ slot: string; app: string; ok: boolean; error?: string }> = [];
  let failures = 0;
  for (const slot of workspace.slots) {
    const appId = resolveAppId(slot.appId, slot.appName);
    if (!appId) {
      results.push({ slot: slot.id, app: slot.appName ?? slot.appId ?? "unknown", ok: false, error: "No matching installed app found" });
      failures++;
      continue;
    }
    const launch = await launchInstalledApp(appId);
    results.push({ slot: slot.id, app: slot.appName ?? appId, ok: launch.ok, error: launch.error });
    if (!launch.ok) failures++;
  }

  const displays = await getDisplays().catch(() => []);
  const { logActivity } = await import("@/lib/activity");
  await logActivity({
    actor: "user",
    kind: "app",
    action: "Workspace launched",
    detail: `“${workspace.name}” opened ${results.length} windows across ${displays.length || 1} display(s)`,
  });

  return jsonResponse(
    request,
    { ok: failures === 0, launched: results.length, failures, results, displays },
    { status: failures === 0 ? 200 : 207, headers: { "Cache-Control": "no-store" } }
  );
}