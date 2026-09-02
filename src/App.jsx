import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const [text, setText] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    console.log("Toplam sayfa sayısı:", pdf.numPages);

    const page = await pdf.getPage(1); // sadece 1. sayfa
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");

    console.log("1. sayfa metni:", pageText);
    setText(pageText);
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>PDF Test</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <pre style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>{text}</pre>
    </div>
  );
}

export default App;