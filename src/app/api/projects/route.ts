import { getProjects } from "@/lib/projects";
import { jsonResponse } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const projects = await getProjects();
  return jsonResponse(request, { projects });
}