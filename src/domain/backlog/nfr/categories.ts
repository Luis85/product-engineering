export const nfrStandards = {
  "25010": "ISO/IEC 25010:2023",
  "27001": "ISO/IEC 27001:2022",
} as const;

export const nfrCategories = [
  ["functional-suitability", "25010", "Funktionale Eignung"],
  ["performance-efficiency", "25010", "Leistungseffizienz"],
  ["compatibility", "25010", "Kompatibilität"],
  ["interaction-capability", "25010", "Interaktionsfähigkeit"],
  ["reliability", "25010", "Zuverlässigkeit"],
  ["security", "25010", "Informationssicherheit"],
  ["maintainability", "25010", "Wartbarkeit"],
  ["flexibility", "25010", "Flexibilität"],
  ["safety", "25010", "Schutz vor Schäden (Safety)"],
  ["organizational", "27001", "Organisatorische Maßnahmen"],
  ["people", "27001", "Personenbezogene Maßnahmen"],
  ["physical", "27001", "Physische Maßnahmen"],
  ["technological", "27001", "Technische Maßnahmen"],
] as const;

export type NfrCategory = (typeof nfrCategories)[number][0];

export const nfrKey = (value: string) => value.trim().normalize("NFC").toLocaleLowerCase("de");

export function matchNfrCategory(token: string): NfrCategory | undefined {
  const match = /^(?:(?:ISO(?:\/IEC)?\s+)?(25010|27001)\s*:\s*)?(.+)$/i.exec(token);
  if (!match?.[2]) return;
  const term = nfrKey(match[2]);
  return nfrCategories.find(
    ([id, standard, label]) =>
      (!match[1] || standard === match[1]) && (id === term || nfrKey(label) === term),
  )?.[0];
}
