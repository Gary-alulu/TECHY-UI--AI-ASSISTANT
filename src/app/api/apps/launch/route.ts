import type { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { getLaunchCommand, QUICK_APPS } from "@/lib/apps/catalog";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let id: unknown;

  try {
    const body = await request.json();
    id = body?.id;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (typeof id !== "string" || !Object.hasOwn(QUICK_APPS, id)) {
    return Response.json({ ok: false, error: "Unknown app" }, { status: 404 });
  }

  const app = QUICK_APPS[id];
  const command = getLaunchCommand(app);

  if (!command) {
    return Response.json({
      ok: false,
      error: `No native launch command for ${process.platform}`,
    });
  }

  try {
    await launch(command);
    return Response.json({ ok: true, app: app.name, command: command.join(" ") });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Launch failed",
    });
  }
}

function launch([executable, ...args]: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Launch timed out"));
    }, 8000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("spawn", () => {
      clearTimeout(timer);
      child.unref();
      resolve();
    });
  });
}
