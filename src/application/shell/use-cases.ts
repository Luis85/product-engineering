import { Effect } from "effect";
import { SettingsService } from "./settings-service";

export function setLogLevel(value: unknown) {
  return Effect.flatMap(SettingsService, (service) => service.update({ logLevel: value }));
}
