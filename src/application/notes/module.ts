import { defineModule } from "../module";
import { NOTES_ERROR_TAG_KEYS } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { describeNotesError } from "./user-messages";

export const notesModule = defineModule({
  name: "notes",
  catalog: { en, de },
  errors: { tags: NOTES_ERROR_TAG_KEYS, describe: describeNotesError },
});
