// Per-agency colors — the single source of truth for vehicle icons, the legend,
// and popups. Tuned to be distinct and readable on both light and dark basemaps
// (icons also get a contrasting outline).

export const AGENCY_COLORS: Record<string, string> = {
  KCM: "#3f8a3f", // King County Metro — green
  ST: "#2b376e", // Sound Transit — navy
  CT: "#00857a", // Community Transit — teal
  PT: "#b3122a", // Pierce Transit — red
  KT: "#5b3b8c", // Kitsap Transit — indigo
  ET: "#e07b00", // Everett Transit — orange
  WSF: "#00674b", // Washington State Ferries — WSDOT green
};

export const DEFAULT_AGENCY_COLOR = "#4b5563";

export function agencyColor(code: string): string {
  return AGENCY_COLORS[code] ?? DEFAULT_AGENCY_COLOR;
}
