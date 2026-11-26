import { Schema } from "effect";
import { defineNoteType, required, text } from "../notes";
import { projectIdSchema } from "../projects";
export {
  COPILOT_PROPOSAL_LIMIT,
  isCopilotProposalContent,
  parseCopilotProposal,
  safeProposalMarkdown,
} from "./proposal";
export type { CopilotProposalContent } from "./proposal";

export const copilotModes = ["ask", "review", "draft", "revise"] as const;
export type CopilotMode = (typeof copilotModes)[number];
export const copilotDraftKinds = ["vision", "jtbd", "research", "prd"] as const;
export type CopilotDraftKind = (typeof copilotDraftKinds)[number];

const composer = Schema.Struct({
  activeId: Schema.String,
  prompt: Schema.String,
  mode: Schema.Literals(copilotModes),
  selected: Schema.Array(Schema.String),
  locked: Schema.Boolean,
  kind: Schema.optionalKey(Schema.Literals(copilotDraftKinds)),
  target: Schema.optionalKey(Schema.String),
});

const message = Schema.Union([
  Schema.Struct({ role: Schema.Literal("user"), content: Schema.String }),
  Schema.Struct({
    role: Schema.Literal("assistant"),
    content: Schema.String,
    sources: Schema.optionalKey(Schema.Array(Schema.String)),
  }),
]);

const thread = Schema.Struct({
  id: Schema.String,
  selected: Schema.Array(Schema.String),
  messages: Schema.Array(message),
  mode: Schema.optionalKey(Schema.Literals(copilotModes)),
  target: Schema.optionalKey(Schema.String),
});

const threads = Schema.Array(thread);
const composerJson = Schema.fromJsonString(composer);
const threadsJson = Schema.fromJsonString(threads);

export type CopilotComposer = typeof composer.Type;
export type CopilotThread = typeof thread.Type;
export const decodeCopilotComposer = Schema.decodeUnknownOption(composerJson);
export const decodeCopilotThreads = Schema.decodeUnknownOption(threadsJson);

export const copilotType = defineNoteType({
  type: "copilot",
  version: 1,
  folder: "Copilot",
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    instructions: text(),
    composer: text(),
    threads: text(),
  },
  migrations: {},
});
