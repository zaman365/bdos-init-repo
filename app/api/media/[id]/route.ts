import { authenticate } from "../../../../lib/auth";
import { mediaResponse } from "../../../../lib/media";
import { failure } from "../../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await mediaResponse(
      await authenticate(request),
      (await params).id,
      request,
    );
  } catch (e) {
    return failure(e);
  }
}
