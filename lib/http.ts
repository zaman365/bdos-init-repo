import { ZodError } from "zod";
import { AppError, need, sandbox } from "./db";
export function origin(request: Request) {
  need(
    sandbox() || process.env.APP_ORIGIN?.startsWith("https:"),
    "APP_ORIGIN must use HTTPS outside the sandbox",
    503,
  );
  const incoming = request.headers.get("origin");
  const allowed = process.env.APP_ORIGIN ?? "http://localhost:3000";
  need(incoming === allowed, "Request origin is not allowed", 403);
  need(
    request.headers.get("sec-fetch-site") !== "cross-site",
    "Cross-site requests are not allowed",
    403,
  );
}
export function failure(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "Request must contain valid JSON" },
      { status: 400 },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return Response.json(
      { error: "This already exists. Refresh to see its current status." },
      { status: 409 },
    );
  if (["23503", "23514", "22P02"].includes(code ?? ""))
    return Response.json(
      { error: "Invalid record or value. Refresh and try again." },
      { status: 400 },
    );
  console.error("[bdos]", error instanceof Error ? error.message : error);
  return Response.json(
    {
      error:
        "The operation could not finish. Please retry. If it persists, contact operations.",
    },
    { status: 500 },
  );
}

// Bound bytes before buffering, including chunked requests without Content-Length.
export async function readBody(
  request: Request,
  limit = 100000,
): Promise<string> {
  need(
    Number(request.headers.get("content-length") ?? 0) <= limit,
    "Request too large",
    413,
  );
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      need(false, "Request too large", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
