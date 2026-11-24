import { Result, Schema } from "effect";
import { backlogIdSchema, backlogKinds, nfrIdSchema } from "../backlog";
import { knowledgeId } from "../knowledge";
import { defineNoteType, lineOfText, number, recordIdIssue, required, text } from "../notes";
import { projectIdSchema } from "../projects";
import { storyMapIdSchema } from "../story-maps";

export const prototypeIdSchema = Schema.TemplateLiteral(["prototype-", Schema.String]).check(
  Schema.makeFilter((value) => recordIdIssue("prototype", value) === undefined),
);
export const isPrototypeId = Schema.is(prototypeIdSchema);
export type PrototypeId = typeof prototypeIdSchema.Type;

const itemSource = Schema.Struct({
  projectId: projectIdSchema,
  kind: Schema.Literals(backlogKinds),
  id: backlogIdSchema,
}).check(Schema.makeFilter(({ kind, id }) => id.startsWith(kind + "-")));
const sourceSchema = Schema.Union([
  itemSource,
  Schema.Struct({ projectId: projectIdSchema, kind: Schema.Literal("map"), id: storyMapIdSchema }),
  Schema.Struct({ projectId: projectIdSchema, kind: Schema.Literal("nfr"), id: nfrIdSchema }),
]);
export const isPrototypeSource = Schema.is(sourceSchema);
export type PrototypeSource = typeof sourceSchema.Type;
export const prototypeSourceKinds = [...backlogKinds, "map", "nfr"] as const;
export const prototypeDesignKinds = ["style-guide", "design-system"] as const;
export type PrototypeDesignKind = (typeof prototypeDesignKinds)[number];
export const prototypeDesignFields = {
  "style-guide": "style_guide_id",
  "design-system": "design_system_id",
} as const;

const nonBlank = Schema.makeFilter((value: string) => Boolean(value.trim()));
const revision = number({
  schema: Schema.Int.check(
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
  issue: "revision.invalid",
});
export const prototypeType = defineNoteType({
  type: "prototype",
  version: 1,
  folder: "Prototypes",
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    display_id: required(
      text({
        schema: lineOfText(32).check(Schema.isPattern(/^PT-[0-9]{2,}$/)),
        issue: "id.invalid",
      }),
    ),
    title: required(text({ schema: lineOfText(160).check(nonBlank), issue: "title.invalid" })),
    description: text({
      schema: Schema.String.check(Schema.isMaxLength(12000)),
      issue: "description.invalid",
    }),
    revision,
    source_kind: text({ schema: Schema.Literals(prototypeSourceKinds), issue: "source.invalid" }),
    source_project_id: text({ schema: projectIdSchema, issue: "project.invalid" }),
    source_id: text({ schema: lineOfText(160), issue: "source.invalid" }),
    style_guide_id: text({ schema: knowledgeId, issue: "knowledge.invalid" }),
    design_system_id: text({ schema: knowledgeId, issue: "knowledge.invalid" }),
    output_html: text(),
    output_file_name: text({ schema: lineOfText(255), issue: "output.invalid" }),
    output_revision: revision,
    output_input_fingerprint: text(),
    output_provenance: text({
      schema: Schema.Literals(["manual", "legacy", "import", "generated", "simulation"]),
      issue: "output.invalid",
    }),
    uc: text({ schema: backlogIdSchema.check(Schema.isPattern(/^UC-/)), issue: "source.invalid" }),
    rev: revision,
    label: text(),
  },
  migrations: {},
});

export const prototypeBriefFields = ["title", "description"] as const;
export function invalidPrototypeBriefField(
  field: (typeof prototypeBriefFields)[number],
  value: string,
) {
  return !value.trim() || Result.isFailure(prototypeType.fields[field].check(value.trim()));
}

export function prototypeSourceKey({ kind, id }: Pick<PrototypeSource, "kind" | "id">) {
  return `${kind}:${id}`;
}

export const PROTOTYPE_HTML_LIMIT = 2 * 1024 * 1024;
const htmlStart =
  /^\s*(?:(?:<!doctype\s+html[^>]*>|<!--[\s\S]*?-->)\s*)*<[a-z][\w-]*(?:\s[^<>]*|\s*\/?)>/iu;

export function prototypeHtmlIssue(html: string) {
  if (new TextEncoder().encode(html).byteLength > PROTOTYPE_HTML_LIMIT) return "outputTooLarge";
  if (!htmlStart.test(html) || html.includes("\0") || /\p{Surrogate}/u.test(html))
    return "outputInvalid";
}

export function prototypeHtmlName(name: string) {
  return (
    !/[\\/]/.test(name) &&
    /\S.*\.html?$/iu.test(name) &&
    Result.isSuccess(prototypeType.fields.output_file_name.check(name))
  );
}
