import { execFile } from "node:child_process";
import type {
  BluetoothDeviceInfo,
  DisplayInfo,
  FanInfo,
  HardwareDashboard,
  MotherboardInfo,
  TrackedDevice,
  TrackedDeviceId,
  UsbDeviceInfo,
} from "@/types";
import {
  getHardwareInfo,
  getRamInfo,
  getStorageInfo,
  getTemperatureInfo,
} from "@/lib/system/hardware";

const DEVICES_TTL_MS = 20_000;

function execFileAsync(command: string, args: string[], timeout = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function powershell(script: string, timeout = 15_000): Promise<string> {
  return execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], timeout);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    return toArray<T>(JSON.parse(raw.trim() || "[]"));
  } catch {
    return [];
  }
}

// ── Displays ──────────────────────────────────────────

interface WinScreen {
  DeviceName?: string;
  Primary?: boolean;
  Bounds?: { X?: number; Y?: number; Width?: number; Height?: number };
}

export async function getDisplays(): Promise<DisplayInfo[]> {
  if (process.platform !== "win32") return [];
  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;",
      "$screens = [System.Windows.Forms.Screen]::AllScreens",
      "$screens | ForEach-Object { [pscustomobject]@{ DeviceName=$_.DeviceName; Primary=$_.Primary; Bounds=[pscustomobject]@{ X=$_.Bounds.X; Y=$_.Bounds.Y; Width=$_.Bounds.Width; Height=$_.Bounds.Height } } } | ConvertTo-Json -Compress",
    ].join(" ");
    const rows = parseJsonArray<WinScreen>(await powershell(script, 10_000));
    return rows.map((screen, index) => ({
      id: screen.DeviceName || `DISPLAY ${index + 1}`,
      name: screen.DeviceName || `DISPLAY ${index + 1}`,
      label: screen.Primary ? "Main work" : index === 1 ? "References" : `Display ${index + 1}`,
      primary: screen.Primary === true,
      resolution: screen.Bounds ? `${screen.Bounds.Width} × ${screen.Bounds.Height}` : undefined,
      bounds: screen.Bounds
        ? {
            x: screen.Bounds.X ?? 0,
            y: screen.Bounds.Y ?? 0,
            width: screen.Bounds.Width ?? 0,
            height: screen.Bounds.Height ?? 0,
          }
        : undefined,
      online: true,
    }));
  } catch {
    return [];
  }
}

// ── Motherboard / BIOS ────────────────────────────────

export async function getMotherboardInfo(): Promise<MotherboardInfo> {
  if (process.platform !== "win32") return {};
  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer,Product,SerialNumber",
      "$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1 Manufacturer,SMBIOSBIOSVersion",
      "[pscustomobject]@{ Manufacturer=$board.Manufacturer; Product=$board.Product; Serial=$board.SerialNumber; BiosManufacturer=$bios.Manufacturer; BiosVersion=$bios.SMBIOSBIOSVersion } | ConvertTo-Json -Compress",
    ].join(" ");
    const data = JSON.parse((await powershell(script, 12_000)).trim() || "{}") as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
    return {
      manufacturer: text(data.Manufacturer),
      product: text(data.Product),
      serial: text(data.Serial),
      biosVendor: text(data.BiosManufacturer),
      biosVersion: text(data.BiosVersion),
    };
  } catch {
    return {};
  }
}

export async function getFans(): Promise<FanInfo[]> {
  if (process.platform !== "win32") return [];
  try {
    const script = "$ErrorActionPreference='SilentlyContinue'; Get-CimInstance Win32_Fan | Select-Object Name | ConvertTo-Json -Compress";
    const rows = parseJsonArray<{ Name?: string }>(await powershell(script, 12_000));
    return rows.map((row) => ({ name: row.Name ?? "Fan" }));
  } catch {
    return [];
  }
}

export async function getUsbDevices(): Promise<UsbDeviceInfo[]> {
  if (process.platform !== "win32") return [];
  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "Get-PnpDevice -Class USB -Status OK | Select-Object -First 40 FriendlyName,Manufacturer,Status | ConvertTo-Json -Compress",
    ].join(" ");
    const rows = parseJsonArray<{ FriendlyName?: string; Manufacturer?: string; Status?: string }>(await powershell(script, 15_000));
    return rows
      .filter((row) => row.FriendlyName)
      .map((row) => ({
        name: (row.FriendlyName as string).slice(0, 90),
        manufacturer: row.Manufacturer,
        status: row.Status ?? "OK",
      }));
  } catch {
    return [];
  }
}

