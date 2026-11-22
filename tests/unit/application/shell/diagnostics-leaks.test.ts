import { Effect } from "effect";
import * as fc from "fast-check";
import { expect, it } from "vitest";
import { copyDiagnostics, reportDefect } from "../../../../src/application/shell";
import { shellFixture } from "../../../support/layers";

it("copies code frames without raw error content or directories", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.boolean(), async (input, realError) => {
      const privateMessage = `private-note-content:${input}`;
      const hiddenFolder = "personal-vault-folder";
      const error = new Error(privateMessage);
      error.stack = `Error: ${privateMessage}\n  at mount (C:/${hiddenFolder}/main.js:11:3)`;
      const fixture = shellFixture();

      await Effect.runPromise(
        Effect.gen(function* () {
          yield* reportDefect(realError ? error : privateMessage);
          yield* copyDiagnostics;
        }).pipe(Effect.provide(fixture.layer)),
      );

      const report = fixture.clipboard[0];
      expect(report).toContain("defect.reported T-1");
      expect(report).not.toContain(privateMessage);
      expect(report).not.toContain(hiddenFolder);
      expect(report?.includes("mount main.js:11:3")).toBe(realError);
    }),
    { numRuns: 50 },
  );
});
