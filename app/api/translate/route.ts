import { NextResponse } from "next/server";
import { parseGlossaryJson } from "../../../src/modules/glossary/validation";
import { createRuntimeTranslationService } from "../../../src/modules/translation/runtime";

function requiredText(value: FormDataEntryValue | null, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sourceText = requiredText(formData.get("sourceText"), "Original Text");
    const sourceLang = requiredText(formData.get("sourceLang"), "Source language");
    const targetLang = requiredText(formData.get("targetLang"), "Target language");
    const glossaryFile = formData.get("glossary");
    const glossaryUploaded = glossaryFile instanceof File;
    const glossary = glossaryUploaded
      ? parseGlossaryJson(JSON.parse(await glossaryFile.text()))
      : [];

    const result = await createRuntimeTranslationService().translate({
      sourceText,
      sourceLang,
      targetLang,
      glossary,
      glossaryUploaded
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    const safeMessage = message.includes("required") || message.includes("Glossary")
      ? message
      : "Translation could not be completed.";
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }
}
