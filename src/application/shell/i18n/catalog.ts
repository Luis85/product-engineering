export const LANGUAGES = ["en", "de"] as const;

export type Language = (typeof LANGUAGES)[number];

export interface ShellCatalog {
  readonly language: Language;
}
