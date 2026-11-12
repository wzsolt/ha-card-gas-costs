export const cardStyles = `
:host {
  display: block;
  container-type: inline-size;
  --gas-text: var(--primary-text-color, light-dark(#24262a, #f0f0f0));
  --gas-muted: var(--secondary-text-color, light-dark(#555d64, #b3b3b3));
  --gas-grid: var(--divider-color, light-dark(#d9dde0, #41464a));
  --gas-green: light-dark(#23763a, #77ca89);
  --gas-surface: color-mix(in srgb, var(--gas-text) 4%, transparent);
  color: var(--gas-text);
  font-family: var(--primary-font-family, inherit);
}
:host([data-theme-mode="dark"]) { color-scheme: dark; }
:host([data-theme-mode="light"]) { color-scheme: light; }
[hidden] { display: none !important; }
ha-card {
  display: block;
  overflow: hidden;
  background: var(--ha-card-background, var(--card-background-color, light-dark(#fff, #1c1c1c)));
}
.cost-panel { padding: 14px; --accent: var(--gas-green); }
.chart-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
h2, p { margin: 0; overflow-wrap: anywhere; }
h2 { font-size: 1.2rem; font-weight: 650; line-height: 1.25; }
.glyph {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--accent);
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.glyph ha-icon { --mdc-icon-size: 19px; }
.subtitle { font-size: 0.76rem; color: var(--gas-muted); }
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 3px 9px;
  border-radius: 999px;
  box-sizing: border-box;
  color: var(--accent, var(--gas-muted));
  background: color-mix(in srgb, currentColor 11%, transparent);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
}
.toggle { border: 1px solid transparent; cursor: pointer; }
.toggle[aria-pressed="false"] { color: var(--gas-muted); background: transparent; border-color: var(--gas-grid); }
.toggle:hover { border-color: currentColor; }
.toggle:focus-visible, .plot:focus-visible { outline: 2px solid var(--primary-color, #1686b7); outline-offset: 2px; }
.cost-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 122px), 1fr));
  gap: 6px;
  margin: 0 0 10px;
}
.cost-total { padding: 8px; border-radius: 8px; background: var(--gas-surface); }
.cost-total dt { color: var(--gas-muted); font-size: 0.76rem; }
.cost-total dd { margin: 3px 0 0; font-variant-numeric: tabular-nums; }
.cost-total dd:not(.subtitle) { font-weight: 650; }
.cost-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.cost-chart { margin: 12px 0; }
.cost-chart-title { margin: 0 0 4px; font-size: 0.8rem; color: var(--gas-muted); }
.plot { color: var(--accent); border: 0 solid var(--gas-grid); border-radius: 6px; }
canvas { display: block; width: 100%; height: 148px; touch-action: pan-y; }
.note, .status, .chart-details { font-size: 0.75rem; color: var(--gas-muted); line-height: 1.4; }
.readout {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-block-size: 3.5rem;
  padding: 5px 10px;
  border: 1px solid var(--gas-grid);
  border-radius: 8px;
  color: var(--gas-muted);
  background: var(--gas-surface);
  font-size: 0.8rem;
  line-height: 1.2;
}
.readout-period { overflow-wrap: anywhere; }
.readout-value { color: var(--gas-text); font-size: 1.15rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
.chart-details { margin: 4px; overflow-wrap: anywhere; }
.note { margin: 4px; }
.status { margin: 8px 4px 6px; }
@container (max-width: 360px) {
  .cost-panel { padding: 10px; }
}
`;
