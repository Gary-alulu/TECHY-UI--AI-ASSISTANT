import { promises as fs } from "node:fs";
import path from "node:path";
import type { Dirent } from "node:fs";
import { WORKSPACE_ROOT } from "@/lib/system/files";
import { getTasks } from "@/lib/tasks";
import type { ProjectSummary } from "@/types";

const DOCUMENT_EXTS = /\.(pdf|docx?|txt|md|csv|xlsx?|pptx?)$/i;
const DESIGN_EXTS = /\.(png|jpe?g|svg|gif|webp|ai|psd|fig|xd|mp4|mov)$/i;
const SKIPPED_DIRS = new Set([".git", "node_modules", ".next", "data", ".turbo", ".vercel"]);

function looksLikeProject(name: string): boolean {
  if (name.startsWith(".")) return false;
  if (/^(20\d{2}|19\d{2})$/.test(name)) return false;
  if (/\.(json|log|ts)$/i.test(name)) return false;
  return /[A-Z0-9_-]/.test(name) && name.length > 2;
}

async function countFolder(root: string, depth = 0): Promise<{ files: number; documents: number; designs: number; lastActivity: string | null }> {
  let files = 0;
  let documents = 0;
  let designs = 0;
  let lastActivity: string | null = null;
  if (depth > 3) return { files, documents, designs, lastActivity };
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { files, documents, designs, lastActivity };
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await countFolder(full, depth + 1);
      files += nested.files;
      documents += nested.documents;
      designs += nested.designs;
      lastActivity = nested.lastActivity ?? lastActivity;
    } else if (entry.isFile()) {
      files += 1;
      if (DOCUMENT_EXTS.test(entry.name)) documents += 1;
      if (DESIGN_EXTS.test(entry.name)) designs += 1;
    }
  }
  try {
    const stat = await fs.stat(root);
    lastActivity = stat.mtime.toISOString();
  } catch {
    // keep prior
  }
  return { files, documents, designs, lastActivity };
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const tasks = await getTasks();
  const projects: ProjectSummary[] = [];

  const roots = [path.join(WORKSPACE_ROOT, "data", "projects"), WORKSPACE_ROOT];
  for (const scanRoot of roots) {
    let nodes: Array<{ name: string; type: "file" | "dir" }> = [];
    try {
      const entries = await fs.readdir(scanRoot, { withFileTypes: true });
      nodes = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({ name: entry.name, type: "dir" as const }));
    } catch {
      continue;
    }
    for (const node of nodes) {
      if (SKIPPED_DIRS.has(node.name)) continue;
      if (scanRoot === WORKSPACE_ROOT && node.name === "data") continue;
      if (!looksLikeProject(node.name)) continue;
      const counts = await countFolder(path.join(scanRoot, node.name));
      const taskCount = tasks.filter((task) => {
        const combined = `${task.title} ${task.description ?? ""}`.toLowerCase();
        return combined.includes(node.name.toLowerCase());
      }).length;
      projects.push({
        name: node.name,
        slug: node.name.toLowerCase().replace(/\s+/g, "-"),
        files: counts.files,
        documents: counts.documents,
        designs: counts.designs,
        tasks: taskCount,
        lastActivity: counts.lastActivity,
      });
    }
  }

  return projects.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
}