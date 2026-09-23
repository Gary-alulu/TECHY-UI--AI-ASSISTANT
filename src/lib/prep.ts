import type { CalendarEvent } from "@/types";
import { searchKnowledge } from "@/lib/knowledge";
import { searchFiles } from "@/lib/system/search";
import { extractText } from "@/lib/system/documents";
import { listDirectory } from "@/lib/system/files";
import { addNotification } from "@/lib/notifications";
import { markPrepared } from "@/lib/calendar";

export interface PrepFinding {
  type: "notes" | "proposal" | "folder" | "images" | "document";
  label: string;
  detail: string;
  path?: string;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at", "my", "our", "this",
  "that", "meeting", "call", "with", "have", "has", "is", "are", "review", "today",
]);

function keywordsFor(text: string, limit = 3): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .slice(0, limit);
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|avif|tiff)$/i;

/**
 * Compiles a meeting-preparation brief from calendar + local files + knowledge:
 * relevant documents, the previous proposal, the client folder and images.
 */
export async function prepareForEvent(event: CalendarEvent): Promise<{ findings: PrepFinding[]; summary: string }> {
  const keywords = keywordsFor(`${event.title} ${event.notes ?? ""}`, 3);
  const findings: PrepFinding[] = [];

  const query = keywords.join(" ");
  if (query) {
    const { hits } = await searchKnowledge(query, 4);
    for (const hit of hits.slice(0, 3)) {
      const isProposal = /proposal/i.test(hit.path) || /proposal/i.test(hit.name);
      findings.push({
        type: isProposal ? "proposal" : "document",
        label: isProposal ? "Previous proposal" : "Relevant document",
        detail: `${hit.name}: ${hit.snippet}`,
        path: hit.path,
      });
    }
  }

  const folderSearches = [...keywords, ...(/client/i.test(event.title) ? ["client"] : [])].slice(0, 2);
  for (const keyword of folderSearches) {
    const { results } = await searchFiles({ query: keyword, scope: "system" });
    const dirs = results.filter((result) => result.type === "directory").slice(0, 3);
    for (const dir of dirs) {
      findings.push({
        type: "folder",
        label: "Client folder",
        detail: dir.name,
        path: dir.path,
      });
    }
    if (dirs.length === 0 && results.length > 0) {
      const file = results[0];
      findings.push({
        type: "document",
        label: `Search: “${keyword}”`,
        detail: `${file.name} — ${file.type}`,
        path: file.path,
      });
    }
  }

  const images: string[] = [];
  try {
    const listing = await listDirectory("data/fixtures", "system");
    for (const entry of listing.entries ?? []) {
      if (entry.type === "file" && IMAGE_RE.test(entry.name)) images.push(entry.name);
    }
  } catch {
    // fixtures may not exist yet
  }
  if (images.length > 0) {
    findings.push({ type: "images", label: "Relevant images", detail: images.slice(0, 5).join(", ") });
  }

  const seen = new Set<string>();
  const unique = findings.filter((finding) => {
    const key = `${finding.type}:${finding.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const proposal = unique.find((finding) => finding.type === "proposal");
  let summary = `Prepared for “${event.title}” (${formatTime(event.start)}):\n`;
  if (unique.length === 0) {
    summary += "No relevant documents found yet — try adding notes or documents to the workspace.";
  } else {
    for (const finding of unique.slice(0, 6)) summary += `• ${finding.label}: ${finding.detail}\n`;
  }
  if (proposal?.path) {
    const { text } = await extractText(proposal.path);
    if (text && text.trim().length > 80) {
      const excerpt = text.replace(/\s+/g, " ").trim().slice(0, 280);
      summary += `Proposal highlights: ${excerpt}…\n`;
    }
  }

  await addNotification({
    kind: "ai_task",
    title: "Meeting preparation complete",
    body: `${event.title} — ${unique.length} relevant item(s) gathered.`,
    source: "calendar",
  });
  await markPrepared(event.id);

  return { findings: unique, summary };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}