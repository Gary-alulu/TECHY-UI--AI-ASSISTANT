import type { AppCategory, InstalledApp } from "@/types";

const CATEGORY_PATTERNS: Array<{ category: AppCategory; patterns: RegExp[] }> = [
  {
    category: "design",
    patterns: [
      /photoshop|illustrator|indesign|lightroom|premiere|after effects|adobe/i,
      /figma|blender|sketch|coreldraw|affinity|gimp|krita|canva|clip studio|capture one|davinci resolve/i,
      /cinema 4d|houdini|maya|zbrush|substance|unity/i,
    ],
  },
  {
    category: "development",
    patterns: [
      /visual studio|vscode|vs code|intellij|pycharm|webstorm|rider|goland|clion|phpstorm/i,
      /sublime|notepad\+\+|atom|eclipse|netbeans|android studio|xcode|dbeaver|postman|insomnia/i,
      /docker|kubectl|git for windows|cmder|putty|terminus|warp terminal|windows terminal/i,
      /\bcode\b|jetbrains|github desktop|azure data studio|mongo(c|db)? compass/i,
    ],
  },
  {
    category: "browser",
    patterns: [/chrome|chromium|edge|firefox|opera|brave|arc browser|vivaldi|tor browser/i],
  },
  {
    category: "communication",
    patterns: [/zoom|teams|slack|discord|whatsapp|telegram|skype|signal|microsoft teams/i],
  },
  {
    category: "office",
    patterns: [
      /microsoft (word|excel|powerpoint|outlook|onedrive|office)|^word$|^excel$|^powerpoint$/i,
      /wps office|libreoffice|notion|evernote|one note|obsidian/i,
    ],
  },
  {
    category: "media",
    patterns: [/vlc|spotify|itunes|windows media player|audacity|obs studio|handbrake|plex|kodi|foobar/i],
  },
  {
    category: "games",
    patterns: [/steam|epic games|league of legends|valorant|minecraft|xbox|battle\.net|geforce now/i],
  },
  {
    category: "utilities",
    patterns: [/7-zip|winrar|winzip|everything|powertoys|tree size|ccleaner|snipaste|greenshot/i],
  },
  {
    category: "system",
    patterns: [/intel|nvidia (control panel|app|graphics|settings)|amd software|microsoft edge webview/i],
  },
];

const DESIGN_INSTALLERS = [
  /adobe/i,
  /autodesk/i,
  /blender/i,
  /figma/i,
  /clip studio/i,
  /corel/i,
  /affinity/i,
];

export function classifyApp(app: Pick<InstalledApp, "name" | "publisher" | "installLocation" | "exePath">): AppCategory {
  const hay = [app.name, app.publisher ?? "", app.installLocation ?? "", app.exePath ?? ""].join("\u0000");

  for (const group of CATEGORY_PATTERNS) {
    if (group.patterns.some((pattern) => pattern.test(hay))) return group.category;
  }

  if (DESIGN_INSTALLERS.some((pattern) => pattern.test(hay))) return "design";

  return "other";
}

export const APP_CATEGORIES: Array<{ id: AppCategory; label: string }> = [
  { id: "design", label: "Design" },
  { id: "development", label: "Dev" },
  { id: "browser", label: "Browser" },
  { id: "communication", label: "Comm" },
  { id: "office", label: "Office" },
  { id: "media", label: "Media" },
  { id: "games", label: "Games" },
  { id: "utilities", label: "Utilities" },
  { id: "system", label: "System" },
  { id: "other", label: "Other" },
];

const CATEGORY_ALIASES: Array<{ id: AppCategory; patterns: RegExp[] }> = [
  { id: "design", patterns: [/design|creative|draw|edit (photos|images|video)|photo(s|shop)?|graphic/i] },
  { id: "development", patterns: [/dev|code|developer|program(ming)?|coding|ide/i] },
  { id: "browser", patterns: [/browser|web browser|surf/i] },
  { id: "communication", patterns: [/message|chat|call|communic|meet/i] },
  { id: "office", patterns: [/office|document|spreadsheet|word processor|notes/i] },
  { id: "media", patterns: [/music|video|player|media|movie/i] },
  { id: "games", patterns: [/game|gaming/i] },
  { id: "utilities", patterns: [/utility|tool|archive|zip|compress/i] },
  { id: "system", patterns: [/system|driver|control panel/i] },
];

/** Resolves free-form words like "my design apps" to a category id, if any. */
export function resolveCategoryKeyword(input: string): AppCategory | null {
  const hay = input.toLowerCase();
  for (const alias of CATEGORY_ALIASES) {
    if (alias.patterns.some((pattern) => pattern.test(hay))) return alias.id;
  }
  const exact = APP_CATEGORIES.find((category) => hay.includes(category.id));
  return exact ? exact.id : null;
}

export function appsInCategory(apps: InstalledApp[], category: AppCategory): InstalledApp[] {
  return apps.filter((app) => app.category === category && app.exePath);
}