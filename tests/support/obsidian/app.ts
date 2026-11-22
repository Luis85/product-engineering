import { Workspace } from "./workspace";

export class App {
  readonly workspace: Workspace;

  constructor({ document: owner = document, layoutReady = true } = {}) {
    this.workspace = new Workspace(owner, layoutReady);
  }
}
