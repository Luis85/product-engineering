import { Effect, Result } from "effect";
import { sameFrontmatterValue } from "../../domain/notes";
import { prototypeHtmlIssue, prototypeHtmlName } from "../../domain/prototypes";
import { resolvePrototypeBrief } from "./brief";
import type { ResolvedPrototypeBrief } from "./brief";
import { PrototypeError } from "./errors";
import { decodePrototype } from "./records";
import type { PrototypeRecord } from "./records";
import { withCurrentPrototype } from "./write";

type Provenance = "manual" | "import" | "generated" | "simulation";
export type PrototypeArtifact = {
  readonly html: string;
  readonly fileName: string;
  readonly provenance: Provenance;
};

const protectedFields = [
  "title",
  "description",
  "revision",
  "rev",
  "source_kind",
  "source_project_id",
  "source_id",
  "uc",
  "label",
  "style_guide_id",
  "design_system_id",
  "output_html",
  "output_revision",
  "output_file_name",
  "output_provenance",
  "output_input_fingerprint",
] as const;

export function samePrototypeArtifactBase(left: PrototypeRecord, right: PrototypeRecord) {
  return (
    left.id === right.id &&
    left.projectId === right.projectId &&
    protectedFields.every((field) => sameFrontmatterValue(left.values[field], right.values[field]))
  );
}

export function prototypeInputFingerprint(brief: ResolvedPrototypeBrief) {
  return Effect.promise(async () => {
    const contents = new TextEncoder().encode(JSON.stringify(brief));
    const hash = await crypto.subtle.digest("SHA-256", contents);
    return (
      "v1:" +
      Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
    );
  });
}

export function currentPrototypeFingerprint(record: PrototypeRecord) {
  return Effect.flatMap(resolvePrototypeBrief(record), prototypeInputFingerprint);
}

export function inspectPrototypeBrief(record: PrototypeRecord) {
  return Effect.gen(function* () {
    const brief = yield* resolvePrototypeBrief(record);
    const fingerprint = record.values.output_input_fingerprint
      ? yield* prototypeInputFingerprint(brief)
      : undefined;
    return { brief, fingerprint };
  });
}

export function savePrototypeArtifact(
  base: PrototypeRecord,
  artifact: PrototypeArtifact,
  guard?: {
    readonly fingerprint: string;
    readonly signal: AbortSignal;
    readonly isCurrent: () => boolean;
  },
) {
  return Effect.gen(function* () {
    const issue = prototypeHtmlIssue(artifact.html);
    if (issue || !prototypeHtmlName(artifact.fileName))
      return yield* new PrototypeError({ reason: issue ?? "outputInvalid" });
    return yield* withCurrentPrototype(base, (current, store) =>
      Effect.gen(function* () {
        if (!samePrototypeArtifactBase(base, current))
          return yield* new PrototypeError({ reason: "outputChanged" });
        const brief = yield* resolvePrototypeBrief(current);
        if (!brief.selection)
          return yield* new PrototypeError({ reason: guard ? "outputChanged" : "source" });
        const fingerprint = yield* prototypeInputFingerprint(brief);
        if (guard && guard.fingerprint !== fingerprint)
          return yield* new PrototypeError({ reason: "outputChanged" });
        return yield* store.update(current.path, (frontmatter) => {
          if (guard?.signal.aborted)
            return Result.fail(new PrototypeError({ reason: "generationCancelled" }));
          if (guard && !guard.isCurrent())
            return Result.fail(new PrototypeError({ reason: "outputChanged" }));
          const latest = decodePrototype({ path: current.path, frontmatter });
          if (!latest || !samePrototypeArtifactBase(current, latest))
            return Result.fail(new PrototypeError({ reason: "outputChanged" }));
          return Result.succeed({
            set: {
              output_html: artifact.html,
              output_file_name: artifact.fileName,
              output_revision: current.revision,
              output_provenance: artifact.provenance,
              output_input_fingerprint: fingerprint,
            },
          });
        });
      }),
    );
  });
}

export function importPrototypeHtml(base: PrototypeRecord, html: string, fileName?: string) {
  return savePrototypeArtifact(base, {
    html,
    fileName: fileName ?? base.displayId + ".html",
    provenance: fileName ? "import" : "manual",
  });
}

export function recordedPrototypeArtifact({ displayId, values }: PrototypeRecord) {
  if (!values.output_html) return;
  return {
    html: values.output_html,
    fileName: values.output_file_name || displayId + ".html",
    provenance: values.output_provenance ?? "manual",
  };
}
