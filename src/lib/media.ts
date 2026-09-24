import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { MediaEntry, MediaKind } from "@/types";
import { WORKSPACE_ROOT } from "@/lib/system/files";

const AUDIO_EXT = /\.(mp3|wav|flac|ogg|m4a|aac|opus|aiff|ape|wma)$/i;
const VIDEO_EXT = /\.(mp4|mkv|mov|webm|avi|flv|wmv|m4v|ts)$/i;
const PODCAST_EXT = /\.(mp3|m4a|ogg)$/i;

const MAX_MEDIA = 400;

function classify(name: string): MediaKind | null {
  if (AUDIO_EXT.test(name)) {
    if (PODCAST_EXT.test(name)) return "podcast";
    return "music";
  }
  if (VIDEO_EXT.test(name)) return "video";
  return null;
}

interface CandidateDir {
  path: string;
  depthAllowed: number;
}

function mediaSourceDirs(): CandidateDir[] {
  const dirs: CandidateDir[] = [
    { path: path.join(WORKSPACE_ROOT, "media"), depthAllowed: 3 },
    { path: path.join(WORKSPACE_ROOT, "music"), depthAllowed: 3 },
    { path: path.join(WORKSPACE_ROOT, "audio"), depthAllowed: 3 },
    { path: path.join(WORKSPACE_ROOT, "public", "media"), depthAllowed: 3 },
  ];
  if (process.platform === "win32") {
    const music = path.join(os.homedir(), "Music");
    const videos = path.join(os.homedir(), "Videos");
    if (process.env.USERPROFILE) {
      dirs.push({ path: path.join(process.env.USERPROFILE, "Music"), depthAllowed: 3 });
      dirs.push({ path: path.join(process.env.USERPROFILE, "Videos"), depthAllowed: 3 });
    }
    if (music) dirs.push({ path: music, depthAllowed: 3 });
    if (videos) dirs.push({ path: videos, depthAllowed: 3 });
  } else {
    dirs.push({ path: path.join(os.homedir(), "Music"), depthAllowed: 3 });
    dirs.push({ path: path.join(os.homedir(), "Videos"), depthAllowed: 3 });
  }
  return dirs;
}

async function scanDir(directory: string, depthAllowed: number, seen: Set<string>, results: MediaEntry[]): Promise<void> {
  if (results.length >= MAX_MEDIA || seen.has(directory)) return;
  seen.add(directory);

  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_MEDIA) return;
    const full = path.join(directory, entry.name);
    const kind = entry.isFile() ? classify(entry.name) : null;
    if (kind) {
      let size = 0;
      let modifiedAt: string | undefined;
      try {
        const stat = await fs.stat(full);
        size = stat.size;
        modifiedAt = stat.mtime.toISOString();
      } catch {
        // skip unreadable files
      }
      results.push({
        id: full,
        name: entry.name,
        path: full,
        kind,
        sizeBytes: size,
        modifiedAt,
      });
    } else if (entry.isDirectory() && depthAllowed > 0) {
      await scanDir(full, depthAllowed - 1, seen, results);
    }
  }
}

export async function listMedia(): Promise<MediaEntry[]> {
  const results: MediaEntry[] = [];
  const seen = new Set<string>();
  const seenFiles = new Set<string>();

  const scan = async (directory: string, depthAllowed: number) => {
    await scanDir(directory, depthAllowed, seen, results);
  };

  await Promise.all(mediaSourceDirs().map(({ path: dirPath, depthAllowed }) => scan(dirPath, depthAllowed)));

  const unique: MediaEntry[] = [];
  for (const entry of results) {
    if (!seenFiles.has(entry.path)) {
      seenFiles.add(entry.path);
      unique.push(entry);
    }
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_MEDIA);
}

export async function mediaIsPlayable(entryPath: string): Promise<{ ok: boolean; kind?: MediaKind; error?: string }> {
  const name = path.basename(entryPath);
  const kind = classify(name);
  if (!kind) return { ok: false, error: "Not a supported audio/video file" };
  try {
    const stat = await fs.stat(entryPath);
    if (!stat.isFile()) return { ok: false, error: "Not a file" };
    if (stat.size > 250 * 1024 * 1024) return { ok: false, error: "File is too large to stream" };
    return { ok: true, kind };
  } catch {
    return { ok: false, error: "File not readable" };
  }
}