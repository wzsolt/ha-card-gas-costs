import { chartPeriods, chartVisibility } from "./config.js";
import { buildCostView, costOptions, fetchClosedDays, fetchTodayVolume } from "./cost.js";
import { element, icon } from "./dom.js";
import { Plot } from "./plot.js";

const historyLifetime = 60 * 60_000;
const chartIcons = {
  daily: "mdi:chart-bar", monthly: "mdi:calendar-month-outline", yearly: "mdi:calendar-range",
};

export class CostPanel {
  constructor() {
    this.visible = chartVisibility();
    this.node = element("section", "cost-panel");

    const heading = element("div", "chart-heading");
    const glyph = element("span", "glyph");
    glyph.append(icon("mdi:cash"));
    this.heading = element("h2");
    heading.append(glyph, this.heading);

    this.summary = element("dl", "cost-summary");
    this.controls = element("div", "cost-controls");
    this.controls.setAttribute("role", "group");
    const charts = element("div", "cost-charts");
    this.charts = new Map(chartPeriods.map((period) => {
      const button = element("button", "toggle");
      button.type = "button";
      button.dataset.period = period;
      const buttonLabel = element("span");
      button.append(icon(chartIcons[period]), buttonLabel);
      button.addEventListener("click", () => {
        this.visible[period] = !this.visible[period];
        this.render(this.context);
      });
      this.controls.append(button);

      const section = element("section", "cost-chart");
      section.dataset.period = period;
      section.hidden = true;
      const head = element("div", "chart-heading");
      const chartGlyph = element("span", "glyph");
      chartGlyph.append(icon(chartIcons[period]));
      const copy = element("div");
      const title = element("h3");
      const subtitle = element("p", "subtitle");
      copy.append(title, subtitle);
      const plot = new Plot();
      head.append(chartGlyph, copy, plot.readout);
      const empty = element("p", "status");
      section.append(head, plot.node, empty);
      charts.append(section);
      return [period, { button, buttonLabel, section, title, subtitle, plot, empty }];
    }));
    this.status = element("p", "status");
    this.status.setAttribute("role", "status");
    this.note = element("p", "note");
    this.node.append(heading, this.summary, this.controls, charts, this.status, this.note);
  }

  setConfig(config) {
    this.visible = chartVisibility(config.charts);
    this.reset();
  }

  connect() {
    for (const { plot } of this.charts.values()) plot.connect();
  }

  disconnect() {
    for (const { plot } of this.charts.values()) plot.disconnect();
  }

  reset() {
    this.result = undefined;
    this.request = undefined;
    this.history = undefined;
    for (const { plot } of this.charts.values()) plot.clearSelection();
  }

