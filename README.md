# Teacher Voice 📖🎙️

把 PDF / TeX 教材一键转成「老师讲解 + 朗读 MP3」的纯前端工具，部署在 **Cloudflare Pages**。

- 上传 **PDF / TeX / TXT**，自动提取文本（pdf.js）
- 一根「自由度滑杆 0–100%」决定 AI 是 *严格朗读* 还是 *自由发挥讲解*
- 文本分析：任何 **OpenAI 兼容** 的 LLM（自带数学/物理 LaTeX 口语化规则）
- 语音合成：**MiniMax T2A v2**，男声/女声/童声/英文音色全部下拉可选
- 一键导出 **MP3** 下载

所有 API 密钥仅保存在用户本地浏览器 `localStorage`，由 Cloudflare Pages Functions 仅做无状态代理转发，不落盘、不记录。

---

## 目录结构

```
.
├── index.html              # 单页应用
├── assets/
│   ├── style.css
│   ├── app.js              # 主流程：解析 → 调 LLM → 调 TTS → 下载
│   ├── settings.js         # 设置弹窗 + localStorage
│   └── voices.js           # MiniMax 音色清单
├── functions/
│   └── api/
│       ├── llm.js          # /api/llm  → OpenAI 兼容 chat completions 代理
│       └── tts.js          # /api/tts  → MiniMax t2a_v2 代理（hex → mp3）
├── _headers                # Cloudflare Pages 安全头
└── README.md
```

## 本地预览

需要 Node 18+：

```bash
npx wrangler pages dev . --port 8788
# 然后访问 http://localhost:8788
```

## 部署到 Cloudflare Pages

### 方式 A · Git 集成（推荐）

1. 推到 GitHub
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
3. 选择本仓库，**Build command 留空**，**Build output directory** 填 `/`
4. Save and Deploy

`functions/api/*.js` 会被自动识别为 Pages Functions，无需额外配置。

### 方式 B · 直接 Wrangler 部署

```bash
npx wrangler pages deploy . --project-name teacher-voice
```

## 使用步骤

1. 右上角 ⚙️ 打开「设置」
   - **LLM**：填 Base URL / API Key / 模型名（任意 OpenAI 兼容服务）
   - **MiniMax**：填 Group ID + API Key，选区域（国际版 / 国内版）和 TTS 模型
   - 点【测试 LLM】【测试 TTS】确认通畅
2. 主页面拖入 PDF / TeX
3. 拖动「自由度」滑杆决定老师讲多少
4. ① 生成讲解稿（可手工微调） → ② 合成语音 → 下载 MP3

## 自由度怎么映射

| 自由度 | 行为 |
|---|---|
| 0–5%  | **完全照念**原文，不增不减 |
| 6–30% | 仅做断句调整，便于 TTS |
| 31–60% | 保留原意，对术语/公式做简短口语化解释 |
| 61–85% | 以原文为骨架，自由扩展、加类比 |
| 86–100% | 充分讲解、补背景、举例延伸（不离题） |

LLM 的 `temperature` 也按 `0.2 + freedom*0.8/100` 线性挂钩。

## LaTeX 公式如何朗读

System Prompt 内置规则示例：
- `$E=mc^2$` → "E 等于 m c 平方"
- `\frac{a}{b}` → "b 分之 a"
- `\int_0^1 f(x)dx` → "f x 在 0 到 1 上的定积分"
- 单位 `m/s` → "米每秒"

如需更细调整，可在 ⚙️ 设置 → "System Prompt 附加" 中追加。

## MiniMax 音色

`assets/voices.js` 内置常用系统音色（可在文件中增删）。  
切换「讲解语言」会自动按语言过滤可用音色。

## 安全说明

- 用户的 API Key **仅存在浏览器 localStorage**，按需随请求体一起发给 `/api/*`
- Pages Functions 只做透传，不读不存
- Cloudflare Pages Functions 默认不写日志包含请求体；如担心可自建 Worker 用 `secret` 注入

## 许可

MIT — 见 `LICENSE`
