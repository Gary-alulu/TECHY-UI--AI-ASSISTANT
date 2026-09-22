import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import type {
  BatteryMetric,
  CpuInfo,
  GpuDevice,
  GpuInfo,
  GpuType,
  MachineInfo,
  NetworkInterfaceInfo,
  NetworkMetric,
  ProcessInfo,
} from "@/types";

const GB = 1024 ** 3;
const HARDWARE_TTL_MS = 5 * 60 * 1000;
const GPU_UTIL_TTL_MS = 4000;
const STORAGE_TTL_MS = 5000;

interface HardwareSnapshot {
  cpu: CpuInfo;
  gpu: GpuInfo;
  machine: MachineInfo;
  battery: BatteryMetric | null;
}

// ── Process helpers ────────────────────────────────────

function execFileAsync(command: string, args: string[], timeout = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function powershell(script: string, timeout = 10_000): Promise<string> {
  return execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], timeout);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// ── GPU classification ─────────────────────────────────

const SOFTWARE_PATTERN = /(basic display|basic render|remote display|indirect display|virtual display|hyper-v|parsec|usb display)/i;
const VIRTUAL_VENDORS = new Set(["QEMU", "VMware", "Oracle", "Red Hat", "Parallels", "Microsoft"]);

const AMD_INTEGRATED = /(radeon\s+(graphics|vega)|vega\s?\d|radeon\s+r[2-7]\b|\br[2-7]\s+graphics|radeon\s+(610m|660m|680m|760m|780m|880m|890m))/i;
const AMD_DEDICATED = /(radeon\s+(rx|pro|vii|hd\s+\d{4})|\brx\s?\d{3,4}|vega\s?(56|64)|r[579]\s+\d{3})/i;

function classifyType(vendor: string, name: string): GpuType {
  const n = name.toLowerCase();

  switch (vendor) {
    case "NVIDIA":
      return "dedicated";
    case "Apple":
      // Apple Silicon / discrete Apple GPUs report as unified in modern Macs.
      return "integrated";
    case "Intel":
      // Intel Arc is the only Intel line that ships as a discrete card.
      return /\barc\b/.test(n) ? "dedicated" : "integrated";
    case "AMD":
      if (AMD_INTEGRATED.test(n)) return "integrated";
      if (AMD_DEDICATED.test(n)) return "dedicated";
      return "unknown";
    default:
      return "unknown";
  }
}

const VENDOR_BY_PCI_ID: Record<string, string> = {
  "8086": "Intel",
  "10DE": "NVIDIA",
  "1002": "AMD",
  "1022": "AMD",
  "106B": "Apple",
  "1414": "Microsoft",
  "1234": "QEMU",
  "15AD": "VMware",
  "80EE": "Oracle",
  "1AF4": "Red Hat",
  "1B36": "Red Hat",
  "1A03": "ASPEED",
  "5333": "S3",
};

function vendorFrom(name: string, compatibility: string, pnpId?: string): string {
  const pciId = pnpId?.match(/VEN_([0-9A-F]{4})/i)?.[1]?.toUpperCase();
  if (pciId && VENDOR_BY_PCI_ID[pciId]) return VENDOR_BY_PCI_ID[pciId];

  const hay = `${name} ${compatibility}`.toLowerCase();
  if (/(nvidia|geforce|quadro|rtx)/.test(hay)) return "NVIDIA";
  if (/(amd|radeon|\bati\b)/.test(hay)) return "AMD";
  if (/intel/.test(hay)) return "Intel";
  if (/apple/.test(hay)) return "Apple";
  if (/microsoft/.test(hay)) return "Microsoft";
  if (/(vmware|virtualbox|qemu|red hat|virtio)/.test(hay)) return "Red Hat";
  return "Unknown";
}

function buildGpuInfo(devices: GpuDevice[]): GpuInfo {
  const primary =
    devices.find((d) => d.type === "dedicated") ??
    devices.find((d) => d.type === "integrated") ??
    devices[0];

  if (!primary) {
    return {
      present: false,
      type: "none",
      hasDedicated: false,
      hasIntegrated: false,
      name: "Not detected",
      vendor: "Unknown",
      devices: [],
    };
  }

  return {
    present: true,
    type: primary.type,
    hasDedicated: devices.some((d) => d.type === "dedicated"),
    hasIntegrated: devices.some((d) => d.type === "integrated"),
    name: primary.name,
    vendor: primary.vendor,
    vramMB: primary.vramMB,
    devices,
  };
}

