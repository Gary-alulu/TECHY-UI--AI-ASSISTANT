import { promises as fs } from "node:fs";
import path from "node:path";
import type { SecurityCategory, SecurityLevel, SecurityPolicy } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const POLICY_FILE = path.join(DATA_DIR, "security-policy.json");

export const DEFAULT_POLICY: SecurityPolicy = {
  fileAccess: "allowed",
  appLaunch: "allowed",
  terminal: "confirm",
  deleteFiles: "confirm",
  systemSettings: "confirm",
  network: "restricted",
  localOnly: false,
  logActivity: true,
};

export const CATEGORY_LABELS: Array<{ key: SecurityCategory; label: string; description: string }> = [
  { key: "fileAccess", label: "File Access", description: "Reading, searching and preparing files." },
  { key: "appLaunch", label: "Application Control", description: "Launching installed applications on your behalf." },
  { key: "terminal", label: "Terminal", description: "Running shell commands and scripts." },
  { key: "deleteFiles", label: "Delete Files", description: "Permanent deletion of files and folders." },
  { key: "systemSettings", label: "System Settings", description: "Changing OS settings and preferences." },
  { key: "network", label: "Network", description: "Reaching external hosts (models, updates, web)." },
];

let writeQueue: Promise<unknown> = Promise.resolve();

async function readPolicy(): Promise<SecurityPolicy> {
  try {
    const raw = await fs.readFile(POLICY_FILE, "utf8");
    return { ...DEFAULT_POLICY, ...(JSON.parse(raw) as Partial<SecurityPolicy>) };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

function queueWrite(updater: (policy: SecurityPolicy) => SecurityPolicy): Promise<SecurityPolicy> {
  const run = writeQueue.then(async () => {
    const next = updater(await readPolicy());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(POLICY_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  return readPolicy();
}

export async function updateSecurityPolicy(patch: Partial<SecurityPolicy>): Promise<SecurityPolicy> {
  const policy = await queueWrite((current) => ({ ...current, ...patch }));
  if (patch.localOnly !== undefined || patch.network !== undefined) {
    const changed = patch.localOnly ? "Local-only mode enabled" : patch.network === "restricted" ? "Network restricted" : "Network policy updated";
    const { logActivity: doLog } = await import("@/lib/activity");
    await doLog({ actor: "user", kind: "security", action: "Security policy updated", detail: changed });
  }
  return policy;
}

/** Resolves whether the current policy allows an action of `category`. */
export function resolvePermission(category: SecurityCategory, policy: SecurityPolicy): SecurityLevel {
  return policy[category];
}

/** Acceptable wording used by the UI matrix. */
export const PERMISSION_RANK: Record<SecurityLevel, number> = { allowed: 3, confirm: 2, restricted: 1 };