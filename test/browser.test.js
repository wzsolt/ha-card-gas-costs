import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { parse } from "yaml";

const bundle = fileURLToPath(new URL("../dist/ha-card-gas-costs.js", import.meta.url));
const config = parse(await readFile(new URL("../examples/gas-costs.yaml", import.meta.url), "utf8"));
const tag = "ha-card-gas-costs";
const fixedTime = Date.parse("2026-11-11T09:45:00Z");
const hour = 3_600_000;

async function mount(page, config, dark = true) {
  await page.clock.install({ time: fixedTime });
  await page.setContent('<style>body { margin: 12px; font: 16px system-ui; }</style><main></main>');
  await page.evaluate(() => {
    customElements.define("ha-card", class extends HTMLElement {});
    customElements.define("ha-icon", class extends HTMLElement {});
    window.loadCardHelpers = async () => ({
      async createCardElement() {
        customElements.define("hui-entities-card", class extends HTMLElement {
          static async getConfigElement() {
            customElements.define("ha-form", class extends HTMLElement {
              edit(field, value) {
                const path = Array.isArray(field) ? field : [field];
                let schema = this.schema;
                const data = structuredClone(this.data);
                let target = data;
                for (const name of path.slice(0, -1)) {
                  schema = schema.find((item) => item.name === name)?.schema;
                  target = target[name] ??= {};
                }
                if (!schema?.some(({ name }) => name === path.at(-1))) throw new Error("Missing field");
                target[path.at(-1)] = value;
                this.data = data;
                this.dispatchEvent(new CustomEvent("value-changed", { detail: { value: this.data }, bubbles: true }));
              }
            });
          }
        });
      },
    });
  });
  await page.addScriptTag({ path: bundle, type: "module" });
  await page.evaluate((tag) => customElements.whenDefined(tag).then(() => undefined), tag);
  await page.evaluate(({ tag, config, dark, hour }) => {
    window.calls = [];
    window.hass = {
      config: { time_zone: "Europe/Budapest" },
      locale: { language: "hu-HU" },
      themes: { darkMode: dark },
      states: { [config.consumption_entity]: { state: "155.90", attributes: { unit_of_measurement: "m³" } } },
      callWS: async (request) => {
        window.calls.push(request);
        const start = Date.parse(request.start_time);
        if (request.type === "history/history_during_period") {
          return { [request.entity_ids[0]]: [
            { s: "154", lu: start / 1000 },
            { s: "154.25", lc: (start + 1000 + 0.5 * hour) / 1000 },
            { s: "154.50", lc: (start + 1000 + 10.5 * hour) / 1000 },
          ] };
        }
        const [id] = request.statistic_ids;
        if (request.period === "day" && request.types[0] === "change" &&
            [Date.parse("2026-07-31T22:00:00Z"), Date.parse("2026-10-31T23:00:00Z")].includes(start)) {
          const rows = [];
          for (let day = Date.UTC(2026, 7, 1); day < Date.UTC(2026, 10, 11); day += 24 * hour) {
            const offset = day < Date.UTC(2026, 9, 26) ? 2 : 1;
            const change = day === Date.UTC(2026, 10, 9) ? 10 : day === Date.UTC(2026, 10, 10) ? 0 : 1;
            rows.push({ start: day - offset * hour, change });
          }
          return { [id]: rows };
        }
        throw new Error("Unexpected Recorder request: " + JSON.stringify(request));
      },
    };
    const card = document.createElement(tag);
    card.setConfig(config);
    card.hass = window.hass;
    document.querySelector("main").append(card);
  }, { tag, config, dark, hour });
}

