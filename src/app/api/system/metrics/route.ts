import os from "node:os";
import {
  getHardwareInfo,
  getRamInfo,
  getStorageInfo,
  getCpuUsage,
  getNetworkInfo,
  getGpuUtilization,
  getTemperatureInfo,
  getGpuMemoryUsage,
} from "@/lib/system/hardware";
import type { SystemSnapshot } from "@/types";

import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [hardware, cpuPercentage, network, storage, temperatures, gpuMemory] = await Promise.all([
    getHardwareInfo(),
    getCpuUsage(),
    getNetworkInfo(),
    getStorageInfo().catch(() => ({ percentage: 0, usedGB: 0, totalGB: 0, mount: "" })),
    getTemperatureInfo(),
    getGpuMemoryUsage(),
  ]);

  const ram = getRamInfo();
  const gpuPercentage = getGpuUtilization(hardware.gpu);

  const snapshot: SystemSnapshot = {
    cpu: {
      percentage: cpuPercentage,
      model: hardware.cpu.model,
      cores: hardware.cpu.cores,
      logical: hardware.cpu.logical,
      speedMHz: hardware.cpu.speedMHz,
    },
    ram: {
      percentage: ram.percentage,
      usedGB: Number(ram.usedGB.toFixed(2)),
      totalGB: Number(ram.totalGB.toFixed(2)),
    },
    storage,
    gpu: {
      ...hardware.gpu,
      percentage: gpuPercentage,
      ...(gpuMemory ? { vramUsedMB: gpuMemory.usedMB } : {}),
    },
    temperatures,
    network: network.totals,
    interfaces: network.interfaces,
    machine: hardware.machine,
    battery: hardware.battery,
    uptime: os.uptime(),
    source: "live",
  };

  return jsonResponse(request, snapshot, { headers: { "Cache-Control": "no-store" } });
}