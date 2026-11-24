import { Schema } from "effect";
import type { NfrCsvPreview, NfrDraft, NfrId, NfrTarget } from "../../../domain/backlog";
import type { Frontmatter } from "../../../domain/notes";
import type { ProjectId } from "../../projects";
import type { NfrOrigin } from "./scope";

export class NfrError extends Schema.TaggedError<NfrError>()("NfrError", {
  reason: Schema.Literals([
    "scope",
    "fields",
    "owner",
    "conflict",
    "missing",
    "stale",
    "target",
    "index",
    "identity",
  ]),
}) {}

export type NfrRecord = NfrDraft & {
  readonly id: NfrId;
  readonly projectId: ProjectId;
  readonly path: string;
  readonly frontmatter: Frontmatter;
  readonly targets: readonly NfrTarget[];
};
export type NfrSnapshot = {
  readonly ready: boolean;
  readonly failed: boolean;
  readonly records: readonly NfrRecord[];
  readonly invalid: readonly {
    readonly path: string;
    readonly label: string;
    readonly id: NfrId | undefined;
  }[];
};
export type NfrTargetOption = NfrOrigin & NfrTarget;
export type NfrImportPlan = {
  readonly projectId: ProjectId;
  readonly source: string;
  readonly preview: NfrCsvPreview;
  readonly identities: ReadonlyMap<number, NfrId>;
};
export type NfrImportResult =
  | { readonly state: "changed"; readonly preview: NfrCsvPreview }
  | { readonly state: "saved"; readonly created: number; readonly skipped: number };
