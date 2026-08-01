import { DELETE as deleteImage } from "../../../../uploads/[uploadId]/route";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ memoryMapId: string; uploadId: string }> }) {
  const { memoryMapId, uploadId } = await params;
  const body = await request.json().catch(() => ({}));
  const forwarded = new Request(request.url, { method: "DELETE", headers: { authorization: request.headers.get("authorization") ?? "", "content-type": "application/json" }, body: JSON.stringify({ ...(typeof body === "object" && body !== null ? body : {}), memoryMapId, uploadId }) });
  return deleteImage(forwarded, { params: Promise.resolve({ uploadId }) });
}
