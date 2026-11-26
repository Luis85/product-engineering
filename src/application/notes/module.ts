import { defineModule } from "../module";
import { NOTES_ERROR_TAG_KEYS } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { DATA_ISSUES_SECTION } from "./routes";
import { describeNotesError } from "./user-messages";

export const notesModule = defineModule({
  name: "notes",
  catalog: { en, de },
  errors: { tags: NOTES_ERROR_TAG_KEYS, describe: describeNotesError },
  sections: [{ id: DATA_ISSUES_SECTION, order: 900 }],
});
