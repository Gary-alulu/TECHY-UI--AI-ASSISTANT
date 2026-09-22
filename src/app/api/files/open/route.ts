import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import { touchRecent } from "@/lib/system/recents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function openPath(target: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", `"${target}"`] : [target];

    const child = spawn(/*turbopackIgnore: true*/ command, args, { detached: true, stdio: "ignore", windowsHide: false });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: "Timed out opening the target" });
    }, 8000);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
    child.once("spawn", () => {
      clearTimeout(timer);
      child.unref();
      resolve({ ok: true });
    });
  });
}

export async function POST(request: Request) {
  let target: unknown;
  try {
    const body = (await request.json()) as { path?: unknown };
    target = body.path;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (typeof target !== "string" || !target.trim() || !path.isAbsolute(target)) {
    return Response.json({ ok: false, error: "An absolute path is required" }, { status: 400 });
  }

  const result = await openPath(target.trim());
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error ?? "Failed to open" }, { status: 500 });
  }

  try {
    const stat = await fs.stat(target.trim());
    void touchRecent({
      path: target.trim(),
      name: path.basename(target.trim()),
      kind: stat.isDirectory() ? "directory" : "file",
      size: stat.isDirectory() ? undefined : stat.size,
    });
  } catch {
    // recents are best-effort
  }

  return Response.json({ ok: true, path: target.trim() });
}