import { element } from "./dom.js";

const left = 46;
const top = 8;
const right = 14;
const bottom = 27;

function range(points) {
  const values = points.map(({ value }) => value).filter(Number.isFinite);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const rough = (max - min) / 3 || 0.1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((unit) => unit * power >= rough) ?? 10) * power;
  const start = Math.floor(min / step) * step;
  const end = Math.max(start + step, Math.ceil(max / step) * step);
  return { start, end, step };
}

export class Plot {
  constructor() {
    this.node = element("div", "plot");
    this.canvas = element("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.readout = element("div", "readout");
    this.readoutLine = element("div", "readout-line");
    this.readoutLine.setAttribute("aria-live", "polite");
    this.readoutLine.setAttribute("aria-atomic", "true");
    this.readoutPeriod = element("span", "readout-period");
    this.readoutValue = element("strong", "readout-value");
    this.readoutLine.append(this.readoutPeriod, this.readoutValue);
    this.readout.append(this.readoutLine);
    this.detailsSlot = element("div", "chart-details-slot");
    this.details = element("p", "chart-details");
    this.detailsSlot.append(this.details);
    this.node.tabIndex = 0;
    this.node.setAttribute("role", "group");
    this.node.append(this.readout, this.canvas, this.detailsSlot);
    this.resize = new ResizeObserver(() => this.draw());

    const pointAt = (event) => {
      if (!this.points?.length) return null;
      const rect = this.canvas.getBoundingClientRect();
      const relative = (event.clientX - rect.left - left) / (rect.width - left - right);
      return relative >= 0 && relative < 1 ? Math.floor(relative * this.points.length) : null;
    };
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse" && !this.pinned) this.select(pointAt(event));
    });
    this.canvas.addEventListener("click", (event) => {
      const index = pointAt(event);
      if (index === null) return;
      this.pinned = true;
      this.select(index);
      this.node.focus({ preventScroll: true });
    });
    this.canvas.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && !this.pinned && !this.node.matches(":focus")) this.select(null);
    });
    this.node.addEventListener("focus", () => {
      if (this.index == null) this.select(this.points?.findLastIndex(({ value }) => value !== null));
    });
    this.node.addEventListener("blur", () => {
      if (!this.pinned) this.select(null);
    });
    this.node.addEventListener("keydown", (event) => {
      if (!this.points?.length || !["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Escape") return this.clearSelection();
      if (event.key === "Home") return this.select(0);
      if (event.key === "End") return this.select(this.points.length - 1);
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      this.select(Math.max(0, Math.min(this.points.length - 1, (this.index ?? -1) + delta)));
    });
  }

  setData(points, locale, text, options) {
    const selectedKey = this.points?.[this.index]?.key;
    this.options = options;
    this.points = points;
    this.idle = { period: text.tooltipHelp, value: "", details: "" };
    this.descriptions = points.map((point) => {
      const known = point.value !== null;
      const details = known ? options.details(point) : [];
      if (point.partial) details.push(text.partial);
      return {
        period: options.period(point),
        value: known ? options.value(point) : text.missing,
        details: details.join(" · "),
      };
    });
    this.reserveReadoutSpace();
    this.axisNumber = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
    this.node.setAttribute("aria-label", options.label + ". " + text.tooltipHelp);
    this.select(points.findIndex(({ key }) => key === selectedKey));
    if (this.index === null) this.pinned = false;
  }

  reserveReadoutSpace() {
    // Stack hidden copies under the active readouts so the longest localized
    // breakdown determines the layout at the card's current width.
    const lines = [this.idle, ...this.descriptions].map(({ period, value }) => {
      const line = element("div", "readout-line readout-sizer");
      line.setAttribute("aria-hidden", "true");
      line.append(element("span", "", period));
      if (value) line.append(element("strong", "", value));
      return line;
    });
    const breakdowns = new Set(this.descriptions.map(({ details }) => details).filter(Boolean));
    const details = [...breakdowns].map((text) => {
      const line = element("p", "readout-sizer", text);
      line.setAttribute("aria-hidden", "true");
      return line;
    });
    this.readout.replaceChildren(this.readoutLine, ...lines);
    this.detailsSlot.replaceChildren(this.details, ...details);
  }

  connect() {
    this.resize.observe(this.canvas);
    this.draw();
  }

  disconnect() {
    this.resize.disconnect();
  }

  clearSelection() {
    this.pinned = false;
    this.select(null);
  }

  select(index) {
    this.index = this.points?.[index] ? index : null;
    const { period = "", value = "", details = "" } = this.descriptions?.[this.index] ?? this.idle ?? {};
    if (this.readoutPeriod.textContent !== period) this.readoutPeriod.textContent = period;
    if (this.readoutValue.textContent !== value) this.readoutValue.textContent = value;
    this.readoutValue.hidden = this.index === null;
    if (this.details.textContent !== details) this.details.textContent = details;
    this.details.hidden = details === "";
    this.draw();
  }

  draw() {
    if (!this.points?.some(({ value }) => value !== null)) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width <= left + right || height <= top + bottom) return;
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    const ctx = this.canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const style = getComputedStyle(this.node);
    // Canvas needs resolved colors. Read them from themed DOM properties.
    const colors = { line: style.color, text: getComputedStyle(this.readout).color, grid: style.borderTopColor };
    const { start, end, step } = range(this.points);
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const slot = chartWidth / this.points.length;
    const x = (index) => left + slot * (index + 0.5);
    const y = (value) => top + (end - value) / (end - start) * chartHeight;

    ctx.font = "11px " + style.fontFamily;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (let tick = 0; tick <= Math.round((end - start) / step); tick++) {
      const value = start + tick * step;
      ctx.fillStyle = colors.text;
      ctx.fillText(this.axisNumber.format(value), left - 7, y(value));
      ctx.fillStyle = colors.grid;
      ctx.fillRect(left, y(value), chartWidth, 1);
    }

    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    const stride = Math.ceil(this.points.length / Math.max(2, Math.floor(chartWidth / 52)));
    for (let index = 0; index < this.points.length; index += stride) {
      ctx.fillText(this.options.tick(this.points[index]), x(index), height - 10);
    }

    if (this.index !== null) {
      ctx.fillStyle = colors.line;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(x(this.index) - slot / 2, top, slot, chartHeight);
    }
    ctx.fillStyle = colors.line;
    this.points.forEach(({ value, partial }, index) => {
      if (value === null) return;
      ctx.globalAlpha = partial && index !== this.index ? 0.55 : 1;
      const bar = Math.min(32, slot * 0.67);
      const zero = y(0);
      const barHeight = Math.max(1, Math.abs(zero - y(value)));
      const barTop = value < 0 ? zero : zero - barHeight;
      ctx.beginPath();
      ctx.roundRect(x(index) - bar / 2, barTop, bar, barHeight,
        value < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0]);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}
