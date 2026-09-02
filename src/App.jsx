import { useState, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Constants ────────────────────────────────────────────────────
const MAX_MB    = 5;
const MAX_PAGES = 5;
const MAX_CHARS = 15000;
const DAILY_LIMIT = 3;
const USAGE_KEY   = "pdf_analyzer_usage";
const THEME_KEY   = "pdf_analyzer_theme";
const LANG_KEY    = "pdf_analyzer_lang";

// ─── i18n ─────────────────────────────────────────────────────────
const TRANSLATIONS = {
  tr: {
    remainingOps:     "işlem hakkı kaldı",
    poweredBy:        "Claude Haiku 4.5 ile güçlendirildi",
    heroLine1:        "PDF'ini yükle,",
    heroLine2:        "anında analiz et",
    heroDesc:         "Belgeni yükle, yapay zeka saniyeler içinde özet, çıkarımlar ve eylem maddeleri çıkarsın.",
    dropText:         "PDF dosyanı buraya sürükle",
    orText:           "veya",
    browseText:       "dosya seç",
    analyzing:        "Analiz ediliyor…",
    analyzingDesc:    "Claude Haiku metni işliyor, bir saniye…",
    executiveSummary: "Yönetici Özeti",
    keyFindings:      "Önemli Çıkarımlar",
    actionItems:      "Eylem Maddeleri",
    pages:            "Sayfa",
    chars:            "Karakter",
    duration:         "Süre",
    newPDF:           "Yeni PDF",
    noContent:        "İçerik bulunamadı",
    errLimit:         "Günlük işlem hakkınız doldu. Yarın tekrar deneyin.",
    errSize:          "Dosya boyutu 5 MB'ı geçemez.",
    errType:          "Lütfen geçerli bir PDF dosyası seçin.",
    errApi:           "Analiz sırasında bir hata oluştu. Tekrar deneyin.",
    truncated:        "(kırpıldı)",
    lightMode:        "Açık tema",
    darkMode:         "Koyu tema",
  },
  en: {
    remainingOps:     "operations left today",
    poweredBy:        "Powered by Claude Haiku 4.5",
    heroLine1:        "Upload your PDF,",
    heroLine2:        "analyze instantly",
    heroDesc:         "Upload a document and let AI extract a summary, key insights, and action items in seconds.",
    dropText:         "Drag your PDF here",
    orText:           "or",
    browseText:       "browse files",
    analyzing:        "Analyzing…",
    analyzingDesc:    "Claude Haiku is processing the text, just a moment…",
    executiveSummary: "Executive Summary",
    keyFindings:      "Key Findings",
    actionItems:      "Action Items",
    pages:            "Pages",
    chars:            "Characters",
    duration:         "Duration",
    newPDF:           "New PDF",
    noContent:        "No content found",
    errLimit:         "Daily limit reached. Try again tomorrow.",
    errSize:          "File size cannot exceed 5 MB.",
    errType:          "Please select a valid PDF file.",
    errApi:           "An error occurred during analysis. Please try again.",
    truncated:        "(truncated)",
    lightMode:        "Light mode",
    darkMode:         "Dark mode",
  },
};

// ─── Daily-limit helpers ───────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);

function getUsage() {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}"); }
  catch { return {}; }
}
function getRemaining() {
  return Math.max(0, DAILY_LIMIT - (getUsage()[todayKey()] || 0));
}
function bumpUsage() {
  try {
    const d = getUsage();
    d[todayKey()] = (d[todayKey()] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(d));
  } catch {}
}

// ─── PDF extractor ─────────────────────────────────────────────────
async function extractPDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const pagesRead   = Math.min(totalPages, MAX_PAGES);
  let raw = "";
  for (let i = 1; i <= pagesRead; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    raw += `\n\n--- Page ${i} ---\n` + content.items.map(x => x.str).join(" ");
  }
  const truncated = raw.length > MAX_CHARS;
  return { text: raw.slice(0, MAX_CHARS), totalPages, pagesRead, charCount: Math.min(raw.length, MAX_CHARS), truncated };
}

