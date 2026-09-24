let pendingFiles: File[] = [];

let pendingText = "";

export function setPendingFiles(files: File[]): void {
  pendingFiles = [...files];
}

export function takePendingFiles(): File[] {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}

export function setPendingText(text: string): void {
  pendingText = text;
}

export function takePendingText(): string {
  const text = pendingText;
  pendingText = "";
  return text;
}

export function dispatchDroppedFiles(files: File[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("techy:drop", { detail: { files } }));
}

export function dispatchDroppedText(text: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("techy:droptext", { detail: { text } }));
}