function normalizeVram(bytes: number | undefined): number | undefined {
  if (!bytes || bytes <= 0) return undefined;
  // WMI caps AdapterRAM at the 32-bit limit on many drivers; treat that as "unknown".
  if (bytes >= 4_293_918_720) return undefined;
  const mb = Math.round(bytes / (1024 * 1024));
  return mb > 0 ? mb : undefined;
}

// ── Windows hardware ───────────────────────────────────

interface WinVideoController {
  Name?: string;
  AdapterRAM?: number;
  AdapterCompatibility?: string;
  PNPDeviceID?: string;
  DriverVersion?: string;
}

interface WinProcessor {
  Name?: string;
  NumberOfCores?: number;
  NumberOfLogicalProcessors?: number;
  MaxClockSpeed?: number;
}

interface WinComputerSystem {
  Manufacturer?: string;
  Model?: string;
  PCSystemType?: number;
  SystemType?: string;
}

interface WinBattery {
  Name?: string;
  BatteryStatus?: number;
  EstimatedChargeRemaining?: number;
}

interface WinHardwarePayload {
  cpu?: WinProcessor;
  gpu?: WinVideoController | WinVideoController[];
  cs?: WinComputerSystem;
  os?: { Caption?: string; Version?: string };
  battery?: WinBattery | WinBattery[];
}

const WINDOWS_HARDWARE_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue'",
  "$out=@{}",
  "$out.cpu=Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed",
  "$out.gpu=@(Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,AdapterCompatibility,PNPDeviceID,DriverVersion)",
  "$out.cs=Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,PCSystemType,SystemType",
  "$out.os=Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version",
  "$out.battery=@(Get-CimInstance Win32_Battery | Select-Object Name,BatteryStatus,EstimatedChargeRemaining)",
  "$out | ConvertTo-Json -Compress -Depth 5",
].join("; ");

async function loadWindowsHardware(): Promise<HardwareSnapshot> {
  const stdout = await powershell(WINDOWS_HARDWARE_SCRIPT, 15_000);
  const data = JSON.parse(stdout.trim() || "{}") as WinHardwarePayload;

  const logical = os.cpus().length;
  const cpu: CpuInfo = {
    model: data.cpu?.Name?.trim() || os.cpus()[0]?.model?.trim() || "Unknown CPU",
    cores: data.cpu?.NumberOfCores ?? logical,
    logical: data.cpu?.NumberOfLogicalProcessors ?? logical,
    speedMHz: data.cpu?.MaxClockSpeed ?? os.cpus()[0]?.speed ?? 0,
  };

  const devices: GpuDevice[] = [];
  for (const controller of toArray(data.gpu)) {
    const name = controller.Name?.trim() || "Unknown display adapter";
    if (SOFTWARE_PATTERN.test(name)) continue;

    const vendor = vendorFrom(name, controller.AdapterCompatibility ?? "", controller.PNPDeviceID);
    devices.push({
      name,
      vendor,
      type: VIRTUAL_VENDORS.has(vendor) ? "virtual" : classifyType(vendor, name),
      vramMB: normalizeVram(controller.AdapterRAM),
      driverVersion: controller.DriverVersion,
    });
  }
  await refineNvidiaDevices(devices);

  const batteries = toArray(data.battery);
  const battery = parseWindowsBattery(batteries);
  const isLaptop = data.cs?.PCSystemType === 2 || batteries.length > 0;

  const machine: MachineInfo = {
    hostname: os.hostname(),
    platform: "win32",
    osName: data.os?.Caption?.trim() || `Windows ${os.release()}`,
    arch: os.arch(),
    manufacturer: data.cs?.Manufacturer?.trim(),
    model: data.cs?.Model?.trim(),
    systemType: data.cs?.SystemType?.trim(),
    hasBattery: batteries.length > 0,
    isLaptop,
  };

  return { cpu, gpu: buildGpuInfo(devices), machine, battery };
}

