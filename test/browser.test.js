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
            { s: "155.9", lc: (start + 1000 + 10.5 * hour) / 1000 },
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
        correction_factor: 1, annual_allowance_mj: 365, base_ft_per_year: 0,
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
    await panel.locator("canvas").waitFor();
    const totals = panel.locator(".cost-total");
    for (const [index, expected] of [[0, "11 Ft"], [1, "111 Ft"], [2, "295 Ft"], [3, "105 Ft"]]) {
      assert.equal(await totals.nth(index).locator("dd").first().textContent(), expected);
    }
    assert.equal(await page.evaluate(() => window.calls.filter((message) =>
      message.type === "history/history_during_period").length), 1);

    const plot = panel.locator(".plot");
    const detail = panel.locator(".readout");
    await plot.focus();
    await page.keyboard.press("End");
    assert.match(await detail.textContent(), /11 Ft.*Kereten túli díj 19 Ft.*Becsült sávkorrekció -8 Ft/);
    await page.keyboard.press("ArrowLeft");
    assert.match(await detail.textContent(), /-8 Ft.*Alapdíj 0 Ft.*Becsült sávkorrekció -8 Ft/);
    await panel.getByRole("button", { name: "12 hónap" }).click();
    await plot.focus();
    await page.keyboard.press("End");
    assert.match(await detail.textContent(), /november.*111 Ft/);
    await panel.getByRole("button", { name: "Kedvezményes évek" }).tap();
    await plot.focus();
    await page.keyboard.press("End");
    assert.match(await detail.textContent(), /2026.*2027.*295 Ft/);

    const detailCanvas = panel.locator("canvas");
    await detailCanvas.hover({ position: { x: 48, y: 50 } });
    assert.match(await detail.textContent(), /2023|2024|2025/);
    const closedBefore = await page.evaluate(() => window.calls.filter(({ period }) => period === "day").length);
    await page.clock.fastForward(5 * 60_000);
    await page.waitForFunction(() => window.calls.filter(({ type }) => type === "history/history_during_period").length === 2);
    assert.equal(await page.evaluate(() => window.calls.filter(({ period }) => period === "day").length), closedBefore);

    const opening = await page.evaluate((tag) => {
      const editor = document.querySelector(tag + "-editor");
      const form = editor.shadowRoot.querySelector("ha-form");
      let next;
      editor.addEventListener("config-changed", ({ detail }) => { next = detail.config; });
      form.edit(["cost", "opening_date"], "2026-11-01");
      form.edit(["cost", "opening_consumption_m3"], 90);
      document.querySelector(tag).setConfig(next);
      return next.cost;
    }, tag);
    assert.equal(opening.opening_date, "2026-11-01");
    assert.equal(opening.opening_consumption_m3, 90);
    await panel.locator("canvas").waitFor();
    assert.equal(await totals.nth(1).locator("dd").first().textContent(), "95 Ft");
    assert.equal(await totals.nth(2).locator("dd").first().textContent(), "95 Ft");
    assert.match(await totals.nth(2).textContent(), /hiányzó napok/);
    assert.doesNotMatch(await panel.textContent(), /Korábbi keret ismeretlen/);
    assert.equal(await page.evaluate(() => window.calls.findLast(({ period }) => period === "day").start_time),
      "2026-10-31T23:00:00.000Z");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
