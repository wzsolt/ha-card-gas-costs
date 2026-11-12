const en = {
  cost: "Estimated gas cost", costPeriod: "Cost charts",
  costDailyCharge: "Daily gas charge and base fee", costNetBalance: "Balance after corrections",
  cost_daily: "30 days", cost_monthly: "12 months", cost_yearly: "Gas years",
  costToday: "Today", costMonth: "This month", costYear: "This gas year", costBilling: "Current billing period",
  costDiscount: "Discounted", costMarket: "Above allowance", costBase: "Base fee",
  costMonthCharge: "Current month’s charges", costEarlierCorrection: "Earlier months’ estimated correction",
  costCorrection: "Estimated tier correction", costIncomplete: "Subtotal · missing days",
  costUncertainShort: "Earlier allowance unknown", costDelayed: "Recorder data may lag",
  costUncertain: "Earlier consumption is missing. The previous unused allowance is unknown.",
  costHistoryError: "Could not load earlier Recorder data.",
  costEstimate: "MVM residential estimate. A gas year runs August–July. One-off bill credits are excluded.",
  costSettings: "Check the tariff and opening balance in the card settings.",
  costFuture: "The configured tariff is not yet effective.",
  costOpeningFuture: "The opening date is in the future.",
  costSensor: "The gas consumption sensor is unavailable.",
  costUnit: "The cost estimate requires a gas consumption sensor in m³.",
  effective_from: "Tariff effective from",
  billing_period_start: "First day of current billing period (optional)",
  opening_date: "First day to use Home Assistant readings (optional)",
  opening_consumption_m3: "Gas used before the opening date (m³)",
  openingConsumptionHelp: "Enter the total from August 1 up to the start of the opening date.",
  discounted_ft_per_mj: "Gross discounted rate (Ft/MJ)", market_ft_per_mj: "Gross above-allowance rate (Ft/MJ)",
  base_ft_per_year: "Gross annual base fee (Ft)", heating_value_mj_per_m3: "Heating value (MJ/m³)",
  correction_factor: "Meter volume correction factor", annual_allowance_mj: "Annual discounted allowance (MJ)",
  monthly_weights: "Monthly allowance weights (January–December)",
  monthlyWeightsHelp: "Leave blank for the MVM profile, or enter 12 comma-separated weights.",
  title: "Title", consumption_entity: "Gas consumption sensor",
  loading: "Loading Recorder data…", error: "Could not load Recorder data.",
  empty: "No Recorder data for this period.", configure: "Select a sensor in the card settings.",
  missing: "No data", partial: "in progress", tooltipHelp: "Select a bar or use the arrow keys.",
};

const hu = {
  cost: "Becsült gázköltség", costPeriod: "Költséggrafikonok",
  costDailyCharge: "Napi gázdíj és alapdíj", costNetBalance: "Egyenleg korrekcióval",
  cost_daily: "30 nap", cost_monthly: "12 hónap", cost_yearly: "Kedvezményes évek",
  costToday: "Ma", costMonth: "Ebben a hónapban", costYear: "Ebben a kedvezményes évben",
  costBilling: "Aktuális diktálási időszak",
  costDiscount: "Kedvezményes díj", costMarket: "Kereten túli díj", costBase: "Alapdíj",
  costMonthCharge: "E havi díjak", costEarlierCorrection: "Korábbi hónapok becsült sávkorrekciója",
  costCorrection: "Becsült sávkorrekció", costIncomplete: "Részösszeg · hiányzó napok",
  costUncertainShort: "Korábbi keret ismeretlen", costDelayed: "A Recorder adatai késhetnek",
  costUncertain: "Korábbi fogyasztási adatok hiányoznak, így az akkori keretmaradvány ismeretlen.",
  costHistoryError: "A korábbi Recorder-adatok nem tölthetők be.",
  costEstimate: "MVM lakossági becslés. A kedvezményes év augusztustól júliusig tart. Az egyedi számlajóváírások nem szerepelnek benne.",
  costSettings: "Ellenőrizd a tarifát és a kezdőértéket a kártya beállításaiban.",
  costFuture: "A beállított tarifa még nem érvényes.",
  costOpeningFuture: "A megadott kezdődátum a jövőben van.",
  costSensor: "A gázfogyasztás-szenzor nem érhető el.",
  costUnit: "A költségbecsléshez m³-ben mérő gázfogyasztás-szenzor szükséges.",
  effective_from: "A tarifa érvényességének kezdete",
  billing_period_start: "Aktuális diktálási időszak első napja (opcionális)",
  opening_date: "Home Assistant adatok kezdődátuma (opcionális)",
  opening_consumption_m3: "Kezdődátum előtti gázfogyasztás (m³)",
  openingConsumptionHelp: "Az augusztus 1. és a kezdődátum kezdete közötti összes fogyasztást add meg.",
  discounted_ft_per_mj: "Bruttó kedvezményes ár (Ft/MJ)", market_ft_per_mj: "Bruttó kereten túli ár (Ft/MJ)",
  base_ft_per_year: "Bruttó éves alapdíj (Ft)", heating_value_mj_per_m3: "Fűtőérték (MJ/m³)",
  correction_factor: "Korrekciós tényező", annual_allowance_mj: "Éves kedvezményes keret (MJ)",
  monthly_weights: "Havi keretsúlyok (januártól decemberig)",
  monthlyWeightsHelp: "Üresen az MVM jelleggörbéjét használja, vagy adj meg 12 vesszővel elválasztott súlyt.",
  title: "Cím", consumption_entity: "Gázfogyasztás-szenzor",
  loading: "Recorder-adatok betöltése…",
  error: "A Recorder-adatok nem tölthetők be.", empty: "Erre az időszakra nincs Recorder-adat.",
  configure: "Válassz szenzort a kártya beállításaiban.", missing: "Nincs adat",
  partial: "folyamatban", tooltipHelp: "Válassz egy oszlopot, vagy használd a nyílbillentyűket.",
};

export function localeFor(hass) {
  return hass.locale?.language || hass.language || "en";
}

export function labels(hass) {
  return /^hu\b/i.test(localeFor(hass)) ? hu : en;
}

export function theme(element, hass) {
  element.dataset.themeMode = hass.themes?.darkMode ? "dark" : "light";
}
