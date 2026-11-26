import { Effect } from "effect";
import type { NfrCategory } from "../../domain/backlog";
import { PROTOTYPE_HTML_LIMIT } from "../../domain/prototypes";
import type { PrototypeId } from "../../domain/prototypes";
import { AgentChat, aiCapability, sameAiCapability } from "../integrations";
import type { ChatProvider } from "../integrations";
import type { ProjectId } from "../projects";
import { SettingsService } from "../shell";
import {
  prototypeInputFingerprint,
  samePrototypeArtifactBase,
  savePrototypeArtifact,
} from "./artifact";
import { readPrototype, resolvePrototypeBrief } from "./brief";
import { prototypeBriefMarkdown } from "./brief-markdown";
import { PrototypeError } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { prototypeOutputKind } from "./records";
import type { PrototypeRecord } from "./records";

export type PrototypeGenerationTarget = {
  readonly projectId: ProjectId;
  readonly prototypeId: PrototypeId;
};

export type PrototypeGenerationDestination =
  | { readonly kind: "provider"; readonly provider: ChatProvider; readonly label: string }
  | { readonly kind: "simulation"; readonly label: string };

export type PrototypeGenerationDisclosure = {
  readonly target: PrototypeGenerationTarget;
  readonly destination: PrototypeGenerationDestination;
  readonly instruction: string;
  readonly markdown: string;
};

export type PrototypeGenerationProvider = (
  disclosure: PrototypeGenerationDisclosure,
  signal: AbortSignal,
) => Promise<unknown>;

type PreparedGeneration = {
  readonly base: PrototypeRecord;
  readonly fingerprint: string;
  readonly replaceRequired: boolean;
  readonly scope: { readonly displayId: string; readonly title: string };
  readonly disclosure: PrototypeGenerationDisclosure;
};

type ConfirmedGeneration = {
  readonly signal: AbortSignal;
  readonly active: () => PrototypeGenerationTarget | undefined;
  readonly replace: boolean;
};

export function preparePrototypeGeneration(
  base: PrototypeRecord,
  destination: PrototypeGenerationDestination,
  language: "de" | "en",
  categoryLabel: (id: NfrCategory) => string = (id) => id,
) {
  return Effect.gen(function* () {
    const text = language === "en" ? en : de;
    const current = yield* readPrototype(base);
    const brief = yield* resolvePrototypeBrief(current);
    if (!brief.selection) return yield* new PrototypeError({ reason: "source" });
    return {
      base: current,
      fingerprint: yield* prototypeInputFingerprint(brief),
      replaceRequired: prototypeOutputKind(current) !== "none",
      scope: brief.selection,
      disclosure: {
        target: { projectId: current.projectId, prototypeId: current.id },
        destination,
        instruction: text.generation.instruction,
        markdown: prototypeBriefMarkdown(brief, text.brief, categoryLabel, language, false),
      },
    } satisfies PreparedGeneration;
  });
}

function abortResult(signal: AbortSignal) {
  return Effect.callback<never, PrototypeError>((resume) => {
    const onAbort = () =>
      resume(Effect.fail(new PrototypeError({ reason: "generationCancelled" })));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    return Effect.sync(() => signal.removeEventListener("abort", onAbort));
  });
}

function providerResult(
  disclosure: PrototypeGenerationDisclosure,
  signal: AbortSignal,
  provider: PrototypeGenerationProvider,
) {
  return Effect.raceFirst(
    Effect.tryPromise({
      try: (interrupted) => provider(disclosure, AbortSignal.any([signal, interrupted])),
      catch: (error) =>
        error instanceof PrototypeError
          ? error
          : new PrototypeError({
              reason: signal.aborted ? "generationCancelled" : "generationFailed",
            }),
    }),
    abortResult(signal),
  );
}

function verifyGeneration(
  preparation: PreparedGeneration,
  confirmation: ConfirmedGeneration,
  isCurrent: () => boolean,
) {
  return Effect.gen(function* () {
    const { base, fingerprint, disclosure, replaceRequired } = preparation;
    yield* checkActive(confirmation.signal, isCurrent);
    if (base.id !== disclosure.target.prototypeId || base.projectId !== disclosure.target.projectId)
      return yield* new PrototypeError({ reason: "outputChanged" });
    if (replaceRequired && !confirmation.replace)
      return yield* new PrototypeError({ reason: "generationReplacement" });
    const latest = yield* readPrototype(base);
    if (!samePrototypeArtifactBase(base, latest))
      return yield* new PrototypeError({ reason: "outputChanged" });
    const brief = yield* resolvePrototypeBrief(latest);
    if (fingerprint !== (yield* prototypeInputFingerprint(brief)))
      return yield* new PrototypeError({ reason: "outputChanged" });
    return latest;
  });
}

function checkActive(signal: AbortSignal, isCurrent: () => boolean) {
  return Effect.suspend(() => {
    if (signal.aborted) return Effect.fail(new PrototypeError({ reason: "generationCancelled" }));
    return isCurrent() ? Effect.void : Effect.fail(new PrototypeError({ reason: "outputChanged" }));
  });
}

function generatedHtml(response: string) {
  const fence = /^\s*```(?:html)?\r?\n([\s\S]*?)\r?\n```\s*$/iu;
  return fence.exec(response)?.[1] ?? response;
}

export function runPrototypeGeneration(
  preparation: PreparedGeneration,
  confirmation: ConfirmedGeneration,
  provider: PrototypeGenerationProvider,
) {
  return Effect.gen(function* () {
    const { base, fingerprint, disclosure } = preparation;
    const { signal, active } = confirmation;
    const isCurrent = () => {
      const current = active();
      return (
        current?.prototypeId === disclosure.target.prototypeId &&
        current.projectId === disclosure.target.projectId
      );
    };
    const latest = yield* verifyGeneration(preparation, confirmation, isCurrent);
    yield* checkActive(signal, isCurrent);
    const response = yield* providerResult(disclosure, signal, provider);
    yield* checkActive(signal, isCurrent);
    if (typeof response !== "string") return yield* new PrototypeError({ reason: "outputInvalid" });
    return yield* savePrototypeArtifact(
      base,
      {
        html: generatedHtml(response),
        fileName: latest.displayId + ".html",
        provenance: disclosure.destination.kind === "provider" ? "generated" : "simulation",
      },
      { fingerprint, signal, isCurrent },
    );
  });
}

export function dispatchPrototypeGeneration(
  preparation: PreparedGeneration,
  confirmation: ConfirmedGeneration,
  expected: ReturnType<typeof aiCapability>,
) {
  return Effect.gen(function* () {
    const { current } = yield* SettingsService;
    const chat = yield* AgentChat;
    const { destination } = preparation.disclosure;
    const provider = destination.kind === "simulation" ? "demo" : destination.provider;
    const active = () => {
      if (
        expected.enabled &&
        provider === expected.mode &&
        sameAiCapability(expected, aiCapability(Effect.runSync(current)))
      ) {
        return confirmation.active();
      }
    };

    return yield* runPrototypeGeneration(
      preparation,
      { ...confirmation, active },
      async ({ instruction, markdown }, signal) => {
        const messages = [
          { role: "user", content: instruction },
          { role: "user", content: markdown },
        ] as const;
        let response = "";
        for await (const chunk of chat.stream(
          { provider, purpose: "prototype-html", messages },
          signal,
        )) {
          response += chunk;
          // Cap buffered text and leave room for an optional fence. The save checks exact UTF-8 size.
          if (response.length > PROTOTYPE_HTML_LIMIT * 2)
            throw new PrototypeError({ reason: "outputTooLarge" });
        }
        return response;
      },
    );
  });
}
