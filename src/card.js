import { CARD_TYPE, normalizeConfig } from "./config.js";
import { CostPanel } from "./cost-panel.js";
import { calendar } from "./data.js";
import { element } from "./dom.js";
import { GasCostsEditor, loadEditorForm } from "./editor.js";
import { cardStyles } from "./styles.js";
import { labels, localeFor, theme } from "./text.js";

const refreshInterval = 5 * 60_000;

class GasCostsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.panel = new CostPanel();
    const card = element("ha-card");
    card.append(this.panel.node);
    this.shadowRoot.append(element("style", "", cardStyles), card);
  }

  static async getConfigElement() {
    await loadEditorForm();
    return document.createElement(CARD_TYPE + "-editor");
  }

  static getStubConfig() {
    return { type: "custom:" + CARD_TYPE, cost: {} };
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
    this.panel.setConfig(this.config);
    this.update();
  }

  set hass(hass) {
    this._hass = hass;
    this.update();
  }

  connectedCallback() {
    this.panel.connect();
    this.update();
    this.refreshTimer = setInterval(() => this.refresh(), refreshInterval);
  }

  disconnectedCallback() {
    clearInterval(this.refreshTimer);
    this.panel.reset();
    this.panel.disconnect();
    this.scope = undefined;
  }

  update() {
    if (!this.isConnected || !this.config || !this._hass) return;
    const hass = this._hass;
    const zone = hass.config?.time_zone || "UTC";
    const connection = hass.connection ?? hass.callWS;
    if (this.scope?.zone !== zone || this.scope?.connection !== connection) {
      this.panel.reset();
      this.scope = { zone, connection };
    }
    theme(this, hass);
    this.panel.render({
      hass, config: this.config, text: labels(hass),
      locale: localeFor(hass), themeMode: this.dataset.themeMode,
    });
    this.refresh(true);
  }

  refresh(initial = false) {
    if (!this.scope || !this.panel.needsRefresh(initial, this._hass, this.config)) return;
    this.panel.refresh(this._hass, this.config, calendar(this.scope.zone, Date.now()));
  }
}

if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, GasCostsCard);
if (!customElements.get(CARD_TYPE + "-editor")) customElements.define(CARD_TYPE + "-editor", GasCostsEditor);

window.customCards ??= [];
if (!window.customCards.some(({ type }) => type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "Gas Costs Card",
    description: "MVM residential gas cost estimates from Home Assistant Recorder.",
    preview: true,
  });
}
