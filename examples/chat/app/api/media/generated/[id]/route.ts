import { NextResponse } from "next/server";
import { bufferToArrayBuffer, getGeneratedImage } from "@/lib/generated-image-cache";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const image = await getGeneratedImage(id);

  if (!image) {
    return NextResponse.json({ error: "Generated image expired or not found" }, { status: 404 });
  }

  return new NextResponse(bufferToArrayBuffer(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=1800",
      "Content-Length": String(image.buffer.length),
    },
  });
}
