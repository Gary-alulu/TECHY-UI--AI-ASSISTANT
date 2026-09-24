import { execFile } from "node:child_process";
import { getNetworkInfo } from "@/lib/system/hardware";
import type {
  AdapterKind,
  AdapterStatus,
  NetworkIntelligence,
  NetworkNeighbor,
} from "@/types";

function execFileAsync(command: string, args: string[], timeout = 12_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function powershell(script: string, timeout = 12_000): Promise<string> {
  return execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], timeout);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function classifyAdapter(name: string, description: string, mediaType: string): AdapterKind {
  const hay = `${name} ${description} ${mediaType}`.toLowerCase();
  if (/wi-?fi|wireless|802\.11|wlan/.test(hay)) return "wifi";
  if (/bluetooth|bt\b/.test(hay)) return "bluetooth";
  if (/ethernet|gigabit|lan\b|wired/.test(hay)) return "ethernet";
  if (/virtual|vmware|loopback|hyper-v|docker|tap|tun/.test(hay)) return "virtual";
  return "other";
}

interface WinAdapter {
  Name?: string;
  InterfaceDescription?: string;
  Status?: string;
  LinkSpeed?: number | string | null;
  MacAddress?: string;
  MediaType?: string;
  ifIndex?: number;
}

export async function getNetworkIntelligence(): Promise<NetworkIntelligence> {
  const network = await getNetworkInfo().catch(() => ({
    totals: { upload: 0, download: 0, unit: "MB/s" },
    interfaces: [] as NetworkIntelligence["interfaces"],
  }));

  let adapters: AdapterStatus[] = [];
  let neighbors: NetworkNeighbor[] = [];
  let latency: number | null = null;
  let gateway = "";

  if (process.platform === "win32") {
    try {
      const adaptersScript =
        "$ErrorActionPreference='SilentlyContinue'; Get-NetAdapter | Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress,MediaType | ConvertTo-Json -Compress -Depth 3";
      const raw = await powershell(adaptersScript, 15_000);
      const rows = toArray<WinAdapter>(JSON.parse(raw.trim() || "[]"));
      adapters = rows
        .filter((row) => row.Name)
        .map((row) => {
          const kind = classifyAdapter(row.Name ?? "", row.InterfaceDescription ?? "", row.MediaType ?? "");
          const linkSpeed = typeof row.LinkSpeed === "number" && row.LinkSpeed > 0 ? Math.round(row.LinkSpeed / 1_000_000) : undefined;
          return {
            name: row.Name as string,
            kind,
            connected: row.Status === "Up",
            ...(linkSpeed ? { linkSpeedMbps: linkSpeed } : {}),
            ...(row.MacAddress ? { mac: row.MacAddress } : {}),
          };
        })
        .sort((a, b) => Number(b.connected) - Number(a.connected));
    } catch {
      adapters = [];
    }

    try {
      const gatewayScript =
        "$ErrorActionPreference='SilentlyContinue'; (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1).NextHop";
      gateway = (await powershell(gatewayScript, 10_000)).trim();
    } catch {
      gateway = "";
    }

    if (gateway) {
      latency = await pingLatency(gateway).catch(() => null);
    }

    try {
      const neighborsScript =
        "$ErrorActionPreference='SilentlyContinue'; Get-NetNeighbor -State Reachable,Stale | Where-Object { $_.IPAddress -notmatch '^(fe80|ff0)' } | Select-Object -First 40 IPAddress,LinkLayerAddress,State,InterfaceIndex | ConvertTo-Json -Compress";
      const raw = await powershell(neighborsScript, 15_000);
      const rows = toArray<{ IPAddress?: string; LinkLayerAddress?: string; State?: string }>(
        JSON.parse(raw.trim() || "[]")
      );
      neighbors = rows
        .filter((row) => row.IPAddress)
        .map((row) => ({
          ip: row.IPAddress as string,
          ...(row.LinkLayerAddress && row.LinkLayerAddress !== "ff-ff-ff-ff-ff-ff" ? { mac: row.LinkLayerAddress } : {}),
          state: (row.State ?? "").toLowerCase(),
          interfaceName: undefined,
        }));
    } catch {
      neighbors = [];
    }
  }

  return {
    totals: network.totals,
    interfaces: network.interfaces,
    adapters,
    neighbors,
    latencyMs: latency,
    probeTarget: gateway || "—",
    measuredAt: new Date().toISOString(),
  };
}

/** Rounds a one-shot ICMP ping latency to the nearest millisecond. */
export async function pingLatency(host: string): Promise<number | null> {
  const stdout = await execFileAsync("ping", ["-n", "1", "-w", "1500", host], 5000);
  const match = stdout.match(/[=\s](\d{1,4})\s*ms\b/i) ?? stdout.match(/round-trip.*?[,\s](\d{1,4})[,\s]/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}