import { Layer } from "effect";
import { catalogOf } from "./module";
import type { CatalogOf } from "./module";
import { APP_MODULES } from "./modules";
import type { AppModule } from "./modules";
import { LANGUAGES, Messages } from "./shell";
import type { Language } from "./shell";

export type Catalog = CatalogOf<AppModule>;

const catalogs: Readonly<Record<Language, Catalog>> = {
  en: catalogOf(APP_MODULES, "en"),
  de: catalogOf(APP_MODULES, "de"),
};

export function catalogFor(language: Language): Catalog {
  return catalogs[language];
}

export function languageFromCode(code: string): Language {
  const normalized = code.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((language) => language === normalized) ?? LANGUAGES[0];
}

export const messagesLayer = (language: Language) => Layer.succeed(Messages, catalogFor(language));
