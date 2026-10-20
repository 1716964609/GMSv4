import { expect, test } from "@playwright/test";

const finalTranslation = "[mock-gpt] [mock-deepl] Hello from E2E";

test.describe("UC-001 browser workflow", () => {
  test("keeps Translate disabled for empty Original Text", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Translate" })).toBeDisabled();
  });

  test("translates EN to JA without a glossary and downloads the exact Final Translation", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Original Text").fill("Hello from E2E");
    await page.locator("select").nth(0).selectOption("EN");
    await page.locator("select").nth(1).selectOption("JA");
    await page.getByRole("button", { name: "Translate" }).click();

    await expect(page.getByRole("heading", { name: "Final Translation" })).toBeVisible();
    const displayed = page.locator(".result p");
    await expect(displayed).toHaveText(finalTranslation);
    await expect(page.getByText("Intermediate Translation")).toHaveCount(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download TXT" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("gms-translation.txt");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString("utf8")).toBe(finalTranslation);
  });

  test("uploads a valid JSON glossary and completes the workflow", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Original Text").fill("Hello from E2E");
    await page.getByLabel("Glossary JSON (optional)").setInputFiles({
      name: "glossary.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify([{
        source_term: "Hello",
        target_term: "こんにちは",
        source_lang: "EN",
        target_lang: "JA"
      }]))
    });

    await expect(page.getByRole("button", { name: "Translate" })).toBeEnabled();
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.locator(".result p")).toHaveText(finalTranslation);
  });

  test("shows an error and prevents submission for invalid Glossary JSON", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Original Text").fill("Hello from E2E");
    await page.getByLabel("Glossary JSON (optional)").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{invalid")
    });

    await expect(page.locator("p[role=alert]")).toHaveText("Glossary JSON is invalid.");
    await expect(page.getByRole("button", { name: "Translate" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Final Translation" })).toHaveCount(0);
  });

  test("does not display a new successful Final Translation after an unsuccessful request", async ({ page }) => {
    await page.route("**/api/translate", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Translation could not be completed." }) });
    });
    await page.goto("/");
    await page.getByLabel("Original Text").fill("Hello from E2E");
    await page.getByRole("button", { name: "Translate" }).click();

    await expect(page.locator("p[role=alert]")).toHaveText("Translation could not be completed.");
    await expect(page.getByRole("heading", { name: "Final Translation" })).toHaveCount(0);
    await expect(page.locator(".result p")).toHaveCount(0);
  });
});
