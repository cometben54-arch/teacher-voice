import { initSettingsModal, loadSettings } from "./settings.js";
import { populateVoiceSelect } from "./voices.js";

const $ = (id) => document.getElementById(id);

const state = {
  fileName: "",
  rawText: "",
  lectureText: "",
  audioBlob: null,
};

initSettingsModal();
populateVoiceSelect($("voice"), $("lang").value);

$("lang").addEventListener("change", () => {
  populateVoiceSelect($("voice"), $("lang").value);
});

// --- Freedom slider ---
$("freedom").addEventListener("input", (e) => {
  $("freedom-val").textContent = e.target.value + "%";
});

// --- File input / drag-drop ---
const dz = $("dropzone");
$("pick-file").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
;["dragenter", "dragover"].forEach(ev =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
;["dragleave", "drop"].forEach(ev =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
dz.addEventListener("drop", (e) => {
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  state.fileName = file.name;
  $("file-name").textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  setStatus("正在解析文件 ...");
  try {
    const ext = file.name.toLowerCase().split(".").pop();
    let text = "";
    if (ext === "pdf" || file.type === "application/pdf") {
      text = await extractPdfText(file);
    } else {
      text = await file.text();
    }
    state.rawText = text;
    $("extracted-text").value = text;
    setStatus(`已提取 ${text.length} 字符`, "ok");
  } catch (e) {
    setStatus("文件解析失败: " + e.message, "error");
  }
}

async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  // wait for pdfjsLib if module hasn't finished loading
  for (let i = 0; i < 20 && !window.pdfjsLib; i++) await new Promise(r => setTimeout(r, 100));
  if (!window.pdfjsLib) throw new Error("pdf.js 未加载");
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(" ");
    out += pageText + "\n\n";
    setStatus(`PDF 解析中 ${p}/${pdf.numPages}`);
  }
  return out.trim();
}

// --- Generate explanation ---
// Maximum characters per LLM call to stay within typical context/response windows.
const LLM_INPUT_CHARS = 6000;

$("btn-explain").addEventListener("click", async () => {
  const text = ($("extracted-text").value || state.rawText || "").trim();
  if (!text) { setStatus("请先上传或粘贴文本", "error"); return; }

  const s = loadSettings();
  if (!s.llm.key || !s.llm.base || !s.llm.model) {
    setStatus("请先在设置中填写 LLM API 信息", "error");
    return;
  }

  const freedom = parseInt($("freedom").value, 10);
  const lang = $("lang").value;
  const sysPrompt = buildSystemPrompt(freedom, lang, s.llm.sysprompt);
  const inputChunks = chunkText(text, LLM_INPUT_CHARS);

  $("btn-explain").disabled = true;
  $("btn-tts").disabled = true;
  $("lecture-text").value = "";
  showProgress(true, 0);
  setStatus(`正在生成讲解稿 0/${inputChunks.length} ...`);

  const outputs = [];
  try {
    for (let i = 0; i < inputChunks.length; i++) {
      const partNote = inputChunks.length > 1
        ? `（这是第 ${i + 1} / ${inputChunks.length} 段。请继续之前的讲解风格，不要重复引言和结束语。）\n\n`
        : "";
      const r = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: s.llm.base, key: s.llm.key, model: s.llm.model,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: partNote + buildUserPrompt(inputChunks[i], freedom, lang) },
          ],
          max_tokens: 4096,
          temperature: 0.2 + (freedom / 100) * 0.8,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      outputs.push((data.text || "").trim());
      $("lecture-text").value = outputs.join("\n\n");
      showProgress(true, Math.round(((i + 1) / inputChunks.length) * 100));
      setStatus(`讲解稿生成中 ${i + 1}/${inputChunks.length}`);
    }
    state.lectureText = outputs.join("\n\n").trim();
    $("lecture-text").value = state.lectureText;
    showProgress(false);
    setStatus(`讲解稿生成完成 · ${state.lectureText.length} 字`, "ok");
    $("btn-tts").disabled = false;
  } catch (e) {
    showProgress(false);
    setStatus("生成失败: " + e.message, "error");
  } finally {
    $("btn-explain").disabled = false;
  }
});

