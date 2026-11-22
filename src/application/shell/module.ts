import { defineModule } from "../module";
import { shellCommands } from "./commands";
import { de } from "./i18n/de";
import { describeShellError } from "./i18n/describe";
import { en } from "./i18n/en";

export const shellModule = defineModule({
  name: "shell",
  catalog: { en, de },
  errors: {
    tags: {
      StorageError: true,
      ReadOnlySettingsError: true,
      InvalidSettingsError: true,
      VaultReadError: true,
      ClipboardError: true,
    },
    describe: describeShellError,
  },
  commands: shellCommands,
});