  render(context) {
    this.context = context;
    const { hass, config, text, locale, themeMode } = context;
    this.heading.textContent = config.title || text.cost;
    this.controls.setAttribute("aria-label", text.costPeriod);
    this.note.textContent = text.costEstimate;
    const issue = this.configIssue(hass, config) ?? this.result?.dateIssue;
    const view = issue ? undefined : this.result?.view;
    const hasData = Boolean(view?.yearly.some(({ value }) => value !== null));
    this.controls.hidden = !view;
    this.summary.hidden = !view;
    for (const [period, { button, buttonLabel, section }] of this.charts) {
      button.setAttribute("aria-pressed", String(this.visible[period]));
      buttonLabel.textContent = text["cost_" + period];
      section.hidden = !view || !this.visible[period];
    }
    const warning = view?.summary.costYear?.uncertain ? text.costUncertain :
      this.result?.closedFailed ? text.costHistoryError : "";
    this.status.textContent = issue ? text[issue] :
      !view ? text.loading :
      !hasData && this.result?.failed ? text.error :
      !hasData ? text.empty : warning;
    this.status.hidden = !this.status.textContent;
    const appearance = JSON.stringify([locale, themeMode, hass.selectedTheme]);
    if (!view || (view === this.renderedView && this.appearance === appearance)) return;

    this.renderedView = view;
    this.appearance = appearance;
    const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const currency = (value) => amount.format(Math.round(value) || 0) + " Ft";
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    const shortMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    const shortDay = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    const dateRange = ({ key, end }) => date.formatRange(key, end - 86_400_000);
    const flags = (point) => [
      point.incomplete && text.costIncomplete,
      point.uncertain && text.costUncertainShort,
      point.delayed && text.costDelayed,
    ].filter(Boolean);

    this.summary.replaceChildren(...Object.entries(view.summary).map(([key, point]) => {
      const item = element("div", "cost-total");
      const label = element("dt", "", text[key]);
      const isToday = key === "costToday";
      const total = isToday ? point.charge?.value ?? null : point.value;
      const value = element("dd", "", total === null ? "—" : currency(total));
      const details = point ? flags(point) : [];
      if (key === "costBilling") details.unshift(date.format(point.key));
      item.append(label, value);
      if (isToday && total !== null) {
        item.append(element("dd", "subtitle", text.costEarlierCorrection + ": " + currency(point.earlierCorrection)));
      }
      if (key === "costMonth" && Math.round(point.earlierCorrection) !== 0) {
        const monthlyCharge = currency(point.value - point.earlierCorrection);
        item.append(
          element("dd", "subtitle", text.costMonthCharge + ": " + monthlyCharge),
          element("dd", "subtitle", text.costEarlierCorrection + ": " + currency(point.earlierCorrection)),
        );
      }
      if (details.length) item.append(element("dd", "subtitle", details.join(" · ")));
      return item;
    }));
    for (const [period, { title, subtitle, plot, empty }] of this.charts) {
      const points = period === "daily"
        ? view.daily.map((point) => ({ ...point, ...point.charge, value: point.charge?.value ?? null }))
        : view[period];
      const hasPoints = points.some(({ value }) => value !== null);
      title.textContent = text["cost_" + period];
      subtitle.textContent = period === "daily" ? text.costDailyCharge : text.costNetBalance;
      plot.node.hidden = !hasPoints;
      plot.readout.hidden = !hasPoints;
      empty.hidden = hasPoints;
      empty.textContent = text.empty;
      if (!hasPoints) continue;
      plot.setData(points, locale, text, {
        label: title.textContent + " · " + subtitle.textContent,
        tick: (point) => period === "yearly"
          ? new Date(point.key).getUTCFullYear() + "/" + String(new Date(point.end).getUTCFullYear()).slice(-2)
          : (period === "monthly" ? shortMonth : shortDay).format(point.key),
        period: (point) => period === "yearly" ? dateRange(point) :
          (period === "monthly" ? month : date).format(point.key),
        value: (point) => currency(point.value),
        details: (point) => {
          const daily = period === "daily";
          const correction = daily ? point.earlierCorrection : point.correction;
          const correctionLabel = daily ? text.costEarlierCorrection : text.costCorrection;
          return [
            text.costDiscount + " " + currency(point.discounted),
            text.costMarket + " " + currency(point.market),
            text.costBase + " " + currency(point.base),
            Math.round(correction) !== 0 && correctionLabel + " " + currency(correction),
            ...flags(point),
          ].filter(Boolean);
        },
      });
    }
  }

  configIssue(hass, config) {
    if (!costOptions(config.cost)) return "costSettings";
    if (!config.consumption_entity) return "configure";
    const state = hass.states?.[config.consumption_entity];
    if (!state) return "costSensor";
    if (!["m³", "m3"].includes(state.attributes?.unit_of_measurement)) return "costUnit";
    if (typeof hass.callWS !== "function") return "error";
  }

  needsRefresh(initial, hass, config) {
    return !this.request && (!initial || !this.result) && !this.configIssue(hass, config);
  }

  refresh(hass, config, dates) {
    const options = costOptions(config.cost);
    if (!options) return;
    const dateIssue = options.effective > dates.today ? "costFuture" :
      options.opening?.start > dates.today ? "costOpeningFuture" : undefined;
    if (dateIssue) {
      this.result = { dateIssue };
      this.render(this.context);
      return;
    }
    this.load(hass, config.consumption_entity, dates, options);
  }

  async load(hass, id, dates, options) {
    const request = Symbol("cost");
    this.request = request;
    const cached = this.history?.today === dates.today &&
      dates.now - this.history.at < historyLifetime ? this.history.volumes : null;
    const [closed, current] = await Promise.allSettled([
      cached ?? fetchClosedDays(hass, id, dates, options),
      fetchTodayVolume(hass, id, dates),
    ]);
    if (this.request !== request) return;
    this.request = undefined;
    if (!cached && closed.status === "fulfilled") {
      this.history = { today: dates.today, at: dates.now, volumes: closed.value };
    }
    const volumes = new Map(closed.status === "fulfilled" ? closed.value : undefined);
    const latest = current.status === "fulfilled" ? current.value : undefined;
    if (Number.isFinite(latest?.volume)) volumes.set(dates.today, latest.volume);
    this.result = {
      view: buildCostView(volumes, dates.today, options, latest?.delayed),
      failed: closed.status === "rejected" || current.status === "rejected",
      closedFailed: closed.status === "rejected",
    };
    this.render(this.context);
  }
}
