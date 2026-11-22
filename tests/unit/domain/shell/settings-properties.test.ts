import * as fc from "fast-check";
import { expect, it } from "vitest";
import { decodeSettings, encodeSettings, LOG_LEVELS } from "../../../../src/domain/shell";

it("round-trips domain settings and can reopen arbitrary inputs", () => {
  fc.assert(
    fc.property(fc.anything(), (raw) => {
      const { settings } = decodeSettings(raw);
      expect(LOG_LEVELS).toContain(settings.logLevel);
      expect(decodeSettings(encodeSettings(settings))).toEqual({ settings, issues: [] });
    }),
  );
});
