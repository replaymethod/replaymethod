import { loadPublicReport } from "../../../../lib/report-data";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const report = await loadPublicReport(publicId);
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
