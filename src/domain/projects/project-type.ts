import { Schema } from "effect";
import { defineNoteType, fitsFileName, lineOfText, required, text } from "../notes";

const name = lineOfText(100).check(
  Schema.makeFilter((value) => value.trim().length > 0 && fitsFileName(value, "Project")),
);
const description = lineOfText(500).check(Schema.makeFilter((value) => value.trim().length > 0));
const repository = lineOfText(250).check(Schema.isPattern(/^[\w-][\w.-]*(?:\/[\w-][\w.-]*)+$/));
const branch = lineOfText(250).check(Schema.makeFilter((value) => value.trim().length > 0));
const backlogBase = lineOfText(250).check(
  Schema.isPattern(/^[^./\\<>:"|?*][^/\\<>:"|?*]*\.base$/i),
);

export const projectType = defineNoteType({
  type: "project",
  version: 1,
  folder: "Projects",
  fields: {
    name: required(text({ schema: name, issue: "name.invalid" })),
    description: required(text({ schema: description, issue: "description.invalid" })),
    repository: required(text({ schema: repository, issue: "repository.invalid" })),
    branch: required(text({ schema: branch, issue: "branch.invalid" })),
    backlog_base: required(text({ schema: backlogBase, issue: "backlog_base.invalid" })),
  },
  migrations: {},
});