test("MVM cost editor, billing summary and interactive daily, monthly and gas-year views", { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.GAS_COSTS_CHROMIUM });
  try {
    const page = await browser.newPage({ viewport: { width: 520, height: 760 }, hasTouch: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    const curve = "31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31";
    const settings = { ...config, cost: {} };
    await mount(page, settings);
    const card = page.locator(tag);
    const panel = card.locator(".cost-panel");
    await panel.getByText("Ellenőrizd a tarifát és a kezdőértéket").waitFor();
    assert.equal(await page.evaluate(() => window.calls.length), 0);

    const saved = await page.evaluate(async ({ tag, curve, settings }) => {
      const card = document.querySelector(tag);
      const editor = await card.constructor.getConfigElement();
      editor.hass = window.hass;
      editor.setConfig(settings);
      document.body.append(editor);
      let next;
      editor.addEventListener("config-changed", ({ detail }) => { next = detail.config; });
      const form = editor.shadowRoot.querySelector("ha-form");
      for (const [field, value] of Object.entries({
        effective_from: "2026-08-01", billing_period_start: "2026-11-04",
        discounted_ft_per_mj: 2, market_ft_per_mj: 10, heating_value_mj_per_m3: 1,
        correction_factor: 1, annual_allowance_mj: 365, base_ft_per_year: 360,
        monthly_weights: curve,
      })) {
        form.edit(["cost", field], value);
      }
      card.setConfig(next);
      return next;
    }, { tag, curve, settings });
    assert.deepEqual(saved.cost.monthly_weights, curve.split(", ").map(Number));
    assert.equal(saved.cost.billing_period_start, "2026-11-04");
    assert.equal("enabled" in saved.cost, false);
    await panel.locator('.cost-chart[data-period="daily"] canvas').waitFor();
    const totals = panel.locator(".cost-total");
    for (const [index, expected] of [[0, "4 Ft"], [1, "108 Ft"], [2, "382 Ft"], [3, "99 Ft"]]) {
      assert.equal(await totals.nth(index).locator("dd").first().textContent(), expected);
    }
    assert.equal(await totals.nth(0).locator("dd.subtitle").textContent(), "Korábbi hónapok becsült sávkorrekciója: 0 Ft");
    assert.equal(await page.evaluate(() => window.calls.filter((message) =>
      message.type === "history/history_during_period").length), 1);

    const daily = panel.locator('.cost-chart[data-period="daily"]');
    const monthly = panel.locator('.cost-chart[data-period="monthly"]');
    const yearly = panel.locator('.cost-chart[data-period="yearly"]');
    const dailyToggle = panel.getByRole("button", { name: "30 nap" });
    const monthlyToggle = panel.getByRole("button", { name: "12 hónap" });
    const yearlyToggle = panel.getByRole("button", { name: "Kedvezményes évek" });
    assert.equal(await monthly.isVisible(), false);
    assert.equal(await yearly.isVisible(), false);

    const plot = daily.locator(".plot");
    const dailyValue = daily.locator(".readout-value");
    const canvas = daily.locator("canvas");
    await page.setViewportSize({ width: 300, height: 760 });
    const layout = () => panel.evaluate((node) => {
      const top = (selector) => node.querySelector(selector).getBoundingClientRect().top + window.scrollY;
      return [top("canvas"), top(".note"), node.getBoundingClientRect().height];
    });
    const baseline = await layout();
    const narrowWidth = (await canvas.boundingBox()).width;
    await canvas.hover({ position: { x: narrowWidth - 16, y: 45 } });
    assert.equal(await dailyValue.textContent(), "4 Ft");
    assert.equal(await daily.locator(".chart-details").isVisible(), true);
    assert.deepEqual(await layout(), baseline);
    await canvas.hover({ position: { x: 48, y: 45 } });
    assert.equal(await dailyValue.textContent(), "3 Ft");
    assert.deepEqual(await layout(), baseline);
    await panel.getByRole("heading", { name: "Becsült gázköltség" }).hover();
    assert.equal(await dailyValue.isHidden(), true);
    assert.deepEqual(await layout(), baseline);

    assert.equal(await daily.evaluate((node) => getComputedStyle(node).borderRadius), "14px");
    assert.equal(await daily.locator(".chart-heading ha-icon").count(), 1);
    await page.setViewportSize({ width: 820, height: 760 });
    assert.equal(await panel.locator(".cost-charts").evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns.split(" ").length), 2);
    await page.setViewportSize({ width: 520, height: 760 });
    await plot.focus();
    await page.keyboard.press("End");
    assert.equal(await dailyValue.textContent(), "4 Ft");
    assert.match(await daily.locator(".chart-details").textContent(), /Kedvezményes díj 1 Ft.*Kereten túli díj 2 Ft.*Alapdíj 1 Ft/);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await dailyValue.textContent(), "1 Ft");
    assert.match(await daily.locator(".chart-details").textContent(), /Kereten túli díj 0 Ft.*Alapdíj 1 Ft/);
    const width = (await canvas.boundingBox()).width;
    await canvas.tap({ position: { x: width - 20, y: 45 } });
    await canvas.hover({ position: { x: 48, y: 45 } });
    assert.equal(await dailyValue.textContent(), "4 Ft");
    assert.equal(await daily.locator(".readout").evaluate((node) => node.nextElementSibling.tagName), "CANVAS");
    await page.keyboard.press("Escape");
    assert.equal(await dailyValue.isHidden(), true);

    await monthlyToggle.click();
    await yearlyToggle.tap();
    assert.equal(await daily.isVisible(), true);
    const monthCanvas = monthly.locator("canvas");
    const monthWidth = (await monthCanvas.boundingBox()).width;
    await monthCanvas.click({ position: { x: monthWidth - 20, y: 45 } });
    assert.match(await monthly.locator(".readout-period").textContent(), /november/);
    assert.equal(await monthly.locator(".readout-value").textContent(), "108 Ft");
    await yearly.locator(".plot").focus();
    await page.keyboard.press("End");
    assert.match(await yearly.locator(".readout-period").textContent(), /2026.*2027/);
    assert.equal(await yearly.locator(".readout-value").textContent(), "382 Ft");
    await dailyToggle.click();
    assert.equal(await daily.isVisible(), false);
    assert.equal(await monthly.isVisible(), true);
    assert.equal(await yearly.isVisible(), true);
    await monthlyToggle.click();
    await yearlyToggle.click();
    assert.equal(await panel.locator(".cost-chart:visible").count(), 0);
    assert.equal(await totals.nth(0).isVisible(), true);
    const closedBefore = await page.evaluate(() => window.calls.filter(({ period }) => period === "day").length);
    await page.clock.fastForward(5 * 60_000);
    await page.waitForFunction(() => window.calls.filter(({ type }) => type === "history/history_during_period").length === 2);
    assert.equal(await page.evaluate(() => window.calls.filter(({ period }) => period === "day").length), closedBefore);

    const opening = await page.evaluate((tag) => {
      const editor = document.querySelector(tag + "-editor");
      const form = editor.shadowRoot.querySelector("ha-form");
      let next;
      editor.addEventListener("config-changed", ({ detail }) => { next = detail.config; });
      form.edit(["charts", "yearly"], true);
      form.edit(["cost", "opening_date"], "2026-11-01");
      form.edit(["cost", "opening_consumption_m3"], 95);
      document.querySelector(tag).setConfig(next);
      return next.cost;
    }, tag);
    assert.equal(opening.opening_date, "2026-11-01");
    assert.equal(opening.opening_consumption_m3, 95);
    assert.equal(await yearlyToggle.getAttribute("aria-pressed"), "true");
    await panel.locator('.cost-chart[data-period="daily"] canvas').waitFor();
    assert.equal(await totals.nth(1).locator("dd").first().textContent(), "108 Ft");
    assert.equal(await totals.nth(1).getByText("E havi díjak: 132 Ft").count(), 1);
    assert.equal(await totals.nth(1).getByText("Korábbi hónapok becsült sávkorrekciója: -24 Ft").count(), 1);
    assert.equal(await totals.nth(2).locator("dd").first().textContent(), "108 Ft");
    assert.match(await totals.nth(2).textContent(), /hiányzó napok/);
    assert.doesNotMatch(await panel.textContent(), /Korábbi keret ismeretlen/);
    assert.equal(await page.evaluate(() => window.calls.findLast(({ period }) => period === "day").start_time),
      "2026-10-31T23:00:00.000Z");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
