import { test, expect } from "@playwright/test";
import { randomUUID, randomInt } from "node:crypto";
// These tests create synthetic accounts in a seeded sandbox database.
test.beforeEach(async ({ page }) => {
  const phone = `+88017${String(randomInt(10000000, 99999999))}`;
  const origin = "http://127.0.0.1:3100";
  const otp = await page.request.post("/api/auth/request", {
    headers: { origin },
    data: { phone },
  });
  expect(otp.ok()).toBeTruthy();
  const { sandboxCode } = await otp.json();
  const login = await page.request.post("/api/auth/verify", {
    headers: { origin },
    data: {
      phone,
      code: sandboxCode,
      name: "Browser Test",
      handle: `test_${randomUUID().slice(0, 8)}`,
      dob: "1995-01-01",
    },
  });
  expect(login.ok()).toBeTruthy();
  await page.request.post("/api/command", {
    headers: { origin },
    data: { action: "preference", key: randomUUID(), data: { locale: "en" } },
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bangladesh, on your stage.",
  );
});
async function navigate(page: import("@playwright/test").Page, name: string) {
  const toggle = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
test("every surface loads and stays inside the viewport", async ({ page }) => {
  for (const [nav, title] of [
    ["BDOS Cut", "Make it your story."],
    ["Shop", "Local craft. Lovely finds."],
    ["Creator Studio", "Your creativity. Your momentum."],
    ["Affiliate", "Share what you love. Earn from it."],
    ["Ads Manager", "Give good stories a bigger stage."],
    ["LIVE", "Right here. Right now."],
    ["My orders", "Your orders"],
    ["Profile & Nirapod", "Your space. Your rules."],
  ]) {
    await navigate(page, nav);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
  }
});
test("create a story and retain it after reload", async ({ page }) => {
  await navigate(page, "BDOS Cut");
  const caption = `Browser story ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Caption", { exact: true }).fill(caption);
  await page
    .getByRole("button", { name: "Publish story", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("published");
  await page.reload();
  await expect(page.getByText(caption, { exact: true }).first()).toBeVisible();
});
test("checkout, confirm and cancel with a persistent cart", async ({
  page,
}) => {
  await navigate(page, "Shop");
  const p = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Everyday Jamdani", exact: true }),
  });
  await p.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add to cart", exact: true })
    .click();
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await page
    .getByLabel("Full delivery address", { exact: true })
    .fill("Synthetic house 9, Sandbox Road, Dhaka");
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your orders", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm delivery details", exact: true })
    .click();
  await expect(page.getByRole("article")).toContainText("confirmed");
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("cancelled");
});
