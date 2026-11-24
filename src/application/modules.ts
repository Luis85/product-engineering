import { domainModelModule } from "./domain-model";
import { backlogModule } from "./backlog";
import { featureRequestsModule } from "./feature-requests";
import { artifactGitModule } from "./git";
import { integrationsModule } from "./integrations";
import { itemsModule } from "./items";
import { knowledgeModule } from "./knowledge";
import { notesModule } from "./notes";
import { projectsModule } from "./projects";
import { prototypesModule } from "./prototypes";
import { shellModule } from "./shell";
import { storyMapsModule } from "./story-maps";

export const APP_MODULES = [
  shellModule,
  notesModule,
  itemsModule,
  integrationsModule,
  projectsModule,
  knowledgeModule,
  domainModelModule,
  artifactGitModule,
  backlogModule,
  storyMapsModule,
  prototypesModule,
  featureRequestsModule,
] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModuleName = AppModule["name"];
