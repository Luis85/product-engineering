import { Cause, Effect } from "effect";
import { describeDefect } from "./i18n/describe";
import { toLoggedError } from "./logged-error";
import { Incidents, Logger, Messages, Notifier } from "./ports";

export const reportDefect = (cause: unknown) =>
  Effect.gen(function* () {
    const logger = yield* Logger;
    const notifier = yield* Notifier;
    const { shell: messages } = yield* Messages;
    const incidents = yield* Incidents;
    const incidentId = yield* incidents.nextId;
    const message = describeDefect(incidentId, messages);

    yield* logger.log({
      level: "error",
      event: "defect.reported",
      incidentId,
      error: toLoggedError(cause),
    });
    yield* notifier.notify(message);
    return message;
  });

export const reportUnexpected = (cause: Cause.Cause<unknown>) =>
  Cause.hasInterruptsOnly(cause) ? Effect.void : Effect.asVoid(reportDefect(Cause.squash(cause)));
