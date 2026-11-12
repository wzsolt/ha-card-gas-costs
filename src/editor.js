import { costDefaults, costNumberFields } from "./cost.js";
import { chartPeriods, chartVisibility, normalizeConfig } from "./config.js";
import { numeric } from "./data.js";
import { element } from "./dom.js";
import { labels } from "./text.js";

export async function loadEditorForm() {
  if (customElements.get("ha-form")) return;
  const helpers = await window.loadCardHelpers?.();
  if (helpers && !customElements.get("hui-entities-card")) {
    await helpers.createCardElement({ type: "entities", entities: [] });
  }
  await customElements.get("hui-entities-card")?.getConfigElement?.();
}

export class GasCostsEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.form = element("ha-form");
    this.shadowRoot.append(this.form);
    this.form.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this.change(event.detail.value);
    });
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    if (!this.config || !this._hass) return;
    const text = labels(this._hass);
    this.form.hass = this._hass;
    if (this.text !== text) {
      this.text = text;
      this.form.computeLabel = ({ name }) => text[name] || text["cost_" + name] || name;
      this.form.computeHelper = ({ name }) => ({
        monthly_weights: text.monthlyWeightsHelp,
        opening_consumption_m3: text.openingConsumptionHelp,
      })[name];
      this.form.schema = [
        { name: "title", selector: { text: {} } },
        { name: "consumption_entity", selector: { entity: { filter: { domain: "sensor" } } } },
        {
          name: "charts", type: "expandable", title: text.costPeriod, icon: "mdi:chart-bar",
          schema: chartPeriods.map((name) => ({ name, selector: { boolean: {} } })),
        },
        {
          name: "cost", type: "expandable", title: text.cost, icon: "mdi:cash",
          schema: [
            { name: "effective_from", selector: { date: {} } },
            { name: "billing_period_start", selector: { date: {} } },
            ...costNumberFields.map((name) => ({
              name, default: costDefaults[name], selector: { number: { mode: "box", min: 0, step: "any" } },
            })),
            { name: "monthly_weights", selector: { text: {} } },
            { name: "opening_date", selector: { date: {} } },
            { name: "opening_consumption_m3", selector: { number: { mode: "box", min: 0, step: "any" } } },
          ],
        },
      ];
    }
    if (this.renderedConfig !== this.config) {
      const { title, consumption_entity, cost } = this.config;
      const costData = { ...cost };
      delete costData.enabled;
      if (Array.isArray(costData.monthly_weights)) {
        costData.monthly_weights = costData.monthly_weights.join(", ");
      }
      this.form.data = { title, consumption_entity, cost: costData, charts: chartVisibility(this.config.charts) };
      this.renderedConfig = this.config;
    }
  }

  change(data) {
    const next = { ...this.config };
    for (const field of ["title", "consumption_entity"]) {
      if (data[field]?.trim()) next[field] = data[field].trim();
      else delete next[field];
    }
    const cost = { ...data.cost };
    delete cost.enabled;
    for (const key of Object.keys(cost)) {
      if (cost[key] === "" || cost[key] == null) delete cost[key];
    }
    if (typeof cost.monthly_weights === "string") {
      const weights = cost.monthly_weights.split(",").map(numeric);
      if (weights.length === 12 && weights.every((value) => value !== null)) cost.monthly_weights = weights;
    }
    next.cost = cost;
    next.charts = chartVisibility(data.charts);
    this.config = next;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: next }, bubbles: true, composed: true,
    }));
  }
}