function parseWindowsBattery(batteries: WinBattery[]): BatteryMetric | null {
  const first = batteries[0];
  if (!first) return null;

  const chargingStatuses = [2, 3, 6, 7, 8, 9, 11];
  return {
    percentage: Math.round(first.EstimatedChargeRemaining ?? 0),
    charging: chargingStatuses.includes(first.BatteryStatus ?? 0),
  };
}

async function refineNvidiaDevices(devices: GpuDevice[]): Promise<void> {
  const target = devices.find((d) => d.vendor === "NVIDIA");
  if (!target) return;

  try {
    const stdout = await execFileAsync(
      "nvidia-smi",
      ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
      5000
    );
    const line = stdout.split("\n").map((l) => l.trim()).filter(Boolean)[0];
    if (!line) return;

    const [name, memory] = line.split(",").map((part) => part.trim());
    if (name) target.name = name;
    const vramMB = Number(memory);
    if (Number.isFinite(vramMB) && vramMB > 0) target.vramMB = vramMB;
  } catch {
    // nvidia-smi not installed — keep the WMI-derived values.
  }
}

// ── Linux / macOS hardware ─────────────────────────────

async function loadUnixHardware(): Promise<HardwareSnapshot> {
  const cpus = os.cpus();
  const logical = cpus.length;
  const cores = await getUnixPhysicalCores(logical);

  const cpu: CpuInfo = {
    model: cpus[0]?.model?.trim() || os.arch(),
    cores,
    logical,
    speedMHz: cpus[0]?.speed ?? 0,
  };

  const gpu = process.platform === "darwin" ? await getMacGpu() : await getLinuxGpu();
  const battery = await getUnixBattery();
  const machine: MachineInfo = {
    hostname: os.hostname(),
    platform: process.platform,
    osName: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    hasBattery: battery !== null,
    isLaptop: battery !== null,
  };

  return { cpu, gpu, machine, battery };
}

async function getUnixPhysicalCores(logical: number): Promise<number> {
  try {
    if (process.platform === "darwin") {
      const stdout = await execFileAsync("sysctl", ["-n", "hw.physicalcpu"], 3000);
      const parsed = Number.parseInt(stdout.trim(), 10);
      if (parsed > 0) return parsed;
    } else {
      const stdout = await execFileAsync("lscpu", [], 3000);
      const perSocket = stdout.match(/^Core\(s\) per socket:\s*(\d+)/m);
      const sockets = stdout.match(/^Socket\(s\):\s*(\d+)/m);
      if (perSocket && sockets) return Number(perSocket[1]) * Number(sockets[1]);
    }
  } catch {
    // fall through to logical count
  }
  return logical;
}

