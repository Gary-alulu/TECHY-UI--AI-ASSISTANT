import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import type { InstalledApp } from "@/types";
import { classifyApp } from "./appCategories";

const CACHE_TTL_MS = 120_000;

interface InstalledAppCache {
  value: InstalledApp[];
  at: number;
}

let cache: InstalledAppCache | null = null;

function makeId(name: string, version?: string, publisher?: string): string {
  const composite = `${name}\u0000${version ?? ""}\u0000${publisher ?? ""}`;
  return createHash("sha1").update(composite).digest("hex").slice(0, 12);
}

function execFileAsync(command: string, args: string[], timeout = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extracts an .exe/.cmd/.bat path from a DisplayIcon value like "C:\\a\\app.exe,0". */
function parseIconExecutable(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  const match = icon.trim().match(/"?([^",;]+?\.(?:exe|cmd|bat))"?/i);
  if (!match) return undefined;
  const candidate = match[1].replace(/"/g, "").trim();
  if (/\.(dll|ico|png)$/i.test(candidate)) return undefined;
  return candidate;
}

function formatInstallDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length !== 8) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function mapRows(rows: Array<Record<string, unknown>>): InstalledApp[] {
  const apps = new Map<string, InstalledApp>();
  for (const row of rows) {
    const rawName = row.Name;
    if (typeof rawName !== "string" || !rawName.trim()) continue;

    const name = rawName.trim();
    const version = typeof row.Version === "string" ? row.Version.trim() : undefined;
    const publisher = typeof row.Publisher === "string" ? row.Publisher.trim() : undefined;
    const installLocation = typeof row.InstallLocation === "string" && row.InstallLocation.trim() ? row.InstallLocation.trim() : undefined;
    const icon = typeof row.DisplayIcon === "string" ? row.DisplayIcon : undefined;
    const exePath = typeof row.Exe === "string" && row.Exe.trim() ? row.Exe.trim() : parseIconExecutable(icon);
    const sizeKB = typeof row.SizeKB === "number" ? row.SizeKB : undefined;

    const key = name.toLowerCase();
    const existing = apps.get(key);

    // Prefer the entry that yields a launchable executable, fall back to the first.
    if (existing && existing.exePath && !exePath) {
      apps.set(key, {
        ...existing,
        name,
        ...(version ? { version } : {}),
      });
      continue;
    }

    const sizeMB = sizeKB ? Math.max(1, Math.round(sizeKB / 1024)) : undefined;
    const installDate = formatInstallDate(typeof row.InstallDate === "string" ? row.InstallDate : undefined);

    const app: InstalledApp = {
      id: makeId(name, version, publisher),
      name,
      ...(version ? { version } : {}),
      ...(publisher ? { publisher } : {}),
      ...(typeof sizeMB === "number" ? { estimatedSizeMB: sizeMB } : {}),
      ...(installDate ? { installDate } : {}),
      ...(installLocation ? { installLocation } : {}),
      ...(exePath ? { exePath } : {}),
    };
    apps.set(key, { ...app, category: classifyApp(app) });
  }
  return Array.from(apps.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Windows registry enumeration ───────────────────────

const WINDOWS_APPS_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue'",
  "$deadline=(Get-Date).AddSeconds(8)",
  "$paths='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
  "$rows = foreach ($p in (Get-ItemProperty $paths)) {",
  "  if (-not $p.DisplayName) { continue }",
  "  $exe = $null",
  "  if ($p.DisplayIcon -match '\\\"?([^\\\",;]+?\\.(exe|cmd|bat))') { $exe = $Matches[1].Trim('\\\"') }",
  "  if (-not $exe -and $p.InstallLocation -and (Test-Path $p.InstallLocation) -and ((Get-Date) -lt $deadline)) {",
  "    $matchKey = (($p.DisplayName -split '\\s+') | Where-Object { $_ -match '[A-Za-z]' } | Select-Object -First 1)",
  "    $candidates = @(Get-ChildItem -Path $p.InstallLocation -Recurse -Depth 1 -Filter '*.exe' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '(?i)(unins|setup|install|patch|crash|sniffer|repair|helper|bootstrapper)' })",
  "    if ($candidates.Count -gt 0) {",
  "      $match = ($candidates | Where-Object { $_.Name -like ('*' + $matchKey + '*') } | Select-Object -First 1)",
  "      if (-not $match) { $match = ($candidates | Sort-Object { $_.FullName.Length } | Select-Object -First 1) }",
  "      $exe = $match.Path",
  "    }",
  "  }",
  "  [pscustomobject]@{ Name=$p.DisplayName; Version=$p.DisplayVersion; Publisher=$p.Publisher; InstallDate=$p.InstallDate; SizeKB=$p.EstimatedSize; InstallLocation=$p.InstallLocation; DisplayIcon=$p.DisplayIcon; Exe=$exe }",
  "}",
  "$rows | ConvertTo-Json -Compress",
].join("; ");

async function enumerateWindowsApps(): Promise<InstalledApp[]> {
  const stdout = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_APPS_SCRIPT], 30_000);
  const rows = toArray<Record<string, unknown>>(JSON.parse(stdout.trim() || "[]"));
  return mapRows(rows);
}

