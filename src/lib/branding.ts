import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_BRANDING, type Branding, type BrandingLite } from "@/lib/accents";

const DATA_DIR = path.join(process.cwd(), "data");
const BRANDING_FILE = path.join(DATA_DIR, "branding.json");

export const ALLOWED_FIELDS: Array<keyof BrandingLite> = [
  "aiName",
  "avatar",
  "accent",
  "density",
  "theme",
  "voice",
  "model",
  "wakeWord",
  "animation",
  "defaultWorkspace",
  "privacy",
];

let writeQueue: Promise<unknown> = Promise.resolve();

async function readBranding(): Promise<Branding> {
  try {
    const raw = await fs.readFile(BRANDING_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<Branding>;
    return {
      ...DEFAULT_BRANDING,
      ...(parsed ?? {}),
      updatedAt: parsed?.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return { ...DEFAULT_BRANDING, updatedAt: new Date(0).toISOString() };
  }
}

function queueWrite(updater: (branding: Branding) => Branding): Promise<Branding> {
  const run = writeQueue.then(async () => {
    const next = updater(await readBranding());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(BRANDING_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function getBranding(): Promise<Branding> {
  return readBranding();
}

export async function updateBranding(patch: Partial<BrandingLite>): Promise<Branding> {
  const clean: Partial<BrandingLite> = {};
  for (const key of ALLOWED_FIELDS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim()) {
      Object.assign(clean, { [key]: value.trim() });
    }
  }
  if (clean.aiName && clean.aiName.length > 24) clean.aiName = clean.aiName.slice(0, 24);
  if (clean.wakeWord && clean.wakeWord.length > 40) clean.wakeWord = clean.wakeWord.slice(0, 40);
  if (clean.model && clean.model.length > 80) clean.model = clean.model.slice(0, 80);
  return queueWrite((current) => ({ ...current, ...clean, updatedAt: new Date().toISOString() }));
}