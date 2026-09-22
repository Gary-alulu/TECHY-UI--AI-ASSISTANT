// ─────────────────────────────────────────────────────
// TECHY — Quick App Catalog
// Shared by the Quick Apps UI and the /api/apps/launch
// route handler. Only apps listed here can be launched.
// ─────────────────────────────────────────────────────

export type AppPlatform = "win32" | "darwin" | "linux";

export interface QuickAppDefinition {
  id: string;
  name: string;
  /** Web fallback used when the native launch fails or is unavailable. */
  url?: string;
  /** Native launch commands per platform. First entry is the executable. */
  commands: Partial<Record<AppPlatform, string[]>>;
}

const WEB = (url: string) => ({
  win32: ["cmd", "/c", "start", "", url],
  darwin: ["open", url],
  linux: ["xdg-open", url],
});

export const QUICK_APPS: Record<string, QuickAppDefinition> = {
  browser: {
    id: "browser",
    name: "Browser",
    url: "https://www.google.com",
    commands: WEB("https://www.google.com"),
  },
  vscode: {
    id: "vscode",
    name: "VS Code",
    url: "https://vscode.dev",
    commands: {
      win32: ["code"],
      darwin: ["open", "-a", "Visual Studio Code"],
      linux: ["code"],
    },
  },
  terminal: {
    id: "terminal",
    name: "Terminal",
    commands: {
      win32: ["cmd", "/c", "start", "", "cmd.exe"],
      darwin: ["open", "-a", "Terminal"],
      linux: ["x-terminal-emulator"],
    },
  },
  figma: {
    id: "figma",
    name: "Design",
    url: "https://www.figma.com",
    commands: WEB("https://www.figma.com"),
  },
  github: {
    id: "github",
    name: "Git",
    url: "https://github.com",
    commands: WEB("https://github.com"),
  },
  media: {
    id: "media",
    name: "Media",
    url: "https://www.youtube.com",
    commands: WEB("https://www.youtube.com"),
  },
};

export function getLaunchCommand(app: QuickAppDefinition): string[] | undefined {
  return app.commands[process.platform as AppPlatform];
}
