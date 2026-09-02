const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_CHARS = 15000;

const FORMAT = {
  tr: `
Yanıtını KESİNLİKLE aşağıdaki Markdown yapısında ver, başka hiçbir ekleme yapma:

## 1. Yönetici Özeti
(2-3 cümlelik üst düzey özet)

## 2. Önemli Çıkarımlar
- (madde madde, en fazla 6 madde)

## 3. Eylem Maddeleri
- (varsa somut, yapılabilir aksiyonlar; yoksa "Belirli bir eylem maddesi tespit edilmedi" yaz)
`.trim(),

  en: `
Reply in EXACTLY this Markdown structure, no additional text:

## 1. Executive Summary
(2-3 sentence high-level summary)

## 2. Key Findings
- (bullet points, max 6 items)

## 3. Action Items
- (concrete, actionable steps if any; if none, write "No specific action items identified")
`.trim(),
};

const SYSTEM = {
  tr: "Sen profesyonel bir belge analistisin.",
  en: "You are a professional document analyst.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Only POST requests are supported." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server configuration error." });
  }

  const { text, lang = "en" } = req.body || {};
  const language = lang === "tr" ? "tr" : "en";

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Text cannot be empty." });
  }

  const safeText = text.slice(0, MAX_CHARS);
  const systemPrompt = `${SYSTEM[language]} ${FORMAT[language]}`;
  const userMsg = language === "tr"
    ? `Aşağıdaki belge metnini analiz et:\n\n---\n${safeText}\n---`
    : `Analyze the following document text:\n\n---\n${safeText}\n---`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("Anthropic API error:", response.status, errBody);
      return res.status(502).json({ error: "AI service error." });
    }

    const data = await response.json();
    const summary = data?.content
      ?.filter((b) => b.type === "text")
      ?.map((b) => b.text)
      ?.join("\n")
      ?.trim();

    if (!summary) {
      return res.status(502).json({ error: "AI service returned empty response." });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
}
