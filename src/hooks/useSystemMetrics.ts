"use client";

import { useState, useEffect } from "react";
import { SystemMetrics, SystemSnapshot } from "@/types";

const HISTORY = 30;
const EMPTY_HISTORY = Array(HISTORY).fill(0);

const emptyMetrics = (): SystemMetrics => ({
  cpu: { percentage: 0, history: [...EMPTY_HISTORY] },
  ram: { percentage: 0, used: 0, total: 0, unit: "GB", history: [...EMPTY_HISTORY] },
  gpu: {
    percentage: 0,
    history: [...EMPTY_HISTORY],
    present: false,
    type: "none",
    hasDedicated: false,
    hasIntegrated: false,
    name: "Not detected",
    vendor: "Unknown",
  },
  storage: { percentage: 0, used: 0, total: 0, unit: "GB" },
  network: { upload: 0, download: 0, unit: "MB/s" },
  uptime: 0,
});

const pushHistory = (history: number[], value: number) => [...history.slice(1), value];
const round = (value: number) => Number(value.toFixed(1));
const clampPct = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function applySnapshot(previous: SystemMetrics, snapshot: SystemSnapshot): SystemMetrics {
  const cpuPct = clampPct(snapshot.cpu.percentage);
  const ramPct = clampPct(snapshot.ram.percentage);
  const gpuPct = snapshot.gpu.percentage == null ? 0 : clampPct(snapshot.gpu.percentage);

  return {
    cpu: {
      percentage: cpuPct,
      model: snapshot.cpu.model,
      cores: snapshot.cpu.cores,
      logical: snapshot.cpu.logical,
      speedMHz: snapshot.cpu.speedMHz,
      history: pushHistory(previous.cpu.history, cpuPct),
    },
    ram: {
      percentage: ramPct,
      used: round(snapshot.ram.usedGB),
      total: round(snapshot.ram.totalGB),
      unit: "GB",
      history: pushHistory(previous.ram.history, ramPct),
    },
    gpu: {
      percentage: gpuPct,
      present: snapshot.gpu.present,
      type: snapshot.gpu.type,
      hasDedicated: snapshot.gpu.hasDedicated,
      hasIntegrated: snapshot.gpu.hasIntegrated,
      name: snapshot.gpu.name,
      vendor: snapshot.gpu.vendor,
      vramMB: snapshot.gpu.vramMB,
      vramUsedMB: snapshot.gpu.vramUsedMB,
      history: pushHistory(previous.gpu.history, gpuPct),
    },
    storage: {
      percentage: Math.round(snapshot.storage.percentage),
      used: round(snapshot.storage.usedGB),
      total: round(snapshot.storage.totalGB),
      unit: "GB",
      mount: snapshot.storage.mount,
    },
    network: {
      upload: snapshot.network.upload,
      download: snapshot.network.download,
      unit: snapshot.network.unit,
    },
    uptime: snapshot.uptime,
    machine: snapshot.machine,
    battery: snapshot.battery ?? undefined,
    temperatures: snapshot.temperatures,
    source: "live",
  };
}

export function useSystemMetrics(intervalMs: number = 3000) {
  const [metrics, setMetrics] = useState<SystemMetrics>(emptyMetrics);
  const [isLive, setIsLive] = useState<boolean>(false);

  // Poll the local core for real machine data.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const response = await fetch("/api/system/metrics", { cache: "no-store" });
        if (!response.ok) throw new Error(`Metrics request failed (${response.status})`);
        const snapshot = (await response.json()) as SystemSnapshot;
        if (snapshot.source !== "live") throw new Error("Metrics endpoint unavailable");
        if (cancelled) return;

        setMetrics((previous) => applySnapshot(previous, snapshot));
        setIsLive(true);
      } catch {
        // Keep isLive false so the simulation below takes over.
      }
    };

    poll();
    const pollInterval = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [intervalMs]);

  // Random-walk simulation keeps the panels alive while the core is unreachable.
  useEffect(() => {
    if (isLive) return;

    let cpu = 12;
    let ram = 34;
    let gpu = 8;
    let up = 0.5;
    let down = 2.1;

    const simulate = () => {
      cpu = Math.min(100, Math.max(1, cpu + (Math.random() - 0.5) * 15));
      ram = Math.min(95, Math.max(10, ram + (Math.random() - 0.5) * 2));
      gpu = Math.min(100, Math.max(0, gpu + (Math.random() - 0.5) * 10));
      up = Math.max(0, up + (Math.random() - 0.5) * 1);
      down = Math.max(0, down + (Math.random() - 0.5) * 5);

      setMetrics((previous) => {
        const cpuPct = Math.round(cpu);
        const ramPct = Math.round(ram);
        const gpuPct = Math.round(gpu);
        return {
          ...previous,
          cpu: {
            ...previous.cpu,
            percentage: cpuPct,
            history: pushHistory(previous.cpu.history, cpuPct),
          },
          ram: {
            ...previous.ram,
            percentage: ramPct,
            used: round((ramPct / 100) * (previous.ram.total || 32)),
            history: pushHistory(previous.ram.history, ramPct),
          },
          gpu: {
            ...previous.gpu,
            percentage: gpuPct,
            history: pushHistory(previous.gpu.history, gpuPct),
          },
          network: { upload: round(up), download: round(down), unit: "MB/s" },
          uptime: (previous.uptime || 0) + intervalMs / 1000,
          source: "simulated",
        };
      });
    };

    simulate();
    const simulateInterval = setInterval(simulate, intervalMs);
    return () => clearInterval(simulateInterval);
  }, [isLive, intervalMs]);

  return { metrics, isLive };
}