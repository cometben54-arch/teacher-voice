// Settings: persist to localStorage, expose getters/setters & modal wiring.
const KEY = "teacher-voice.settings.v1";

const DEFAULTS = {
  llm: {
    base: "https://api.openai.com/v1",
    key: "",
    model: "gpt-4o-mini",
    sysprompt: "",
  },
  minimax: {
    group: "",
    key: "",
    model: "speech-02-hd",
    region: "global", // global | cn
  },
  perf: {
    chunkChars: 1500,
  },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      llm: { ...DEFAULTS.llm, ...(parsed.llm || {}) },
      minimax: { ...DEFAULTS.minimax, ...(parsed.minimax || {}) },
      perf: { ...DEFAULTS.perf, ...(parsed.perf || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function $(id) { return document.getElementById(id); }

export function initSettingsModal() {
  const modal = $("settings-modal");
  const open = $("open-settings");
  const close = $("close-settings");
  const status = $("cfg-status");

  open.addEventListener("click", () => {
    fillForm(loadSettings());
    modal.hidden = false;
  });
  close.addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  $("cfg-save").addEventListener("click", () => {
    const s = readForm();
    saveSettings(s);
    setStatus(status, "已保存", "ok");
    document.dispatchEvent(new CustomEvent("settings-changed", { detail: s }));
  });

  $("cfg-test-llm").addEventListener("click", async () => {
    const s = readForm();
    saveSettings(s);
    setStatus(status, "正在测试 LLM ...");
    try {
      const r = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: s.llm.base, key: s.llm.key, model: s.llm.model,
          messages: [{ role: "user", content: "回复一个字: OK" }],
          max_tokens: 8,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setStatus(status, "LLM OK: " + (data.text || "").slice(0, 40), "ok");
    } catch (e) {
      setStatus(status, "LLM 失败: " + e.message, "error");
    }
  });

  $("cfg-test-tts").addEventListener("click", async () => {
    const s = readForm();
    saveSettings(s);
    setStatus(status, "正在测试 TTS ...");
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: s.minimax.group, key: s.minimax.key,
          model: s.minimax.model, region: s.minimax.region,
          text: "测试语音合成，hello world.",
          voice: "female-shaonv",
          speed: 1.0, vol: 1.0,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      setStatus(status, `TTS OK · ${(blob.size / 1024).toFixed(1)} KB`, "ok");
    } catch (e) {
      setStatus(status, "TTS 失败: " + e.message, "error");
    }
  });
}

function fillForm(s) {
  $("cfg-llm-base").value = s.llm.base;
  $("cfg-llm-key").value = s.llm.key;
  $("cfg-llm-model").value = s.llm.model;
  $("cfg-llm-sysprompt").value = s.llm.sysprompt;
  $("cfg-mm-group").value = s.minimax.group;
  $("cfg-mm-key").value = s.minimax.key;
  $("cfg-mm-model").value = s.minimax.model;
  $("cfg-mm-region").value = s.minimax.region;
  $("cfg-chunk").value = s.perf.chunkChars;
}

function readForm() {
  return {
    llm: {
      base: $("cfg-llm-base").value.trim().replace(/\/+$/, ""),
      key: $("cfg-llm-key").value.trim(),
      model: $("cfg-llm-model").value.trim(),
      sysprompt: $("cfg-llm-sysprompt").value,
    },
    minimax: {
      group: $("cfg-mm-group").value.trim(),
      key: $("cfg-mm-key").value.trim(),
      model: $("cfg-mm-model").value,
      region: $("cfg-mm-region").value,
    },
    perf: {
      chunkChars: Math.max(200, Math.min(3000, parseInt($("cfg-chunk").value, 10) || 1500)),
    },
  };
}

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}