// ── Linux / macOS enumeration (best-effort) ────────────

async function enumerateLinuxApps(): Promise<InstalledApp[]> {
  const directories = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    `${process.env.HOME}/.local/share/applications`,
  ];
  const apps: InstalledApp[] = [];
  const seen = new Set<string>();

  for (const directory of directories) {
    const stdout = await execFileAsync("find", [directory, "-maxdepth", "1", "-name", "*.desktop"]).catch(() => "");
    for (const file of stdout.trim().split("\n").filter(Boolean)) {
      const contents = await execFileAsync("cat", [file]).catch(() => "");
      if (!contents.trim()) continue;

      const name = contents.match(/^Name=([^\n]+)/m)?.[1]?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;

      const exec = contents.match(/^Exec=([^\n]+)/m)?.[1]?.trim();
      seen.add(name.toLowerCase());
      apps.push({
        id: makeId(name),
        name,
        version: contents.match(/^Version=([^\n]+)/m)?.[1]?.trim(),
        exePath: exec?.replace(/^env\s+/i, "").split(/\s+/)[0]?.replace(/^"/, "").replace(/"$/, ""),
        installLocation: file,
      });
    }
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

async function enumerateMacApps(): Promise<InstalledApp[]> {
  const stdout = await execFileAsync("system_profiler", ["SPApplicationsDataType", "-json"], 20_000);
  const parsed = JSON.parse(stdout) as { SPApplicationsDataType?: Array<Record<string, unknown>> };
  const apps = toArray(parsed.SPApplicationsDataType).map((entry) => {
    const rawName = entry._name;
    const name = typeof rawName === "string" && rawName !== "spapps" ? rawName : String(entry.Name ?? "Unknown");
    const appPath = typeof entry.path === "string" && entry.path !== "N/A" ? entry.path : undefined;
    return {
      id: makeId(name, entry.version ? String(entry.version) : undefined),
      name,
      version: entry.version ? String(entry.version) : undefined,
      publisher: entry.spplications_arch ? undefined : undefined,
      exePath: appPath,
      installLocation: appPath,
    } as InstalledApp;
  });
  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Public API ─────────────────────────────────────────

export async function getInstalledApps(forceRefresh = false): Promise<InstalledApp[]> {
  if (!forceRefresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  let value: InstalledApp[];
  try {
    if (process.platform === "win32") {
      value = await enumerateWindowsApps();
    } else if (process.platform === "darwin") {
      value = await enumerateMacApps();
    } else {
      value = await enumerateLinuxApps();
    }
  } catch (error) {
    if (cache) return cache.value;
    throw error;
  }

  cache = { value, at: Date.now() };
  return value;
}

export interface LaunchResult {
  ok: boolean;
  command?: string;
  error?: string;
}

export async function launchInstalledApp(appId: string): Promise<LaunchResult> {
  const apps = await getInstalledApps();
  const app = apps.find((candidate) => candidate.id === appId);
  if (!app) return { ok: false, error: "Installed app not found" };
  if (!app.exePath) return { ok: false, error: "No launchable executable found for this app" };
  return launchExecutable(app.exePath);
}

function launchExecutable(exePath: string): Promise<LaunchResult> {
  return new Promise((resolve) => {
    let command: string;
    let args: string[];

    if (process.platform === "win32") {
      command = "cmd";
      args = ["/c", "start", "", `"${exePath}"`];
    } else if (process.platform === "darwin") {
      command = "open";
      args = [exePath];
    } else {
      command = exePath;
      args = [];
    }

    const child = spawn(/*turbopackIgnore: true*/ command, args, { detached: true, stdio: "ignore", windowsHide: false });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: "Launch timed out" });
    }, 8000);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
    child.once("spawn", () => {
      clearTimeout(timer);
      child.unref();
      resolve({ ok: true, command: command === "cmd" ? exePath : command });
    });
  });
}