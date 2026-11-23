import type {
  ProjectBaseCheck,
  ProjectCriterionType,
  ProjectDataClass,
  ProjectGatePhase,
  ProjectRole,
} from "../../../domain/projects";
import type { ProjectArtifactRuleId } from "../artifact-policy";
import type { ProjectMcpProbe } from "../../integrations";
import type { ProjectTemplateId } from "../templates";

export type ProjectsCatalog = {
  readonly title: string;
  readonly picker: string;
  readonly active: string;
  readonly project: string;
  readonly choose: string;
  readonly empty: string;
  readonly unavailable: string;
  readonly missing: string;
  readonly missingRecord: string;
  readonly openRecord: string;
  readonly returnToOrigin: string;
  readonly loading: string;
  readonly create: string;
  readonly createTitle: string;
  readonly cancel: string;
  readonly name: string;
  readonly description: string;
  readonly repository: string;
  readonly folder: string;
  readonly branch: string;
  readonly base: string;
  readonly overview: string;
  readonly administration: string;
  readonly navigation: string;
  readonly openNavigation: string;
  readonly collapse: string;
  readonly expand: string;
  readonly copilot: string;
  readonly search: {
    readonly open: string;
    readonly title: (name: string) => string;
    readonly query: string;
    readonly filter: string;
    readonly all: string;
    readonly sections: string;
    readonly records: string;
    readonly empty: string;
  };
  readonly groups: Readonly<Record<"project" | "planning" | "delivery" | "administration", string>>;
  readonly repairBase: string;
  readonly saveProject: string;
  readonly locationHint: string;
  readonly backlogPath: string;
  readonly reloadProject: string;
  readonly fieldConflict: string;
  readonly artifacts: {
    readonly title: string;
    readonly help: string;
    readonly fixed: string;
    readonly unavailable: string;
    readonly labels: Readonly<Record<ProjectArtifactRuleId, string>>;
  };
  readonly definitions: {
    readonly title: string;
    readonly version: (version: number) => string;
    readonly help: string;
    readonly empty: string;
    readonly add: string;
    readonly edit: string;
    readonly save: string;
    readonly criterion: string;
    readonly type: string;
    readonly enabled: string;
    readonly disabled: string;
    readonly phases: Readonly<Record<ProjectGatePhase, string>>;
    readonly baseChecks: Readonly<Record<ProjectBaseCheck, string>>;
    readonly types: Readonly<Record<ProjectCriterionType, string>>;
    readonly errors: Readonly<Record<"title" | "type" | "unavailable" | "conflict", string>>;
  };
  readonly templates: {
    readonly title: string;
    readonly empty: string;
    readonly create: (name: string) => string;
    readonly groups: Readonly<Record<"product" | "concepts", string>>;
    readonly labels: Readonly<Record<ProjectTemplateId, string>>;
  };
  readonly integrations: {
    readonly title: string;
    readonly unconfigured: string;
    readonly contract: string;
    readonly packageHelp: string;
    readonly scope: string;
    readonly scopeHelp: string;
    readonly test: string;
    readonly settings: string;
    readonly classify: string;
    readonly saveClass: string;
    readonly classes: Readonly<Record<ProjectDataClass, string>>;
    readonly results: Readonly<Record<ProjectMcpProbe, string>>;
    readonly errors: Readonly<Record<"data_class" | "settings", string>>;
  };
  readonly team: {
    readonly title: string;
    readonly add: string;
    readonly name: string;
    readonly role: string;
    readonly empty: string;
    readonly roles: Readonly<Record<ProjectRole, string>>;
    readonly errors: Readonly<Record<"name" | "role" | "duplicate" | "unavailable", string>>;
  };
  readonly errors: {
    readonly invalid: string;
    readonly name: string;
    readonly description: string;
    readonly repository: string;
    readonly branch: string;
    readonly vault_folder: string;
    readonly backlog_base: string;
    readonly folder: string;
    readonly base: string;
    readonly identity: string;
  };
};
