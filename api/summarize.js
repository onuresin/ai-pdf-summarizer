const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_CHARS = 15000;

const OUTPUT_FORMAT_INSTRUCTIONS = `
Yanıtını KESİNLİKLE aşağıdaki Markdown yapısında ver, başka hiçbir ekleme yapma:

## 1. Yönetici Özeti
(2-3 cümlelik üst düzey özet)

## 2. Önemli Çıkarımlar
- (madde madde, en fazla 6 madde)

## 3. Eylem Maddeleri
- (varsa somut, yapılabilir aksiyonlar; yoksa "Belirli bir eylem maddesi tespit edilmedi" yaz)
`.trim();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Sadece POST istekleri desteklenir." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY tanımlı değil.");
    return res.status(500).json({ error: "Sunucu yapılandırma hatası." });
  }

  const { text } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Özetlenecek metin boş olamaz." });
  }

  const safeText = text.slice(0, MAX_CHARS);
  const systemPrompt = `Sen profesyonel bir belge analistisin. Sana verilen metni analiz edip ${OUTPUT_FORMAT_INSTRUCTIONS}`;

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
        messages: [
          { role: "user", content: `Aşağıdaki belge metnini analiz et:\n\n---\n${safeText}\n---` },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("Anthropic API hatası:", response.status, errBody);
      return res.status(502).json({ error: "Yapay zeka servisinden yanıt alınamadı." });
    }

    const data = await response.json();
    const summary = data?.content
      ?.filter((block) => block.type === "text")
      ?.map((block) => block.text)
      ?.join("\n")
      ?.trim();

    if (!summary) {
      return res.status(502).json({ error: "Yapay zeka servisi boş yanıt döndürdü." });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    console.error("Beklenmeyen sunucu hatası:", err);
    return res.status(500).json({ error: "Beklenmeyen bir hata oluştu." });
  }
}