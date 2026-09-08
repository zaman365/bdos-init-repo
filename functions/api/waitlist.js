// POST /api/waitlist — stores a waitlist signup in the WAITLIST KV namespace.
// Degrades with a clear message if the binding isn't attached yet, so a
// missing binding can never take the landing page down.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const ROLES = ["viewer", "creator", "seller", "brand"];

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Couldn't read that. Try again." }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const role = String(payload.role || "").trim().toLowerCase();

  if (!EMAIL.test(email) || email.length > 254) {
    return json({ error: "That doesn't look like an email address." }, 400);
  }
  if (role && !ROLES.includes(role)) {
    return json({ error: "Pick one of the options." }, 400);
  }
  if (!env.WAITLIST) {
    return json({ error: "The waitlist isn't connected yet — try again shortly." }, 503);
  }

  const record = {
    email,
    role: role || null,
    at: new Date().toISOString(),
    country: request.headers.get("cf-ipcountry") || null,
  };

  try {
    // Key on the email so a repeat signup updates rather than duplicates.
    await env.WAITLIST.put(`signup:${email}`, JSON.stringify(record));
  } catch {
    return json({ error: "Couldn't save that. Try again." }, 500);
  }

  return json({ ok: true });
}

export function onRequestGet() {
  return json({ error: "Method not allowed." }, 405);
}