async function getLinuxGpu(): Promise<GpuInfo> {
  try {
    const stdout = await execFileAsync("lspci", [], 5000);
    const devices: GpuDevice[] = stdout
      .split("\n")
      .filter((line) => /(vga|3d|display)/i.test(line))
      .map((line) => {
        const name = line
          .replace(/^[0-9a-f:.]+\s+/, "")
          .replace(/^.*?controller:\s*/i, "")
          .replace(/\s*\[[0-9a-f]{4}\]:?\s*/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        const vendor = vendorFrom(name, "");
        return { name, vendor, type: classifyType(vendor, name) };
      })
      .filter((device) => device.name && !SOFTWARE_PATTERN.test(device.name));

    return buildGpuInfo(devices);
  } catch {
    return buildGpuInfo([]);
  }
}

async function getMacGpu(): Promise<GpuInfo> {
  try {
    const stdout = await execFileAsync("system_profiler", ["SPDisplaysDataType", "-json"], 8000);
    const parsed = JSON.parse(stdout) as { SPDisplaysDataType?: Array<Record<string, unknown>> };
    const devices: GpuDevice[] = toArray(parsed.SPDisplaysDataType).map((entry) => {
      const name = String(entry.sppci_model ?? entry._name ?? "GPU");
      const compatibility = String(entry.sppci_vendor ?? "");
      const vendor = vendorFrom(name, compatibility);
      return {
        name,
        vendor,
        type: classifyType(vendor, name),
        vramMB: parseMacVram(entry.spdisplays_vram),
      };
    });
    return buildGpuInfo(devices);
  } catch {
    return buildGpuInfo([]);
  }
}

function parseMacVram(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return undefined;
  if (/gb/i.test(value)) return Math.round(amount * 1024);
  if (/mb/i.test(value)) return Math.round(amount);
  return undefined;
}

async function getUnixBattery(): Promise<BatteryMetric | null> {
  try {
    if (process.platform === "linux") {
      const entries = await fs.readdir("/sys/class/power_supply");
      const batteryEntry = entries.find((entry) => entry.toUpperCase().startsWith("BAT"));
      if (!batteryEntry) return null;

      const [capacity, status] = await Promise.all([
        fs.readFile(`/sys/class/power_supply/${batteryEntry}/capacity`, "utf8"),
        fs.readFile(`/sys/class/power_supply/${batteryEntry}/status`, "utf8"),
      ]);
      return {
        percentage: Number.parseInt(capacity.trim(), 10) || 0,
        charging: status.trim().toLowerCase() === "charging",
      };
    }

    const stdout = await execFileAsync("pmset", ["-g", "batt"], 3000);
    const match = stdout.match(/(\d+)%/);
    if (!match) return null;
    return {
      percentage: Number.parseInt(match[1], 10),
      charging: /charg(ing|ed)/i.test(stdout),
    };
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────

let hardwareCache: { value: HardwareSnapshot; at: number } | null = null;

export async function getHardwareInfo(): Promise<HardwareSnapshot> {
  if (hardwareCache && Date.now() - hardwareCache.at < HARDWARE_TTL_MS) {
    return hardwareCache.value;
  }

  let value: HardwareSnapshot;
  try {
    value = process.platform === "win32" ? await loadWindowsHardware() : await loadUnixHardware();
  } catch {
    value = {
      cpu: getCpuInfoFallback(),
      gpu: buildGpuInfo([]),
      machine: getMachineInfoFallback(),
      battery: null,
    };
  }

  hardwareCache = { value, at: Date.now() };
  return value;
}

function getCpuInfoFallback(): CpuInfo {
  const cpus = os.cpus();
  return {
    model: cpus[0]?.model?.trim() || os.arch(),
    cores: cpus.length,
    logical: cpus.length,
    speedMHz: cpus[0]?.speed ?? 0,
  };
}

function getMachineInfoFallback(): MachineInfo {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    osName: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    hasBattery: false,
    isLaptop: false,
  };
}

export function getRamInfo(): { percentage: number; usedGB: number; totalGB: number } {
  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(0, total - free);
  return {
    percentage: total > 0 ? Math.round((used / total) * 100) : 0,
    usedGB: used / GB,
    totalGB: total / GB,
  };
}

let storageCache: { value: Awaited<ReturnType<typeof readStorageInfo>>; at: number } | null = null;

async function readStorageInfo(): Promise<{
  percentage: number;
  usedGB: number;
  totalGB: number;
  mount: string;
}> {
  const mount = path.parse(process.cwd()).root || path.sep;
  const stats = await fs.statfs(mount);
  const total = stats.blocks * stats.bsize;
  const free = stats.bfree * stats.bsize;
  const used = Math.max(0, total - free);
  return {
    percentage: total > 0 ? Math.round((used / total) * 100) : 0,
    usedGB: used / GB,
    totalGB: total / GB,
    mount,
  };
}

export async function getStorageInfo(): Promise<{
  percentage: number;
  usedGB: number;
  totalGB: number;
  mount: string;
}> {
  if (storageCache && Date.now() - storageCache.at < STORAGE_TTL_MS) {
    return storageCache.value;
  }
  const value = await readStorageInfo();
  storageCache = { value, at: Date.now() };
  return value;
}

interface CpuTimes {
  idle: number;
  total: number;
}

let cpuBaseline: CpuTimes | null = null;

function readCpuTimes(): CpuTimes {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const { user, nice, sys, idle: cpuIdle, irq } = cpu.times;
    idle += cpuIdle;
    total += user + nice + sys + cpuIdle + irq;
  }
  return { idle, total };
}

function computeCpuUsage(previous: CpuTimes, current: CpuTimes): number {
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  if (totalDelta <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((1 - idleDelta / totalDelta) * 100)));
}

