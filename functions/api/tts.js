// Cloudflare Pages Function: /api/tts
// Proxies MiniMax T2A v2 (https://platform.minimaxi.com/document/T2A%20V2)
// Returns raw audio/mpeg bytes for the browser to assemble into MP3.

const HOSTS = {
  global: "https://api.minimax.io",
  cn: "https://api.minimaxi.com",
};

export async function onRequestPost({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  const {
    group, key, model = "speech-02-hd", region = "global",
    text, voice = "female-shaonv", speed = 1.0, vol = 1.0, pitch = 0,
  } = payload || {};

  if (!group || !key || !text) {
    return jsonErr("Missing group/key/text", 400);
  }

  const host = HOSTS[region] || HOSTS.global;
  const url = `${host}/v1/t2a_v2?GroupId=${encodeURIComponent(group)}`;

  const body = {
    model,
    text,
    stream: false,
    voice_setting: {
      voice_id: voice,
      speed: clamp(speed, 0.5, 2),
      vol: clamp(vol, 0.1, 10),
      pitch: clamp(pitch, -12, 12),
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1,
    },
  };

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return jsonErr("Upstream fetch failed: " + e.message, 502);
  }

  // MiniMax always replies with JSON (even for audio - audio is hex inside data.audio)
  const data = await upstream.json().catch(() => null);
  if (!data) return jsonErr(`Upstream returned non-JSON (HTTP ${upstream.status})`, 502);

  const baseResp = data.base_resp || {};
  if (baseResp.status_code && baseResp.status_code !== 0) {
    return jsonErr(`MiniMax error ${baseResp.status_code}: ${baseResp.status_msg || "unknown"}`, 400);
  }

  const hex = data?.data?.audio;
  if (!hex || typeof hex !== "string") {
    return jsonErr("Upstream returned no audio: " + JSON.stringify(data).slice(0, 400), 502);
  }

  const bytes = hexToBytes(hex);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

function clamp(n, lo, hi) {
  n = Number(n);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function hexToBytes(hex) {
  if (hex.length % 2) hex = "0" + hex;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function jsonErr(error, status = 500) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
