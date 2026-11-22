import { it } from "@effect/vitest";
import { Cause, Effect } from "effect";
import { expect } from "vitest";
import { reportDefect, reportUnexpected } from "../../../../src/application/shell";
import { shellFixture } from "../../../support/layers";

it.effect("reports defects once with an incident and ignores plain interruptions", () => {
  const fixture = shellFixture();
  return Effect.gen(function* () {
    yield* reportUnexpected(Cause.interrupt());
    expect(fixture.notices).toHaveLength(0);

    const message = yield* reportDefect(new Error("private"));
    expect(message).toEqual({
      severity: "error",
      title: "Bei Product Engineering ist ein Problem aufgetreten",
      detail: "Melde den Vorfall T-1 in den GitHub Issues von Product Engineering.",
      link: "https://github.com/Luis85/product-engineering/issues",
    });
    expect(fixture.notices).toEqual([message]);
    expect(fixture.log).toMatchObject([
      {
        level: "error",
        event: "defect.reported",
        incidentId: "T-1",
        error: { name: "Error", message: "private" },
      },
    ]);
    yield* reportUnexpected(Cause.die("another defect"));
    expect(fixture.log[1]).toMatchObject({ incidentId: "T-2", error: { name: "NonError" } });
    expect(fixture.notices).toHaveLength(2);
  }).pipe(Effect.provide(fixture.layer));
});