export async function getBluetoothDevices(): Promise<BluetoothDeviceInfo[]> {
  if (process.platform !== "win32") return [];
  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "Get-PnpDevice -Class Bluetooth | Select-Object -First 40 FriendlyName,Status,Class | ConvertTo-Json -Compress",
    ].join(" ");
    const rows = parseJsonArray<{ FriendlyName?: string; Status?: string; Class?: string }>(await powershell(script, 15_000));
    return rows
      .filter((row) => row.FriendlyName && row.Status !== "Unknown")
      .map((row) => ({
        name: (row.FriendlyName as string).slice(0, 90),
        connected: (row.Status ?? "") === "OK",
        type: row.Class,
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

// ── Tracked device presence (Device Manager) ──────────

interface PnpRow {
  FriendlyName?: string;
  Status?: string;
}

function hasMatch(rows: PnpRow[], pattern: RegExp): PnpRow | undefined {
  return rows.find((row) => row.Status === "OK" && row.FriendlyName && pattern.test(row.FriendlyName));
}

export async function getTrackedDevices(): Promise<TrackedDevice[]> {
  if (process.platform !== "win32") {
    return [
      { id: "keyboard", label: "Keyboard", connected: true },
      { id: "mouse", label: "Mouse", connected: true },
      { id: "headphones", label: "Headphones", connected: false },
      { id: "webcam", label: "Webcam", connected: false },
      { id: "microphone", label: "Microphone", connected: false },
      { id: "phone", label: "Phone", connected: false },
      { id: "externalSSD", label: "External SSD", connected: false },
    ];
  }

  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "$classes = @('Keyboard','Mouse','Camera','Image','AudioEndpoint','USBDevice','DiskDrive','Media','WPD')",
      "$rows = foreach ($class in $classes) { Get-PnpDevice -Class $class -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status,Class }",
      "$rows | ConvertTo-Json -Compress",
    ].join(" ");
    const rows = parseJsonArray<PnpRow & { Class?: string }>(await powershell(script, 20_000));
    const byClass = (cls: string) => rows.filter((row) => row.Class === cls);

    const keyboard = byClass("Keyboard").find((row) => row.Status === "OK");
    const mouse = byClass("Mouse").find((row) => row.Status === "OK");
    const cameras = byClass("Camera");
    const camera = cameras.find((row) => row.Status === "OK") ?? hasMatch(byClass("Image"), /^(cam|video)/i);
    const audioEndpoints = byClass("AudioEndpoint").filter((row) => row.Status === "OK");
    const microphone = hasMatch(audioEndpoints, /^(microphone|mic\b|array)/i);
    const headphones = hasMatch(audioEndpoints, /^(headphone|headset|digital|speaker)/i);
    const wpd = byClass("WPD").find((row) => row.Status === "OK") ?? hasMatch(rows, /^(phone|android|mtp)/i);
    const externalStorage = byClass("DiskDrive").find((row) => row.Status === "OK" && /^(usb|portable|external|ssd|nvme)/i.test(row.FriendlyName ?? ""));

    const details: Array<{ id: TrackedDeviceId; label: string; row?: PnpRow }> = [
      { id: "keyboard", label: "Keyboard", row: keyboard },
      { id: "mouse", label: "Mouse", row: mouse },
      { id: "webcam", label: "Webcam", row: camera },
      { id: "microphone", label: "Microphone", row: microphone },
      { id: "headphones", label: "Headphones", row: headphones },
      { id: "phone", label: "Phone", row: wpd },
      { id: "externalSSD", label: "External SSD", row: externalStorage },
    ];

    return details.map(({ id, label, row }) => ({
      id,
      label,
      connected: Boolean(row),
      detail: row?.FriendlyName?.slice(0, 80),
    }));
  } catch {
    // Degrade to "unknown" but never crash the UI.
    const fallback: TrackedDeviceId[] = ["keyboard", "mouse", "headphones", "webcam", "microphone", "phone", "externalSSD"];
    return fallback.map((id) => ({ id, label: id.replace(/([A-Z])/g, " $1").trim(), connected: false }));
  }
}

// ── Full hardware dashboard ───────────────────────────

let dashboardCache: { value: HardwareDashboard; at: number } | null = null;

export async function getHardwareDashboard(force = false): Promise<HardwareDashboard> {
  if (!force && dashboardCache && Date.now() - dashboardCache.at < DEVICES_TTL_MS) {
    return dashboardCache.value;
  }

  const [hardware, storage, temperatures, motherboard, fans, usb, bluetooth, displays] = await Promise.all([
    getHardwareInfo(),
    getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
    getTemperatureInfo(),
    getMotherboardInfo(),
    getFans(),
    getUsbDevices(),
    getBluetoothDevices(),
    getDisplays(),
  ]);
  const ram = getRamInfo();

  const value: HardwareDashboard = {
    cpu: hardware.cpu,
    gpu: hardware.gpu,
    ram: { percentage: ram.percentage, usedGB: ram.usedGB, totalGB: ram.totalGB },
    storage,
    temperatures,
    motherboard,
    fans,
    battery: hardware.battery,
    displays,
    usbDevices: usb,
    bluetoothDevices: bluetooth,
    machine: hardware.machine,
    detectedAt: new Date().toISOString(),
  };
  dashboardCache = { value, at: Date.now() };
  return value;
}