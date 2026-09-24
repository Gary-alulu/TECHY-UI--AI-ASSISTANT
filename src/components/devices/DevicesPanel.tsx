"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/context/BrandContext";
import { HUDButton } from "@/components/ui/HUDButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Bluetooth,
  Headphones,
  Keyboard,
  Loader2,
  Monitor,
  Mouse,
  RefreshCw,
  Usb,
  Video,
  Webcam,
  Smartphone,
  HardDrive,
} from "lucide-react";
import type { BluetoothDeviceInfo, DisplayInfo, TrackedDevice, UsbDeviceInfo } from "@/types";
import { cn } from "@/lib/utils";

const TRACKED_ICON: Record<string, React.ReactNode> = {
  keyboard: <Keyboard size={14} />,
  mouse: <Mouse size={14} />,
  headphones: <Headphones size={14} />,
  webcam: <Webcam size={14} />,
  microphone: <Video size={14} />,
  phone: <Smartphone size={14} />,
  externalSSD: <HardDrive size={14} />,
};

export function DevicesPanel() {
  const { accent } = useBrand();
  const [tracked, setTracked] = useState<TrackedDevice[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [usbDevices, setUsbDevices] = useState<UsbDeviceInfo[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const response = await fetch("/api/devices", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as {
          tracked: TrackedDevice[];
          displays: DisplayInfo[];
          usbDevices: UsbDeviceInfo[];
          bluetoothDevices: BluetoothDeviceInfo[];
        };
        setTracked(data.tracked);
        setDisplays(data.displays);
        setUsbDevices(data.usbDevices);
        setBluetoothDevices(data.bluetoothDevices);
      }
    } catch {
      // keep last snapshot
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const connectedCount = tracked.filter((device) => device.connected).length;

  return (
    <div className="flex flex-col gap-5">
      <GlassPanel className="p-4 flex items-center justify-between gap-3 border-slate-800">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <Monitor size={14} className="text-cyan-400" />
          <span>
            {loading ? "Scanning devices…" : `${connectedCount} of ${tracked.length} key devices connected · ${usbDevices.length} USB · ${displays.length} displays`}
          </span>
        </div>
        <HUDButton variant="outline" size="sm" className="text-slate-400" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <RefreshCw size={12} className="mr-1.5" />}
          Rescan
        </HUDButton>
      </GlassPanel>

      {/* Tracked devices */}
      <GlassPanel header="Tracked Devices" className="p-5 gap-4 border-slate-800" hudCorners>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tracked.map((device) => (
            <div key={device.id} className={cn("rounded-xl border p-4 flex items-start gap-3", device.connected ? "border-emerald-400/20 bg-emerald-950/10" : "border-slate-800 bg-navy-950/50")}>
              <div
                className="w-9 h-9 rounded-lg bg-navy-950 border flex items-center justify-center shrink-0"
                style={{ borderColor: device.connected ? "#34d39966" : `${accent.hex}33`, color: device.connected ? "#34d399" : accent.hex }}
              >
                {TRACKED_ICON[device.id] ?? <Usb size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{device.label}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", device.connected ? "bg-emerald-400 animate-pulse" : "bg-slate-700")} />
                </div>
                <div className={cn("text-[10px] font-mono uppercase tracking-wider mt-1", device.connected ? "text-emerald-400" : "text-slate-600")}>
                  {device.connected ? "Connected" : "Not detected"}
                </div>
                {device.detail && <div className="text-[10px] text-slate-500 truncate mt-0.5">{device.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Displays */}
        <GlassPanel header={`Displays · ${displays.length}`} className="p-5 gap-3 border-slate-800" hudCorners>
          <div className="flex flex-col gap-2.5">
            {displays.map((display) => (
              <div key={display.id} className="rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2.5 flex items-center gap-3">
                <span className={cn("w-2 h-2 rounded-full shrink-0", display.online ? "bg-emerald-400" : "bg-slate-700")} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">{display.label ?? display.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">{display.resolution ?? display.name}</div>
                </div>
                {display.primary && <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">Primary</span>}
              </div>
            ))}
            {displays.length === 0 && <p className="text-xs text-slate-500">No displays enumerated.</p>}
          </div>
        </GlassPanel>

        {/* USB */}
        <GlassPanel header={`USB Devices · ${usbDevices.length}`} className="p-5 gap-3 border-slate-800" hudCorners>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {usbDevices.map((device, index) => (
              <div key={index} className="rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2 flex items-start gap-2.5">
                <Usb size={12} className="mt-0.5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-300 truncate">{device.name}</div>
                  {device.manufacturer && <div className="text-[10px] font-mono text-slate-600 truncate">{device.manufacturer}</div>}
                </div>
              </div>
            ))}
            {usbDevices.length === 0 && <p className="text-xs text-slate-500">No USB devices enumerated.</p>}
          </div>
        </GlassPanel>

        {/* Bluetooth */}
        <GlassPanel header={`Bluetooth · ${bluetoothDevices.length}`} className="p-5 gap-3 border-slate-800" hudCorners>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {bluetoothDevices.map((device, index) => (
              <div key={index} className="rounded-lg bg-navy-950/50 border border-slate-800/70 px-3 py-2 flex items-center gap-3">
                <Bluetooth size={12} className={cn("shrink-0", device.connected ? "text-emerald-400" : "text-slate-600")} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-300 truncate">{device.name}</div>
                </div>
                <span className={cn("text-[10px] font-mono uppercase tracking-wider", device.connected ? "text-emerald-400" : "text-slate-600")}>
                  {device.connected ? "On" : "Off"}
                </span>
              </div>
            ))}
            {bluetoothDevices.length === 0 && <p className="text-xs text-slate-500">No Bluetooth devices enumerated.</p>}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}