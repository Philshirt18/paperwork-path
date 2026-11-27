// The path a judge takes: demo traveller, circle, what if, why can't I,
// mark the way out done, list view, download/upload, start fresh.
// No API key is needed; the assistant shows its "switched off" state then.
import { expect, test, type Page } from "@playwright/test";

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A station on the map; its accessible name starts with the short name printed on it. */
const station = (page: Page, shortName: string) => page.getByRole("button", { name: new RegExp(`^${escape(shortName)}[:( ]`) });
const CERT = "EU citizen registration certificate (includes your NIE)";

/** The page must never be wider than the screen (no zoom-out, no sideways scroll). */
async function expectNoSideways(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth])).toEqual([width, width]);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/503|Service Unavailable/.test(m.text()) && errors.push(m.text()));
  (page as Page & { errors: string[] }).errors = errors;
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

test("demo: tour, circle, what if, why can't I, way out", async ({ page, isMobile }) => {
  // First visit: the tour opens on Lena's circle.
  const tour = page.getByRole("dialog", { name: "Lena is stuck in a circle." });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).toBeHidden();

  await expect(page.getByText("Lena", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Circle detected")).toBeVisible();

  // Circles: the official loop and the documented way out.
  await page.getByRole("tab", { name: /Circles/ }).click();
  await expect(page.getByText("Created by the official rules")).toBeVisible();
  await expect(page.getByText("The documented way out")).toBeVisible();

  // What if the EU certificate falls through?
  await page.getByRole("tab", { name: "What if…" }).click();
  if (isMobile) await page.getByRole("button", { name: "List", exact: true }).click();
  if (isMobile) await page.getByRole("button", { name: `Suppose this falls through: ${CERT}` }).click();
  else await station(page, "EU registration certificate").click();
  await expect(page.getByText("If this falls through")).toBeVisible();
  await expect(page.getByRole("heading", { name: CERT })).toBeVisible();

  // Why can't I register as self-employed?
  await page.getByRole("tab", { name: "Why can't I…" }).click();
  await page.getByRole("button", { name: "Self-employed registration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Register as self-employed with Social Security (RETA)?" })).toBeVisible();

  // "How we know" shows the Cypher.
  await page.getByText("How we know").first().click();
  await expect(page.getByText("Cypher, run on Relate in your browser").first()).toBeVisible();
  await expectNoSideways(page); // long Cypher lines once widened the whole page on phones

  // Take the way out: the circle alert turns into "Way out taken".
  await page.getByRole("button", { name: /Mark NIE number .* as done/ }).click();
  await expect(page.getByText("You're out of the circle.")).toBeVisible();
  await expectNoSideways(page);
});

test("plan: download, bad upload, start fresh", async ({ page }) => {
  await page.getByRole("button", { name: "Skip tour" }).click();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download plan" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.cypher$/);

  await page.getByLabel("Upload a plan file").setInputFiles({
    name: "not-a-plan.cypher", mimeType: "text/plain", buffer: Buffer.from("MATCH (n) DETACH DELETE n"),
  });
  await expect(page.getByRole("status").filter({ hasText: /plan file/i })).toBeVisible();
  await expect(page.getByText("Circle detected")).toBeVisible(); // nothing was deleted

  await page.getByRole("button", { name: "Start fresh" }).click();
  await page.getByRole("button", { name: /^Employee/ }).click();
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show demo (Lena)" })).toBeVisible();

  // The plan survives a reload.
  await page.reload();
  await expect(page.getByText("You", { exact: true })).toBeVisible();
});

test("assistant box is never a dead end", async ({ page }) => {
  await page.getByRole("button", { name: "Skip tour" }).click();
  const box = page.locator('[data-tour="agent"]');
  await expect(box.getByRole("heading", { name: "Ask in your own words" })).toBeVisible();
  // Either the key is set (question box) or it explains why not.
  await expect(box.getByLabel("Your question").or(box.getByText("switched off on this copy"))).toBeVisible();
});
