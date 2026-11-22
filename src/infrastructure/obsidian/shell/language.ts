import { getLanguage } from "obsidian";
import { languageFromCode } from "../../../application/messages";
import type { Language } from "../../../application/shell";

export function hostLanguage(): Language {
  return languageFromCode(getLanguage());
}