// ─── Markdown section parser ───────────────────────────────────────
function parseSections(md) {
  const out = { summary: "", findings: [], actions: [] };
  const parts = md.split(/^##\s+/m);
  for (const part of parts) {
    const lines  = part.split("\n");
    const header = lines[0].toLowerCase();
    const body   = lines.slice(1).join("\n").trim();
    const bullets = body.split("\n")
      .filter(l => /^[-*•]|\d+\./.test(l.trim()))
      .map(l => l.replace(/^[-*•]\s*(\[.?\]\s*)?/, "").replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);
    if (header.includes("özeti") || header.includes("summary"))              out.summary  = body;
    else if (header.includes("çıkarım") || header.includes("finding") || header.includes("key")) out.findings = bullets;
    else if (header.includes("eylem")   || header.includes("action"))       out.actions  = bullets;
  }
  if (!out.summary && !out.findings.length && !out.actions.length) out.summary = md;
  return out;
}

// ─── Icon helpers ──────────────────────────────────────────────────
const Icon = ({ d, size = 16, color = "currentColor", sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);

// ─── Header ───────────────────────────────────────────────────────
function Header({ remaining, lang, setLang, theme, toggleTheme, t }) {
  return (
    <header style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 48px", height:64, flexShrink:0, position:"relative", zIndex:1,
      borderBottom:"1px solid var(--border-subtle)",
    }}>
      {/* Logo */}
      <div style={{display:"flex", alignItems:"center", gap:10}}>
        <div style={{width:32,height:32,background:"linear-gradient(135deg,#7c3aed,#4f46e5)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <span style={{fontSize:15,fontWeight:600,color:"var(--text-primary)",letterSpacing:"-0.3px"}}>PDF Analyzer</span>
      </div>

      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {/* Lang toggle */}
        <button onClick={() => setLang(lang === "tr" ? "en" : "tr")}
          style={{display:"flex",alignItems:"center",gap:6,background:"var(--bg-card)",border:"1px solid var(--border-subtle)",borderRadius:20,padding:"5px 14px",cursor:"pointer",color:"var(--text-primary)",fontSize:12,fontWeight:500,transition:"all 0.15s"}}>
          🌐 {lang === "tr" ? "EN" : "TR"}
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme}
          title={theme === "dark" ? t.lightMode : t.darkMode}
          style={{width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-card)",border:"1px solid var(--border-subtle)",borderRadius:"50%",cursor:"pointer",color:"var(--text-primary)",transition:"all 0.15s"}}>
          {theme === "dark"
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>

        {/* Usage badge */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.18)",borderRadius:20,padding:"5px 14px"}}>
          <div style={{width:6,height:6,background:remaining > 0 ? "#10b981" : "#ef4444",borderRadius:"50%"}}/>
          <span style={{fontSize:12,color:"#a78bfa",fontWeight:500}}>{remaining} {t.remainingOps}</span>
        </div>
      </div>
    </header>
  );
}

// ─── Upload view ───────────────────────────────────────────────────
function UploadView({ onFile, remaining, error, t }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);

  const drop = useCallback(e => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);

  return (
    <main className="main-pad fade-in" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:48,position:"relative",zIndex:1}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:44,width:"100%",maxWidth:640}}>

        {/* Hero */}
        <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:20,padding:"6px 16px"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span style={{fontSize:12,color:"#a78bfa",fontWeight:500}}>{t.poweredBy}</span>
          </div>
          <h1 className="hero-title" style={{fontSize:52,fontWeight:700,color:"var(--text-primary)",letterSpacing:"-1.5px",lineHeight:1.08}}>
            {t.heroLine1}<br/>
            <span style={{background:"linear-gradient(135deg,#a78bfa 0%,#60a5fa 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              {t.heroLine2}
            </span>
          </h1>
          <p style={{fontSize:16,color:"var(--text-secondary)",maxWidth:420,lineHeight:1.65}}>{t.heroDesc}</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{width:"100%",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:12,padding:"13px 18px",display:"flex",alignItems:"center",gap:10}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{fontSize:13,color:"#ef4444"}}>{error}</span>
          </div>
        )}

        {/* Drop zone */}
        <div className="upload-zone"
          onClick={() => remaining > 0 && ref.current?.click()}
          onDrop={remaining > 0 ? drop : undefined}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          style={{
            width:"100%",
            border:`1.5px dashed ${drag ? "#a78bfa" : "rgba(139,92,246,0.3)"}`,
            borderRadius:20, padding:"56px 48px",
            display:"flex",flexDirection:"column",alignItems:"center",gap:20,
            background: drag ? "rgba(139,92,246,0.07)" : "rgba(139,92,246,0.03)",
            cursor: remaining > 0 ? "pointer" : "not-allowed",
            opacity: remaining === 0 ? 0.5 : 1,
            transition:"all 0.2s ease",
          }}>
          <div style={{width:68,height:68,background:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
          <div style={{textAlign:"center",display:"flex",flexDirection:"column",gap:8}}>
            <p style={{fontSize:16,fontWeight:500,color:"var(--text-primary)"}}>{t.dropText}</p>
            <p style={{fontSize:14,color:"var(--text-secondary)"}}>{t.orText} <span style={{color:"#a78bfa",fontWeight:500}}>{t.browseText}</span></p>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginTop:4}}>
            {[`Max ${MAX_MB} MB`,`Max ${MAX_PAGES} pages`,".pdf only"].map(tag => (
              <span key={tag} style={{fontSize:11,color:"#4a4a6a",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"4px 12px"}}>{tag}</span>
            ))}
          </div>
        </div>
        <input ref={ref} type="file" accept="application/pdf" style={{display:"none"}}
          onChange={e => { const f = e.target.files[0]; if (f) onFile(f); e.target.value=""; }}/>
      </div>
    </main>
  );
}

