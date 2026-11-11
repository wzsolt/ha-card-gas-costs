export const CARD_TYPE = "ha-card-gas-costs";

export function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Gas Costs Card requires a configuration object.");
  }
  if (config.consumption_entity && !/^sensor\.[a-z0-9_]+$/.test(config.consumption_entity)) {
    throw new Error("consumption_entity must be a sensor entity ID.");
  }
  return { ...config, title: typeof config.title === "string" ? config.title.trim() : "" };
}
