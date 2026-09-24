import { getPerformanceSamples, recordPerformance } from "@/lib/models";
import { getGpuMemoryUsage, getGpuUtilization, getHardwareInfo } from "@/lib/system/hardware";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [samples, hardware] = await Promise.all([
    getPerformanceSamples(30),
    getHardwareInfo().catch(() => null),
  ]);
  const gpuVram = hardware?.gpu.present ? getGpuMemoryUsage() : null;
  const gpuUtilization = hardware?.gpu.present ? getGpuUtilization(hardware.gpu) : null;

  const metric = (key: "tokensPerSec" | "latencyMs" | "contextSize" | "inferenceTimeMs" | "totalTokens") => {
    const values = samples.map((sample) => sample[key]).filter((value): value is number => typeof value === "number");
    if (values.length === 0) return undefined;
    const total = values.reduce((a, b) => a + b, 0);
    return Math.round((total / values.length) * 10) / 10;
  };

  return jsonResponse(
    request,
    {
      samples,
      gpuVram,
      gpuUtilization,
      metrics: {
        tokensPerSec: metric("tokensPerSec"),
        latencyMs: metric("latencyMs"),
        contextSize: metric("contextSize"),
        inferenceTimeMs: metric("inferenceTimeMs"),
        totalTokens: metric("totalTokens"),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, { status: 400 });
  }
  const model = typeof body.model === "string" ? body.model : "";
  const latencyMs = Number(body.latencyMs);
  if (!model || !Number.isFinite(latencyMs)) {
    return jsonResponse(request, { error: "model and latencyMs are required" }, { status: 400 });
  }

  await recordPerformance({
    model,
    latencyMs,
    inferenceTimeMs: body.inferenceTimeMs != null ? Number(body.inferenceTimeMs) : undefined,
    contextSize: body.contextSize != null ? Number(body.contextSize) : undefined,
    totalTokens: body.totalTokens != null ? Number(body.totalTokens) : undefined,
    tokensPerSec: body.tokensPerSec != null ? Number(body.tokensPerSec) : null,
    gpuUtilization: body.gpuUtilization != null ? Number(body.gpuUtilization) : null,
  });
  return jsonResponse(request, { ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}