// ─── Loading view ──────────────────────────────────────────────────
function LoadingView({ fileName, t }) {
  return (
    <main style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:48,position:"relative",zIndex:1}}>
      <div className="fade-in" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:32,textAlign:"center"}}>
        <div style={{position:"relative",width:80,height:80}}>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(139,92,246,0.12)"}}/>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",borderTopColor:"#a78bfa",animation:"spin 0.85s linear infinite"}}/>
          <div style={{position:"absolute",inset:10,background:"rgba(139,92,246,0.08)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <h2 style={{fontSize:22,fontWeight:600,color:"var(--text-primary)"}}>{t.analyzing}</h2>
          <p style={{fontSize:14,color:"var(--text-secondary)",maxWidth:300}}>{fileName}</p>
          <p style={{fontSize:13,color:"#4a4a6a"}}>{t.analyzingDesc}</p>
        </div>
      </div>
    </main>
  );
}

// ─── Results view ──────────────────────────────────────────────────
function ResultsView({ result, meta, onReset, t }) {
  const s = parseSections(result);
  const cards = [
    {
      title: t.executiveSummary,
      iconBg: "rgba(99,102,241,0.12)",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      content: <p style={{fontSize:14,color:"var(--text-secondary)",lineHeight:1.8}}>{s.summary || t.noContent}</p>,
    },
    {
      title: t.keyFindings,
      iconBg: "rgba(139,92,246,0.12)",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      content: (
        <ul style={{display:"flex",flexDirection:"column",gap:10}}>
          {(s.findings.length ? s.findings : [t.noContent]).map((item,i) => (
            <li key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:3,minHeight:18,borderRadius:2,background:"rgba(167,139,250,0.5)",flexShrink:0,alignSelf:"stretch"}}/>
              <span style={{fontSize:14,color:"var(--text-secondary)",lineHeight:1.65}}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: t.actionItems,
      iconBg: "rgba(16,185,129,0.12)",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
      content: (
        <ul style={{display:"flex",flexDirection:"column",gap:10}}>
          {(s.actions.length ? s.actions : [t.noContent]).map((item,i) => (
            <li key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:18,height:18,borderRadius:5,border:"1.5px solid rgba(52,211,153,0.4)",background:"rgba(16,185,129,0.06)",flexShrink:0,marginTop:1}}/>
              <span style={{fontSize:14,color:"var(--text-secondary)",lineHeight:1.65}}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <main className="results-layout fade-in" style={{flex:1,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>

      {/* Sidebar */}
      <aside className="results-sidebar" style={{width:300,flexShrink:0,borderRight:"1px solid var(--border-subtle)",padding:"28px 20px",display:"flex",flexDirection:"column",gap:16,overflowY:"auto"}}>
        {/* File card */}
        <div style={{background:"var(--bg-card)",border:"1px solid var(--border-subtle)",borderRadius:14,padding:"16px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,background:"rgba(139,92,246,0.1)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:500,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{meta.fileName}</p>
              <p style={{fontSize:11,color:"var(--text-secondary)",marginTop:2}}>{(meta.fileSize/1024/1024).toFixed(2)} MB</p>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              [t.pages,    `${meta.pagesRead}/${meta.totalPages}`],
              [t.chars,    `${meta.charCount.toLocaleString()}${meta.truncated?" "+t.truncated:""}`],
              [t.duration, `${meta.duration}s`],
            ].map(([label,val]) => (
              <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"var(--text-secondary)"}}>{label}</span>
                <span style={{fontSize:12,color:"var(--text-primary)",fontWeight:500}}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model badge */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.14)",borderRadius:10,padding:"10px 14px"}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span style={{fontSize:12,color:"#a78bfa",fontWeight:500}}>Claude Haiku 4.5</span>
        </div>

        {/* New PDF */}
        <button onClick={onReset}
          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(139,92,246,0.09)",border:"1px solid rgba(139,92,246,0.22)",borderRadius:10,padding:"11px 0",cursor:"pointer",color:"#a78bfa",fontSize:13,fontWeight:500,transition:"all 0.15s",width:"100%"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(139,92,246,0.17)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(139,92,246,0.09)"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.01"/></svg>
          {t.newPDF}
        </button>
      </aside>

      {/* Cards */}
      <div className="results-pad" style={{flex:1,padding:"28px 36px",overflowY:"auto",display:"flex",flexDirection:"column",gap:18}}>
        {cards.map(card => (
          <div key={card.title} style={{background:"var(--bg-card)",border:"1px solid var(--border-subtle)",borderRadius:16,padding:"20px 22px",display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,background:card.iconBg,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {card.icon}
              </div>
              <h3 style={{fontSize:14,fontWeight:600,color:"var(--text-primary)"}}>{card.title}</h3>
            </div>
            {card.content}
          </div>
        ))}
      </div>
    </main>
  );
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
  const [view,      setView]      = useState("upload");
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);
  const [meta,      setMeta]      = useState(null);
  const [remaining, setRemaining] = useState(getRemaining);
  const [lang,      setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || "tr"; } catch { return "tr"; }
  });
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
  });

  const t = TRANSLATIONS[lang];

  // Apply theme to <html>
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }

  function setLang(l) {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }

  async function handleFile(file) {
    setError(null);
    if (remaining <= 0)                            { setError(t.errLimit); return; }
    if (!file.type.includes("pdf"))                { setError(t.errType);  return; }
    if (file.size > MAX_MB * 1024 * 1024)          { setError(t.errSize);  return; }

    setView("loading");
    const t0 = Date.now();
    try {
      const { text, totalPages, pagesRead, charCount, truncated } = await extractPDF(file);

      const res = await fetch("/api/summarize", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const duration = ((Date.now() - t0) / 1000).toFixed(1);

      bumpUsage();
      setRemaining(getRemaining());
      setResult(data.summary);
      setMeta({ fileName: file.name, fileSize: file.size, totalPages, pagesRead, charCount, truncated, duration });
      setView("results");
    } catch (err) {
      setError(err.message || t.errApi);
      setView("upload");
    }
  }

  function reset() { setView("upload"); setResult(null); setMeta(null); setError(null); }

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      {/* Ambient glow */}
      <div style={{position:"absolute",top:-120,left:"50%",transform:"translateX(-50%)",width:600,height:600,background:"radial-gradient(ellipse,var(--glow) 0%,transparent 70%)",pointerEvents:"none"}}/>

      <Header remaining={remaining} lang={lang} setLang={setLang} theme={theme} toggleTheme={toggleTheme} t={t}/>

      {view === "upload"  && <UploadView  onFile={handleFile} remaining={remaining} error={error} t={t}/>}
      {view === "loading" && <LoadingView fileName={meta?.fileName || ""} t={t}/>}
      {view === "results" && <ResultsView result={result} meta={meta} onReset={reset} t={t}/>}
    </div>
  );
}
