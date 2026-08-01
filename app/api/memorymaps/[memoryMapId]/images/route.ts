import { POST as uploadImage } from "../../../uploads/route";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ memoryMapId: string }> }) {
  const { memoryMapId } = await params;
  const incoming = await request.formData();
  const formData = new FormData();
  for (const [key, value] of incoming.entries()) formData.append(key, value);
  formData.set("memoryMapId", memoryMapId);
  const forwarded = new Request(request.url, { method: "POST", headers: { authorization: request.headers.get("authorization") ?? "" }, body: formData });
  return uploadImage(forwarded);
}
