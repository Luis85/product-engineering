import { domainModelModule } from "./domain-model";
import { artifactGitModule } from "./git";
import { integrationsModule } from "./integrations";
import { itemsModule } from "./items";
import { knowledgeModule } from "./knowledge";
import { notesModule } from "./notes";
import { projectsModule } from "./projects";
import { shellModule } from "./shell";

export const APP_MODULES = [
  shellModule,
  notesModule,
  itemsModule,
  integrationsModule,
  projectsModule,
  knowledgeModule,
  domainModelModule,
  artifactGitModule,
] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModuleName = AppModule["name"];