function buildSystemPrompt(freedom, lang, extra) {
  const langMap = { zh: "简体中文（普通话口语）", en: "English (clear spoken style)", ja: "日本語（自然な話し言葉）" };
  const target = langMap[lang] || langMap.zh;
  const tone =
    freedom <= 5 ? "严格朗读，不做任何添加、删减、改写、解释和总结。完全保留原文的所有数学公式与符号。" :
    freedom <= 30 ? "几乎严格按原文朗读，只在必要处稍微调整断句，使其更适合 TTS 朗读，不增加新的内容。" :
    freedom <= 60 ? "在保留原意的前提下，对术语与公式做简短的口语化解释，可适度补充例子。" :
    freedom <= 85 ? "以原文为骨架，自由扩展讲解，加入背景、类比、过渡句，让听者更易理解。" :
                    "以原文为出发点，进行充分的口语化讲解、类比、补充背景与延伸，但不得偏离主题。";

  return [
    `你是一位资深教师/讲解员，正在把材料转写成${target}的口播讲解稿。`,
    `自由度: ${freedom}/100。${tone}`,
    `**朗读友好规则**：`,
    `- 输出纯文本，不要使用 Markdown 标记 (#, *, \`, |, --- 等)。`,
    `- 所有数学/物理 LaTeX 公式必须改写成口语化的中文/英文读法。例如 $E=mc^2$ 读作 "E 等于 m c 平方"；\\frac{a}{b} 读作 "b 分之 a"；\\int_0^1 f(x)dx 读作 "f x 在 0 到 1 上的定积分"。`,
    `- 单位与符号也要展开朗读，例如 m/s 读作 "米每秒"。`,
    `- 段落之间用空行分隔，便于断句。`,
    extra ? `\n附加要求：${extra}` : "",
  ].join("\n");
}

function buildUserPrompt(text, freedom, lang) {
  return [
    `下面是原始材料（可能包含 LaTeX 数学/物理公式）。请按上述规则生成最终用于 TTS 朗读的纯文本讲解稿，自由度 = ${freedom}%。`,
    `直接输出讲解稿正文，不要前言、不要解释、不要使用 Markdown。`,
    "",
    "===== 原始材料开始 =====",
    text,
    "===== 原始材料结束 =====",
  ].join("\n");
}

// --- TTS ---
$("btn-tts").addEventListener("click", async () => {
  const text = ($("lecture-text").value || state.lectureText || "").trim();
  if (!text) { setStatus("讲解稿为空", "error"); return; }

  const s = loadSettings();
  if (!s.minimax.key || !s.minimax.group) {
    setStatus("请先在设置中填写 MiniMax Group ID 与 API Key", "error");
    return;
  }

  const voice = $("voice").value;
  const speed = parseFloat($("speed").value) || 1.0;
  const vol = parseFloat($("volume").value) || 1.0;
  const chunkChars = s.perf.chunkChars;
  const chunks = chunkText(text, chunkChars);

  $("btn-tts").disabled = true;
  $("btn-download").disabled = true;
  $("audio-player").hidden = true;
  showProgress(true, 0);
  setStatus(`分段合成中 0/${chunks.length}`);

  const blobs = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: s.minimax.group, key: s.minimax.key,
          model: s.minimax.model, region: s.minimax.region,
          text: chunks[i],
          voice, speed, vol,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      blobs.push(await r.blob());
      const pct = Math.round(((i + 1) / chunks.length) * 100);
      showProgress(true, pct);
      setStatus(`分段合成中 ${i + 1}/${chunks.length}`);
    }
    const merged = new Blob(blobs, { type: "audio/mpeg" });
    state.audioBlob = merged;
    const url = URL.createObjectURL(merged);
    const audio = $("audio-player");
    audio.src = url;
    audio.hidden = false;
    $("btn-download").disabled = false;
    showProgress(false);
    setStatus(`合成完成 · ${(merged.size / 1024).toFixed(1)} KB`, "ok");
  } catch (e) {
    showProgress(false);
    setStatus("TTS 失败: " + e.message, "error");
  } finally {
    $("btn-tts").disabled = false;
  }
});

$("btn-download").addEventListener("click", () => {
  if (!state.audioBlob) return;
  const a = document.createElement("a");
  const base = (state.fileName || "lecture").replace(/\.[^.]+$/, "");
  a.href = URL.createObjectURL(state.audioBlob);
  a.download = `${base}-讲解.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// --- Helpers ---
function chunkText(text, maxChars) {
  // Split on paragraph boundaries first, then sentences, keep chunks <= maxChars.
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let cur = "";
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ""; };
  for (const p of paragraphs) {
    if ((cur + "\n\n" + p).length <= maxChars) {
      cur = cur ? cur + "\n\n" + p : p;
    } else {
      flush();
      if (p.length <= maxChars) {
        cur = p;
      } else {
        // Split long paragraph on sentence boundaries
        const sentences = p.split(/(?<=[。！？.!?；;])/);
        for (const sen of sentences) {
          if ((cur + sen).length > maxChars) { flush(); }
          cur += sen;
          if (cur.length >= maxChars) flush();
        }
      }
    }
  }
  flush();
  return chunks.length ? chunks : [text];
}

function showProgress(visible, value) {
  const p = $("progress");
  p.hidden = !visible;
  if (typeof value === "number") p.value = value;
}

function setStatus(msg, kind) {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}
