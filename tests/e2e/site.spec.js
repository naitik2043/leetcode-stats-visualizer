const { test, expect } = require("@playwright/test");

function sampleProfile(cacheState = "fresh") {
  return {
    username: "sample_user",
    fetchedAt: "2026-11-28T08:00:00.000Z",
    cache: {
      state: cacheState,
      stale: cacheState !== "fresh",
      ageSeconds: cacheState === "fresh" ? 30 : 1800
    },
    stats: {
      totalSolved: 20,
      solved: { easy: 10, medium: 8, hard: 2 },
      totalQuestions: { easy: 900, medium: 1900, hard: 800 },
      acceptedTotal: 25,
      submissionTotal: 40,
      acceptanceRate: 62.5
    },
    activity: { currentStreak: 2, totalActiveDays: 20, daily: [] },
    topics: [
      { name: "Dynamic Programming", slug: "dynamic-programming", solved: 1, level: "advanced" },
      { name: "Array", slug: "array", solved: 8, level: "fundamental" },
      { name: "Graph", slug: "graph", solved: 3, level: "intermediate" }
    ],
    contest: null
  };
}

test("homepage navigation and light/dark theme preference work", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/LeetMetric/);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator(".desktop-nav").getByRole("link", { name: "Intelligence" })).toBeVisible();

  const themeButton = page.locator("[data-theme-toggle]");
  await expect(themeButton).toHaveAttribute("aria-label", "Switch to light mode");
  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("leetmetric-theme"))).toBe("light");

  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("code review lab analyzes a nested-loop example in the browser", async ({ page }) => {
  await page.goto("/code-lab.html");
  await page.locator("#code-source").fill(
    "for (int i = 0; i < n; i++) {\\n  for (int j = 0; j < n; j++) {\\n    work();\\n  }\\n}"
  );
  await page.locator("#code-analyze").click();

  await expect(page.locator("#code-review-results")).toBeVisible();
  await expect(page.locator("#code-time")).toHaveText("O(n^2) likely");
  await expect(page.locator("#code-review-status")).toContainText("No code was executed");
});

test("roadmap generation labels stale data and keeps a browser copy when account sync is unavailable", async ({ page }) => {
  await page.route("**/api/leetcode/sample_user", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(sampleProfile("stale-if-error"))
  }));
  await page.route("**/api/roadmaps**", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "Sign in to synchronize roadmaps across devices." })
  }));

  await page.goto("/roadmap.html");
  await page.locator("#roadmap-username").fill("sample_user");
  await page.locator("#roadmap-horizon").selectOption("7");
  await page.locator("#roadmap-submit").click();

  await expect(page.locator("#roadmap-results")).toBeVisible();
  await expect(page.locator("#roadmap-title")).toHaveText("sample_user · 7-day roadmap");
  await expect(page.locator("#roadmap-status")).toContainText("cached public snapshot");
  await expect(page.locator("#roadmap-status")).toHaveClass(/warning/);
  await expect(page.locator("#roadmap-weeks h3").first()).toHaveText("Dynamic Programming");

  await page.locator("#roadmap-save").click();
  await expect(page.locator("#roadmap-status")).toContainText("A browser copy was saved");
  const localCopy = await page.evaluate(() => localStorage.getItem("leetmetric-roadmap:sample_user:7"));
  expect(localCopy).not.toBeNull();
});