export async function getCpuUsage(): Promise<number> {
  const current = readCpuTimes();

  if (!cpuBaseline) {
    // First sample has no baseline — measure over a short window.
    cpuBaseline = current;
    await new Promise((resolve) => setTimeout(resolve, 200));
    const next = readCpuTimes();
    cpuBaseline = next;
    return computeCpuUsage(current, next);
  }

  const usage = computeCpuUsage(cpuBaseline, current);
  cpuBaseline = current;
  return usage;
}

interface NetworkCounterSnapshot {
  name: string;
  rx: number;
  tx: number;
  at: number;
}

let networkBaseline: NetworkCounterSnapshot[] = [];

export async function getNetworkInfo(): Promise<{
  totals: NetworkMetric;
  interfaces: NetworkInterfaceInfo[];
}> {
  const interfaces = await readNetworkInterfaces().catch(() => [] as NetworkInterfaceInfo[]);
  const now = Date.now();
  const previous = new Map(networkBaseline.map((entry) => [entry.name, entry]));
  const result: NetworkInterfaceInfo[] = [];

  for (const iface of interfaces) {
    const prev = previous.get(iface.name);
    let rxRate = 0;
    let txRate = 0;
    if (prev && now > prev.at) {
      const seconds = (now - prev.at) / 1000;
      rxRate = Math.max(0, (iface.rxBytes - prev.rx) / seconds);
      txRate = Math.max(0, (iface.txBytes - prev.tx) / seconds);
    }
    result.push({
      ...iface,
      rxRateMBps: toMegabytes(rxRate),
      txRateMBps: toMegabytes(txRate),
    });
  }

  networkBaseline = interfaces.map((iface) => ({
    name: iface.name,
    rx: iface.rxBytes,
    tx: iface.txBytes,
    at: now,
  }));

  const download = Number(result.reduce((sum, iface) => sum + iface.rxRateMBps, 0).toFixed(2));
  const upload = Number(result.reduce((sum, iface) => sum + iface.txRateMBps, 0).toFixed(2));

  return {
    totals: { upload, download, unit: "MB/s" },
    interfaces: result,
  };
}

export async function getNetworkRate(): Promise<NetworkMetric> {
  return (await getNetworkInfo()).totals;
}

function toMegabytes(bytesPerSecond: number): number {
  return Number((bytesPerSecond / (1024 * 1024)).toFixed(2));
}

async function readNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
  if (process.platform === "win32") {
    const script =
      "$ErrorActionPreference='SilentlyContinue'; Get-NetAdapterStatistics | Select-Object Name,ReceivedBytes,SentBytes | ConvertTo-Json -Compress";
    const stdout = await powershell(script, 6000);
    const adapters = toArray<{ Name?: string; ReceivedBytes?: number; SentBytes?: number }>(
      JSON.parse(stdout.trim() || "[]")
    );
    return adapters
      .filter((adapter) => adapter.Name)
      .map((adapter) => ({
        name: adapter.Name as string,
        rxBytes: adapter.ReceivedBytes ?? 0,
        txBytes: adapter.SentBytes ?? 0,
        rxRateMBps: 0,
        txRateMBps: 0,
      }));
  }

  if (process.platform === "linux") {
    const contents = await fs.readFile("/proc/net/dev", "utf8");
    const interfaces: NetworkInterfaceInfo[] = [];
    for (const line of contents.split("\n").slice(2)) {
      const match = line.match(/^\s*([^:]+):\s+(.+)$/);
      if (!match) continue;
      const name = match[1].trim();
      if (name === "lo") continue;
      const columns = match[2].trim().split(/\s+/);
      if (columns.length < 8) continue;
      interfaces.push({
        name,
        rxBytes: Number(columns[0]) || 0,
        txBytes: Number(columns[8]) || 0,
        rxRateMBps: 0,
        txRateMBps: 0,
      });
    }
    return interfaces;
  }

  const stdout = await execFileAsync("netstat", ["-ib"], 5000);
  const totals = new Map<string, { rx: number; tx: number }>();
  for (const line of stdout.split("\n").slice(1)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 10) continue;
    const name = columns[0];
    const rx = Number(columns[6]) || 0;
    const tx = Number(columns[9]) || 0;
    const entry = totals.get(name) ?? { rx: 0, tx: 0 };
    entry.rx += rx;
    entry.tx += tx;
    totals.set(name, entry);
  }
  return Array.from(totals.entries())
    .filter(([name]) => name !== "lo")
    .map(([name, { rx, tx }]) => ({
      name,
      rxBytes: rx,
      txBytes: tx,
      rxRateMBps: 0,
      txRateMBps: 0,
    }));
}

