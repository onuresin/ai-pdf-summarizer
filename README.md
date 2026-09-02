# 📄 AI PDF Analyzer

> Upload a PDF, get an instant structured analysis powered by Claude Haiku — executive summary, key findings, and action items in seconds.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss)
![Claude Haiku](https://img.shields.io/badge/Claude-Haiku%204.5-8B5CF6?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel)

---

## ✨ Features

- **Instant AI Analysis** — Structured output in 3 sections: Executive Summary, Key Findings, Action Items
- **Client-side PDF Parsing** — Text extracted in the browser via `pdfjs-dist` (no file upload to server)
- **Secure API Proxy** — Anthropic API key never exposed to the frontend (Vercel serverless function)
- **Dark / Light Mode** — Smooth theme toggle, persisted across sessions
- **TR / EN Language** — Full Turkish and English UI, persisted across sessions
- **Daily Usage Limit** — 3 analyses per day per user (localStorage guard) to control API costs
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Input Guardrails** — Max 5 MB, max 5 pages, max 15,000 characters (truncated gracefully)

---

## 🖥️ Screenshots

| Upload | Analysis Results |
|--------|-----------------|
| Dark upload screen with drag-and-drop zone | Results with sidebar metadata and 3 AI-generated cards |

> *Live demo: [ai-pdf-summarizer-lilac.vercel.app](https://ai-pdf-summarizer-lilac.vercel.app)*

---

## 🏗️ Architecture

```
Browser
  ├── React (Vite) — UI, state, drag-and-drop
  ├── pdfjs-dist  — PDF → plain text (client-side, no upload)
  └── fetch /api/summarize
          │
          ▼
  Vercel Serverless Function (api/summarize.js)
          │  ANTHROPIC_API_KEY (server-side only)
          ▼
  Anthropic Claude Haiku API
```

**Why this architecture?**
- API key stays on the server — never in the bundle
- Only plain text goes to the LLM — no base64/image tokens, minimal cost
- Serverless = zero cold-start cost, scales automatically

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- Vercel CLI (`npm i -g vercel`) for local development

### Local development

```bash
# 1. Clone
git clone https://github.com/onuresin/ai-pdf-summarizer.git
cd ai-pdf-summarizer

# 2. Install dependencies
npm install

# 3. Set environment variable
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 4. Start dev server (Vercel dev proxies the serverless function)
npx vercel dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key. Create a **"Not linked"** key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) to avoid the `anthropic-workspace-id` requirement. |

---

## 📦 Deploy to Vercel

```bash
# One-time setup
npx vercel

# Set the API key in production
npx vercel env add ANTHROPIC_API_KEY production

# Deploy
npx vercel --prod
```

Or connect your GitHub repo in the [Vercel dashboard](https://vercel.com/new) for automatic deploys on every push.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| PDF Parsing | pdfjs-dist 6 (client-side) |
| AI Model | Claude Haiku 4.5 (Anthropic) |
| API Proxy | Vercel Serverless Functions |
| Hosting | Vercel |

---

## 💰 Cost Estimate

With the 15,000 character (~3,500 token) input limit and 1,024 token max output:
- ~4,500 tokens per analysis
- Claude Haiku pricing: ~$0.001 per analysis
- 3 analyses/day/user limit keeps demo costs predictable

---

## 📁 Project Structure

```
ai-pdf-summarizer/
├── api/
│   └── summarize.js      # Vercel serverless — Anthropic API proxy
├── src/
│   ├── App.jsx            # Main React app (all UI logic)
│   └── index.css          # Tailwind + CSS theme tokens
├── public/
├── .env.local             # Local env (gitignored)
├── vercel.json            # Vercel config
└── vite.config.js
```

---

## 📄 License

MIT — feel free to fork and adapt for your own projects.

---

*Built with [Claude](https://claude.ai) · Powered by [Anthropic](https://anthropic.com)*
