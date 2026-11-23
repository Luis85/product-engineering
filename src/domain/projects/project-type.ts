import { Schema } from "effect";
import {
  checkbox,
  defineNoteType,
  fitsFileName,
  lineOfText,
  noteNameIssue,
  required,
  text,
} from "../notes";
import { projectTeamField } from "./team";
import { projectReleaseRulesField } from "./release-rules";
import { projectDataClassField } from "./integrations";

const name = lineOfText(100).check(
  Schema.makeFilter((value) => value.trim().length > 0 && fitsFileName(value, "Project")),
);
const description = lineOfText(500).check(Schema.makeFilter((value) => value.trim().length > 0));
const repository = lineOfText(250).check(
  Schema.isPattern(/^(?:[\w-][\w.-]*(?:\/[\w-][\w.-]*)+)?$/),
);
const branch = lineOfText(250).check(Schema.makeFilter((value) => value.trim().length > 0));
const reservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const validSegment = (value: string) =>
  value === value.trim() &&
  !value.endsWith(".") &&
  !noteNameIssue(value) &&
  !reservedName.test(value);
const vaultFolder = lineOfText(250).check(
  Schema.makeFilter((value) => value === "/" || value.split("/").every(validSegment)),
);
const backlogBase = lineOfText(250).check(
  Schema.isPattern(/^[^./\\<>:"|?*][^/\\<>:"|?*]*\.base$/i),
);

export const validBacklogBaseName = (value: string) =>
  validSegment(value) && /\.base$/i.test(value);

export const projectType = defineNoteType({
  type: "project",
  version: 1,
  folder: "Projects",
  fields: {
    name: required(text({ schema: name, issue: "name.invalid" })),
    description: required(text({ schema: description, issue: "description.invalid" })),
    repository: text({ schema: repository, issue: "repository.invalid" }),
    branch: required(text({ schema: branch, issue: "branch.invalid" })),
    vault_folder: text({ schema: vaultFolder, issue: "vault_folder.invalid" }),
    backlog_base: required(text({ schema: backlogBase, issue: "backlog_base.invalid" })),
    team: projectTeamField,
    research_jtbd_required: checkbox(),
    integration_adr_required: checkbox(),
    release_rules: projectReleaseRulesField,
    data_class: projectDataClassField,
    mcp_read: checkbox(),
  },
  migrations: {},
});
