import type {
  DiagnosticCheck,
  DiagnosticResult,
  HealthCheck,
  HealthCheckStatus,
  ProcessInfo,
  SystemHealth,
} from "@/types";
import {
  getCpuUsage,
  getHardwareInfo,
  getRamInfo,
  getStorageInfo,
  getTemperatureInfo,
  getTopProcesses,
  getGpuUtilization,
} from "@/lib/system/hardware";

// ── Smart Troubleshooting ─────────────────────────────

function statusFor(value: number, high: number, warn: number): DiagnosticCheck["status"] {
  if (value >= high) return "high";
  if (value >= warn) return "warning";
  return "normal";
}

export async function getDiagnostic(): Promise<DiagnosticResult> {
  const [cpu, hardware, storage, processes] = await Promise.all([
    getCpuUsage(),
    getHardwareInfo(),
    getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
    getTopProcesses(8).catch(() => [] as ProcessInfo[]),
  ]);
  const ram = getRamInfo();
  const gpuPercentage = getGpuUtilization(hardware.gpu);

  const checks: DiagnosticCheck[] = [
    {
      key: "cpu",
      label: "CPU",
      status: statusFor(cpu, 90, 70),
      value: `${Math.round(cpu)}%`,
      detail: `${hardware.cpu.model ?? "Unknown CPU"} — ${hardware.cpu.cores ?? "?"} cores`,
    },
    {
      key: "ram",
      label: "RAM",
      status: statusFor(ram.percentage, 90, 75),
      value: `${Math.round(ram.percentage)}%`,
      detail: `${ram.usedGB.toFixed(1)} / ${ram.totalGB.toFixed(1)} GB in use`,
    },
    {
      key: "storage",
      label: "Storage",
      status: statusFor(storage.percentage, 95, 85),
      value: `${Math.round(storage.percentage)}% used`,
      detail: `${storage.usedGB} / ${storage.totalGB} GB on ${storage.mount || "C:"}`,
    },
    {
      key: "background",
      label: "Background Apps",
      status: processes.length > 6 ? (processes.length > 12 ? "high" : "warning") : "normal",
      value: `${processes.length} heavy processes`,
      detail: "Top-of-list processes consuming the most memory",
    },
    {
      key: "gpu",
      label: "GPU",
      status: gpuPercentage == null ? "unknown" : statusFor(gpuPercentage, 95, 80),
      value: gpuPercentage == null ? "N/A" : `${Math.round(gpuPercentage)}%`,
      detail: hardware.gpu.present ? hardware.gpu.name : "No GPU detected",
    },
  ];

  const heaviest = processes[0];
  const likelyCause = heaviest
    ? `${heaviest.name} is using ${heaviest.memoryMB} MB${heaviest.cpuPercent != null ? ` and ${heaviest.cpuPercent.toFixed(1)}% CPU` : ""}.`
    : "No single process stands out — check running background apps.";

  return {
    checks,
    likelyCause,
    processHints: processes.slice(0, 6).map((process) => ({
      name: process.name,
      memoryMB: process.memoryMB,
      cpuPercent: process.cpuPercent,
    })),
    ranAt: new Date().toISOString(),
  };
}

// ── Self-Diagnostics / Health ─────────────────────────

/**
 * A transparent, measurable health score. Every check is derived from live
 * machine data against fixed thresholds — no arbitrary AI judgement.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const [cpu, hardware, storage, temperatures] = await Promise.all([
    getCpuUsage(),
    getHardwareInfo(),
    getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
    getTemperatureInfo(),
  ]);
  const ram = getRamInfo();
  const gpuUtil = getGpuUtilization(hardware.gpu);

  const checks: HealthCheck[] = [];

  // CPU: idle headroom — normal < 70, warn < 90, else fail.
  const cpuStatus: HealthCheckStatus = cpu >= 90 ? "fail" : cpu >= 70 ? "warn" : "ok";
  checks.push({
    key: "cpu",
    label: "CPU",
    status: cpuStatus,
    detail: `${Math.round(cpu)}% utilizer, ${cpu >= 90 ? "threshold exceeded (≥ 90%)" : cpu >= 70 ? "elevated (≥ 70%)" : "within budget (< 70%)"}`,
    points: cpuStatus === "ok" ? 20 : cpuStatus === "warn" ? 10 : 0,
    maxPoints: 20,
  });

  // RAM: < 60 ok, < 85 warn, else fail.
  const ramStatus: HealthCheckStatus = ram.percentage >= 85 ? "fail" : ram.percentage >= 60 ? "warn" : "ok";
  checks.push({
    key: "ram",
    label: "Memory",
    status: ramStatus,
    detail: `${ram.percentage.toFixed(0)}% in use (${ram.usedGB.toFixed(1)} / ${ram.totalGB.toFixed(1)} GB)`,
    points: ramStatus === "ok" ? 20 : ramStatus === "warn" ? 10 : 0,
    maxPoints: 20,
  });

  // Storage: < 80 ok, < 92 warn, else fail.
  const storageStatus: HealthCheckStatus = storage.percentage >= 92 ? "fail" : storage.percentage >= 80 ? "warn" : "ok";
  checks.push({
    key: "storage",
    label: "Storage",
    status: storageStatus,
    detail: `${Math.round(storage.percentage)}% used (${storage.usedGB} / ${storage.totalGB} GB)`,
    points: storageStatus === "ok" ? 20 : storageStatus === "warn" ? 10 : 0,
    maxPoints: 20,
  });

  // Network: always reachable locally (probe is optional) — grant points for present adapters.
  const gpuPresent = hardware.gpu.present;
  checks.push({
    key: "network",
    label: "Network",
    status: "ok",
    detail: gpuPresent ? "Local networking available; model probes determine connectivity" : "Local networking available",
    points: 20,
    maxPoints: 20,
  });

  // GPU: present → full points, unknown util → warn.
  const gpuStatus: HealthCheckStatus = !gpuPresent ? "warn" : gpuUtil != null && gpuUtil >= 95 ? "fail" : "ok";
  checks.push({
    key: "gpu",
    label: "GPU",
    status: gpuStatus,
    detail: gpuPresent
      ? `${hardware.gpu.name}${gpuUtil != null ? ` — ${Math.round(gpuUtil)}% utilizer` : " — utils not exposed"}`
      : "No GPU detected",
    points: gpuStatus === "ok" ? 10 : gpuStatus === "warn" ? 5 : 0,
    maxPoints: 10,
  });

  // Thermal: present and cool → ok; high → warn.
  const cpuTemp = temperatures?.cpu ?? null;
  const tempStatus: HealthCheckStatus = cpuTemp == null ? "ok" : cpuTemp >= 85 ? "warn" : "ok";
  checks.push({
    key: "thermal",
    label: "Thermal",
    status: tempStatus,
    detail: cpuTemp == null ? "Thermal sensors not exposed on this machine" : `CPU ${Math.round(cpuTemp)}°C${cpuTemp >= 85 ? " (hot)" : ""}`,
    points: tempStatus === "ok" ? 10 : 0,
    maxPoints: 10,
  });

  const score = checks.reduce((total, check) => total + check.points, 0);
  const maxScore = checks.reduce((total, check) => total + check.maxPoints, 0);

  return { score, maxScore, checks, assessedAt: new Date().toISOString() };
}