// Cloudflare Pages Function: /api/llm
// Proxies OpenAI-compatible Chat Completions to avoid browser CORS issues.
// The user's API key never leaves their browser permanently; it is sent
// per-request and used only to call the upstream provider.

export async function onRequestPost({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { base, key, model, messages, max_tokens, temperature } = payload || {};
  if (!base || !key || !model || !Array.isArray(messages)) {
    return json({ error: "Missing base/key/model/messages" }, 400);
  }

  const url = base.replace(/\/+$/, "") + "/chat/completions";
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: max_tokens ?? 4096,
        temperature: temperature ?? 0.5,
        stream: false,
      }),
    });
  } catch (e) {
    return json({ error: "Upstream fetch failed: " + e.message }, 502);
  }

  let data;
  const ct = upstream.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await upstream.json().catch(() => null);
  } else {
    const txt = await upstream.text();
    return json({ error: `Upstream non-JSON ${upstream.status}: ${txt.slice(0, 400)}` }, upstream.status || 502);
  }

  if (!upstream.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${upstream.status}`;
    return json({ error: msg, upstream: data }, upstream.status);
  }

  const text = data?.choices?.[0]?.message?.content ?? "";
  return json({ text, raw: data });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
