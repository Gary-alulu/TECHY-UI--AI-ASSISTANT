import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inspectImage } from "@/lib/imaging";
import type { ImageInspection } from "@/types";

const runAsync = promisify(execFile) as (command: string, args: string[], options: { timeout?: number; windowsHide?: boolean }) => Promise<{ stdout: string }>;

function execFileAsync(command: string, args: string[], timeout = 15_000): Promise<string> {
  return runAsync(command, args, { timeout, windowsHide: true }).then((result) => result.stdout);
}

const SCREEN_DIR = path.join(process.cwd(), "data", "screen");
const SNAPSHOT_PATH = path.join(SCREEN_DIR, "last.png");

export interface ForegroundWindow {
  title: string;
  process: string | null;
  pid: number | null;
  at: string;
}

export interface ScreenSnapshot {
  saved: boolean;
  path: string;
  width: number;
  height: number;
  bytes: number;
  at: string;
  inspection: ImageInspection | null;
  error?: string;
}

const CS_TYPE =
  "using System; using System.Runtime.InteropServices; using System.Text; public static class ScAware { " +
  "[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); " +
  "[DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count); " +
  "[DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); }";

const FOREGROUND_SCRIPT = [
  `Add-Type -TypeDefinition '${CS_TYPE}'`,
  "$hwnd = [ScAware]::GetForegroundWindow()",
  "$sb = New-Object System.Text.StringBuilder 256",
  "[void][ScAware]::GetWindowText($hwnd, $sb, 256)",
  "$procId = 0",
  "[void][ScAware]::GetWindowThreadProcessId($hwnd, [ref]$procId)",
  "$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue",
  'if ($proc) { $procName = $proc.ProcessName } else { $procName = "" }',
  "$result = [PSCustomObject]@{ title = $sb.ToString(); pid = $procId; process = $procName }",
  "$result | ConvertTo-Json -Compress",
].join("; ");

export async function getForegroundWindow(): Promise<ForegroundWindow | null> {
  try {
    const stdout = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", FOREGROUND_SCRIPT], 12_000);
    const parsed = JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? "{}") as { title?: string; pid?: number; process?: string };
    const title = (parsed.title ?? "").trim();
    return {
      title: title || "(no visible window)",
      process: parsed.process || null,
      pid: typeof parsed.pid === "number" && parsed.pid > 0 ? parsed.pid : null,
      at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function captureScript(dataDir: string): string {
  const dir = dataDir.replace(/'/g, "''");
  return [
    'Add-Type -AssemblyName System.Drawing',
    'Add-Type -AssemblyName System.Windows.Forms',
    "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
    "$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height",
    "$g = [System.Drawing.Graphics]::FromImage($bmp)",
    "$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)",
    "$g.Dispose()",
    `$dir = '${dir}'`,
    "[System.IO.Directory]::CreateDirectory($dir) | Out-Null",
    "$path = Join-Path $dir 'last.png'",
    "$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)",
    "$bmp.Dispose()",
    "$data = Get-Item $path",
    "$result = [PSCustomObject]@{ width = $bounds.Width; height = $bounds.Height; bytes = $data.Length; path = $data.FullName }",
    "$result | ConvertTo-Json -Compress",
  ].join("; ");
}

export async function captureScreen(): Promise<ScreenSnapshot> {
  try {
    const stdout = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", captureScript(SCREEN_DIR)], 20_000);
    const parsed = JSON.parse(stdout.trim().split(/\r?\n/).pop() ?? "{}") as { width?: number; height?: number; bytes?: number; path?: string };
    await fs.stat(SNAPSHOT_PATH).catch(() => {
      throw new Error("Screen capture produced no file");
    });
    const inspection = await inspectImage(SNAPSHOT_PATH).catch(() => null);
    return {
      saved: true,
      path: "data/screen/last.png",
      width: parsed.width ?? 0,
      height: parsed.height ?? 0,
      bytes: parsed.bytes ?? 0,
      at: new Date().toISOString(),
      inspection,
    };
  } catch (error) {
    return {
      saved: false,
      path: SNAPSHOT_PATH,
      width: 0,
      height: 0,
      bytes: 0,
      at: new Date().toISOString(),
      inspection: null,
      error: error instanceof Error ? error.message : "Screen capture failed",
    };
  }
}

export async function getLastSnapshot(): Promise<ScreenSnapshot | null> {
  try {
    const stat = await fs.stat(SNAPSHOT_PATH);
    const inspection = await inspectImage(SNAPSHOT_PATH).catch(() => null);
    const { width, height, bytes } = inspection ?? {};
    return {
      saved: true,
      path: "data/screen/last.png",
      width: width ?? 0,
      height: height ?? 0,
      bytes: bytes ?? stat.size,
      at: stat.mtime.toISOString(),
      inspection: inspection ?? null,
    };
  } catch {
    return null;
  }
}

export async function getScreenStatus(): Promise<{ foreground: ForegroundWindow | null; lastSnapshot: ScreenSnapshot | null }> {
  const [foreground, lastSnapshot] = await Promise.all([getForegroundWindow(), getLastSnapshot()]);
  return { foreground, lastSnapshot };
}