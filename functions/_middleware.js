// Password gate for /blueprint.
//
// Runs on every request; everything outside /blueprint passes straight through.
//
// FAILS CLOSED: if BLUEPRINT_PASSWORD is not set on the Pages project, the
// route returns 503 instead of the document. So the blueprint can never be
// served unprotected, even before the secret exists or if it is later removed.
//
// Set the secret at:
//   Workers & Pages -> bdos -> Settings -> Variables and secrets
//   Type "Secret", name BLUEPRINT_PASSWORD
// Pages applies secrets on the NEXT deployment, so redeploy after saving.

const REALM = 'Basic realm="BDOS blueprint", charset="UTF-8"';

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.byteLength !== bb.byteLength) return false;
  if (crypto?.subtle?.timingSafeEqual) {
    return crypto.subtle.timingSafeEqual(ab, bb);
  }
  let diff = 0;
  for (let i = 0; i < ab.byteLength; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function challenge() {
  return new Response("Password required.", {
    status: 401,
    headers: {
      "www-authenticate": REALM,
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;

  const path = new URL(request.url).pathname.toLowerCase();
  if (!path.startsWith("/blueprint")) return next();

  if (!env.BLUEPRINT_PASSWORD) {
    return new Response(
      "This page isn't available yet.\n\n" +
      "Set BLUEPRINT_PASSWORD on the Pages project, then redeploy.\n",
      {
        status: 503,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
      }
    );
  }

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return challenge();

  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return challenge();
  }

  const sep = decoded.indexOf(":");
  const supplied = sep === -1 ? "" : decoded.slice(sep + 1);
  if (!timingSafeEqual(supplied, env.BLUEPRINT_PASSWORD)) return challenge();

  const upstream = await next();
  const res = new Response(upstream.body, upstream);
  res.headers.set("cache-control", "no-store, private");
  res.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return res;
}
