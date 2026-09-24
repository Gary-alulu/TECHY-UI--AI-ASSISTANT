import { getBluetoothDevices, getDisplays, getTrackedDevices, getUsbDevices } from "@/lib/system/devices";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [displays, tracked, usb, bluetooth] = await Promise.all([
    getDisplays(),
    getTrackedDevices(),
    getUsbDevices(),
    getBluetoothDevices(),
  ]);
  return jsonResponse(
    request,
    { displays, tracked, usbDevices: usb, bluetoothDevices: bluetooth },
    { headers: { "Cache-Control": "no-store" } }
  );
}