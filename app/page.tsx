"use client";

import { FormEvent, useState } from "react";
import { parseGlossaryJson } from "../src/modules/glossary/validation";
import { downloadTranslation } from "../src/modules/presentation/download";

export default function HomePage() {
  const [sourceText, setSourceText] = useState("");
  const [sourceLang, setSourceLang] = useState("EN");
  const [targetLang, setTargetLang] = useState("JA");
  const [glossaryFile, setGlossaryFile] = useState<File | null>(null);
  const [glossaryError, setGlossaryError] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitTranslation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTranslation("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("sourceText", sourceText);
      formData.set("sourceLang", sourceLang);
      formData.set("targetLang", targetLang);
      if (glossaryFile) formData.set("glossary", glossaryFile);

      const response = await fetch("/api/translate", { method: "POST", body: formData });
      const body = await response.json() as { finalTranslation?: string; error?: string };
      if (!response.ok || !body.finalTranslation) {
        throw new Error(body.error ?? "Translation could not be completed.");
      }
      setTranslation(body.finalTranslation);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Translation could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function selectGlossaryFile(file: File | null) {
    setGlossaryFile(null);
    setGlossaryError("");
    if (!file) return;

    try {
      parseGlossaryJson(JSON.parse(await file.text()));
      setGlossaryFile(file);
    } catch (fileError) {
      setGlossaryError(fileError instanceof Error ? fileError.message : "Glossary JSON is invalid.");
    }
  }

  function handleDownloadTranslation() {
    downloadTranslation(translation);
  }

  return (
    <main className="page-shell">
      <section className="welcome-card" aria-labelledby="page-title">
        <p className="eyebrow">Glossary-Aware Translation</p>
        <h1 id="page-title">GMS v4</h1>
        <form onSubmit={submitTranslation}>
          <label htmlFor="source-text">Original Text</label>
          <textarea id="source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={8} />
          <div className="language-grid">
            <label>Source language<select value={sourceLang} onChange={(event) => setSourceLang(event.target.value)}><option>EN</option><option>JA</option><option>DE</option></select></label>
            <label>Target language<select value={targetLang} onChange={(event) => setTargetLang(event.target.value)}><option>JA</option><option>EN</option><option>DE</option></select></label>
          </div>
          <label htmlFor="glossary">Glossary JSON (optional)</label>
          <input id="glossary" type="file" accept="application/json,.json" onChange={(event) => void selectGlossaryFile(event.target.files?.[0] ?? null)} />
          {glossaryError && <p className="error" role="alert">{glossaryError}</p>}
          <button type="submit" disabled={sourceText.trim() === "" || glossaryError !== "" || isSubmitting}>{isSubmitting ? "Translating…" : "Translate"}</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        {translation && <section className="result" aria-labelledby="result-title"><h2 id="result-title">Final Translation</h2><p>{translation}</p><button type="button" onClick={handleDownloadTranslation}>Download TXT</button></section>}
      </section>
    </main>
  );
}