// ── Running processes ─────────────────────────────────

export async function getTopProcesses(limit = 20): Promise<ProcessInfo[]> {
  try {
    if (process.platform === "win32") return await getTopProcessesWindows(limit);
    if (process.platform === "darwin") return await getTopProcessesMac(limit);
    return await getTopProcessesLinux(limit);
  } catch {
    return [];
  }
}

async function getTopProcessesWindows(limit: number): Promise<ProcessInfo[]> {
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First ${limit} Id,ProcessName,WorkingSet64,CPU,Responding,Path | ConvertTo-Json -Compress`,
  ].join("; ");

  const stdout = await powershell(script, 12_000);
  const rows = toArray<{
    Id?: number;
    ProcessName?: string;
    WorkingSet64?: number;
    CPU?: number | null;
    Responding?: boolean;
    Path?: string | null;
  }>(JSON.parse(stdout.trim() || "[]"));

  return rows.map((row) => ({
    pid: row.Id ?? 0,
    name: row.ProcessName ?? "Unknown",
    memoryMB: Math.round((row.WorkingSet64 ?? 0) / (1024 * 1024)),
    cpuSeconds: typeof row.CPU === "number" ? Math.round(row.CPU * 10) / 10 : undefined,
    responding: row.Responding,
    path: row.Path ?? undefined,
  }));
}

async function getTopProcessesLinux(limit: number): Promise<ProcessInfo[]> {
  const stdout = await execFileAsync(
    "ps",
    ["-e", "-o", "pid=,comm=,rss=,%cpu=,args=", "--sort=-rss"],
    6000
  );
  return parseProcessTable(stdout).slice(0, limit);
}

async function getTopProcessesMac(limit: number): Promise<ProcessInfo[]> {
  const stdout = await execFileAsync("ps", ["-A", "-o", "pid=,comm=,rss=,%cpu=,args="], 6000);
  const rows = parseProcessTable(stdout);
  rows.sort((a, b) => b.memoryMB - a.memoryMB);
  return rows.slice(0, limit);
}

function parseProcessTable(stdout: string): ProcessInfo[] {
  const rows: ProcessInfo[] = [];
  for (const line of stdout.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    if (!match) continue;

    const pid = Number.parseInt(match[1], 10);
    const memoryKB = Number.parseInt(match[3], 10);
    const cpuPercent = Number.parseFloat(match[4]);
    rows.push({
      pid,
      name: match[2],
      memoryMB: Number.isFinite(memoryKB) ? Math.round(memoryKB / 1024) : 0,
      cpuPercent: Number.isFinite(cpuPercent) ? Math.round(cpuPercent * 100) / 100 : undefined,
      path: match[5]?.trim() || undefined,
    });
  }
  return rows;
}

const gpuUtilization: { value: number | null; at: number; refreshing: boolean } = {
  value: null,
  at: 0,
  refreshing: false,
};

/**
 * GPU utilization can only be sampled slowly (Windows performance counter),
 * so it is refreshed in the background and the latest value is returned.
 */
export function getGpuUtilization(gpu: GpuInfo): number | null {
  if (!gpu.present || process.platform !== "win32") return null;

  const stale = Date.now() - gpuUtilization.at > GPU_UTIL_TTL_MS;
  if (stale && !gpuUtilization.refreshing) {
    gpuUtilization.refreshing = true;
    const script =
      "$ErrorActionPreference='SilentlyContinue'; (Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -MaxSamples 1).CounterSamples | Measure-Object CookedValue -Maximum | Select-Object -ExpandProperty Maximum";

    powershell(script, 7000)
      .then((stdout) => {
        const value = Number(stdout.trim());
        gpuUtilization.value = Number.isFinite(value) ? Math.min(100, Math.round(value)) : null;
      })
      .catch(() => {
        gpuUtilization.value = null;
      })
      .finally(() => {
        gpuUtilization.at = Date.now();
        gpuUtilization.refreshing = false;
      });
  }

  return gpuUtilization.value;
}
