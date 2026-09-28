import { test, expect, type Page } from "@playwright/test";
const fixture = (baseUrl: string) => ({
  baseUrl,
  pages: [
    {
      url: baseUrl + "about",
      path: "/about",
      title: "About",
      description: "About us",
      statusCode: 200,
    },
  ],
  errors: [],
  warnings: [],
});
async function board(page: Page) {
  await page.route("**/api/crawl", (r) =>
    r.fulfill({ json: fixture(r.request().postDataJSON().baseUrl) }),
  );
  await page.goto("/");
  await page.getByLabel("Old site URL").fill("https://old.test/");
  await page.getByLabel("New site URL").fill("https://new.test/");
  await page.getByRole("button", { name: "Crawl both sites" }).click();
  await page.getByRole("button", { name: "Connect selected (1)" }).click();
}
test("keyboard mapping, mobile panels, manual URL, CSV, and recrawl lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await board(page);
  await page
    .getByRole("button", { name: "Remove mapping from /about", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Select source /about", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Map selected source to /about",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Map selected source to /about", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remove mapping from /about",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ Add page manually", exact: true })
    .click();
  await page.getByLabel("Page path").fill("/manual");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Open page: https://old.test/manual",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://old.test/manual");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "redirect-map-review.csv",
  );
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.unroute("**/api/crawl");
  await page.route("**/api/crawl", async (r) => {
    await gate;
    await r.fulfill({ json: fixture(r.request().postDataJSON().baseUrl) });
  });
  await page.getByRole("button", { name: "Recrawl", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Remove mapping from /about",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "↺ Start over" }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Recrawl", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", {
      name: "Open page: https://old.test/manual",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-fixed.png",
    fullPage: true,
  });
});
test("share saves new pages, survives reload, and surfaces revision conflicts", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-write", "clipboard-read"]);
  let snapshot: unknown;
  let token = "";
  let revision = 1;
  let writes = 0;
  const id = "11111111-1111-4111-8111-111111111111";
  await page.route("https://qa.supabase.co/rest/v1/rpc/**", async (r) => {
    const body = r.request().postDataJSON();
    const method = r.request().url().split("/").at(-1);
    if (method === "create_mapping_session") {
      snapshot = body.p_snapshot;
      token = body.p_token;
      return r.fulfill({ json: { id, revision } });
    }
    expect(body.p_token).toBe(token);
    if (method === "load_mapping_session")
      return r.fulfill({ json: { id, revision, snapshot } });
    if (body.p_revision !== revision)
      return r.fulfill({
        status: 400,
        json: {
          message: "Session changed elsewhere. Export local work and reload.",
        },
      });
    snapshot = body.p_snapshot;
    revision++;
    writes++;
    return r.fulfill({ json: { revision } });
  });
  await board(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page).toHaveURL(/session=.*#key=[a-f0-9]{64}/);
  await page
    .getByRole("button", { name: "+ Add page manually", exact: true })
    .first()
    .click();
  await page.getByLabel("Page path").fill("/manual");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("link", {
      name: "Open page: https://old.test/manual",
      exact: true,
    }),
  ).toBeVisible();
  expect(writes).toBe(1); // Loading must not write a stale snapshot.
  revision++;
  await page
    .getByRole("button", { name: "Remove mapping from /about", exact: true })
    .click();
  await expect(
    page.getByText("Session changed elsewhere. Export local work and reload."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();
});
test("API rejects invalid bodies and private URLs", async ({ request }) => {
  for (const data of [
    null,
    { baseUrl: 123 },
    { baseUrl: "http://127.0.0.1/" },
    { baseUrl: "http://[::1]/" },
  ]) {
    const response = await request.post("/api/crawl", {
      data: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  }
});
