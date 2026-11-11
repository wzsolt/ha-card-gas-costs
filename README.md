# Gas Costs Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5)](https://github.com/wzsolt/ha-card-gas-costs#install)
[![GitHub Actions](https://github.com/wzsolt/ha-card-gas-costs/actions/workflows/card.yml/badge.svg?branch=main)](https://github.com/wzsolt/ha-card-gas-costs/actions/workflows/card.yml)
[![HACS Validation](https://github.com/wzsolt/ha-card-gas-costs/actions/workflows/hacs.yml/badge.svg?branch=main)](https://github.com/wzsolt/ha-card-gas-costs/actions/workflows/hacs.yml)
[![Release](https://img.shields.io/github/v/release/wzsolt/ha-card-gas-costs)](https://github.com/wzsolt/ha-card-gas-costs/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A Home Assistant dashboard card that estimates Hungarian MVM residential gas costs in forints. It shows today, this calendar month, the current August–July gas year, and optionally the current billing period. The card is available in Hungarian and English.

## Install

1. In HACS, open **Custom repositories** from the menu. Add `https://github.com/wzsolt/ha-card-gas-costs` as a **Dashboard** repository.
2. Download **Gas Costs Card** and reload your dashboard. If you manage Lovelace resources in YAML, add the JavaScript module URL shown by HACS to your resources.
3. Edit your dashboard, add **Gas Costs Card**, and select your consumption sensor and enter your tariff. You can also paste the YAML below into a manual card.

### Manual installation

Download `ha-card-gas-costs.js` from the [latest release](https://github.com/wzsolt/ha-card-gas-costs/releases/latest). Copy it to `/config/www/ha-card-gas-costs.js` and register `/local/ha-card-gas-costs.js` as a **JavaScript Module** resource. Reload the dashboard and add the card. After replacing a manually installed file, update the resource URL with a new version query parameter if your browser still serves the old file.

## Configuration

Use the visual editor or YAML to configure the Hungarian MVM profile for monthly meter readings with heating and hot water. Choose a cumulative gas consumption sensor in m³ with Recorder history and long-term statistics (for example, a gas sensor with the `total_increasing` state class). The optional `title` overrides the localized card heading. The bill's gross discounted rate, heating value and volume correction factor are required. The following values are illustrative. Replace them with the values for your supply point and use the first day for which they apply.

```yaml
type: custom:ha-card-gas-costs
consumption_entity: sensor.gas_consumption
cost:
  effective_from: "2026-08-01"
  discounted_ft_per_mj: 2.86512
  heating_value_mj_per_m3: 34.8
  correction_factor: 1.0
  billing_period_start: "2026-11-04"  # Optional. Update after reporting a reading.
```

| Cost option | Purpose |
| --- | --- |
| `effective_from` | First date for which the configured inputs apply. The supported MVM profile starts on 2024-08-01. |
| `discounted_ft_per_mj` | Gross discounted rate from your bill or local distributor's tariff, in Ft/MJ. |
| `market_ft_per_mj` | Gross above-allowance rate. Defaults to 22.002 Ft/MJ. |
| `base_ft_per_year` | Gross annual base fee. Defaults to 11,674 Ft for the standard A1 profile. Set to zero if there is no base fee. |
| `heating_value_mj_per_m3` | Heating value from your bill, in MJ/m³. |
| `correction_factor` | Meter volume correction factor from your bill. |
| `annual_allowance_mj` | Annual discounted energy allowance. Defaults to 63,645 MJ. |
| `monthly_weights` | Optional list of 12 nonnegative weights in January–December order. Defaults to the MVM monthly profile and scales to the configured annual allowance. |
| `billing_period_start` | Optional first calendar day of the current billing period. Set it to the next period's first day after each reading. |
| `opening_date` | Optional first day to use Home Assistant readings for that gas year. Must be on or after `effective_from`. |
| `opening_consumption_m3` | Total metered consumption from August 1 up to the start of `opening_date`, in m³. Set both opening fields together. |

The card converts recorded meter volume into MJ using your heating value and correction factor. It accumulates the MVM seasonal allowance from August 1 through July 31 and distributes each month's quota over its calendar days. Unused allowance carries forward within that year. When newly available allowance covers earlier usage above the cap, the difference is shown as an estimated tier correction. The total can be negative on a day with a correction. The card allocates one twelfth of the annual base fee per calendar month, then spreads that fee evenly across the days of the month.

Hover, tap, or use the arrow keys, Home and End to inspect each period and its cost breakdown. The three chart views cover 30 days, 12 calendar months, and up to four gas years. The latest day, month, and gas year are in progress. Missing days remain blank, and affected totals are marked as subtotals. After a gap the estimate starts with the next known day's allowance, so the earlier balance is unknown until the next gas year. Recent totals can lag if only Recorder statistics are available for today. The same configured inputs apply to all dates from their effective date. Estimates exclude one-off credits such as the January 2026 MVM credit.

If you have reliable meter readings from before Home Assistant started collecting data, set the two opening fields under `cost`:

```yaml
  opening_date: "2026-11-01"
  opening_consumption_m3: 150
```

The card uses the entered volume and the allowance accrued before that date to establish the starting balance. It uses the Recorder from the opening date onward for that gas year. The entered total has no daily breakdown, so earlier costs stay blank and totals spanning those days remain marked as partial. The opening balance only applies to its own gas year, and a later gap in the Recorder can make the balance uncertain again.

Sources: [MVM tariff tables](https://www.mvmnext.hu/foldgaz/egyetemes-szolgaltatas/ugyintezes/arak-dijszabasok/aktualis-arak), [seasonal allowance](https://www.mvmnext.hu/vallalati-informaciok/hirek-aktualitasok/aktualis/2024/08-01), [tier correction](https://www.mvmnext.hu/lakossagirezsi/gyakorikerdesek-foldgaz), and [January 2026 credit](https://www.mvmnext.hu/rezsistop/reszletes-informaciok).

## Migrate from Gas Meter Card

Install this card from its own HACS repository before updating Gas Meter Card. Add a new manual card, copy `consumption_entity` and the complete `cost:` block from the old configuration, and set the new card type to `custom:ha-card-gas-costs`. You can drop the old `cost.enabled` flag. Confirm the estimate appears, then remove the old `cost:` block from the meter card. Gas Meter Card 1.0.0 and later ignore that block.

## Develop and release

```sh
npm ci
npm test
npm run build
npx playwright-core install chromium
npm run test:browser
```

Use `GAS_COSTS_CHROMIUM` to point the browser tests at an existing Chromium executable. The bundle is built at `dist/ha-card-gas-costs.js`. Pushes and pull requests run the unit tests, build and browser tests.

To release, update the package version and lockfile, add a matching version section to `CHANGELOG.md`, and push the corresponding tag such as `v0.1.0`. GitHub Actions publishes the module as a release asset after the tests pass, verifies the asset and runs HACS validation. The release is the version HACS users can download. The module runs within the user's Home Assistant dashboard and reads data through the existing connection.
