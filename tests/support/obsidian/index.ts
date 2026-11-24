export { App } from "./app";
export { Component } from "./component";
export { installDomExtensions } from "./dom";
export { Events } from "./events";
export { apiVersion, DEFAULT_TEST_LANGUAGE, getLanguage, Platform, setLanguage } from "./language";
export { clearNotices, failNextNotice, Notice, recordedNotices } from "./notice";
export { normalizePath } from "./paths";
export { createTestPlugin, Plugin, TEST_MANIFEST } from "./plugin";
export {
  DropdownComponent,
  PluginSettingTab,
  Setting,
  settingsIn,
  TextComponent,
  ToggleComponent,
} from "./settings";
export { ItemView, View, WorkspaceLeaf } from "./views";
export { Workspace } from "./workspace";
export { TFile, TFolder } from "./vault";
export { parseYaml, stringifyYaml, YAMLParseError } from "./yaml";

export function parseLinktext(linktext: string) {
  const heading = linktext.indexOf("#");
  return heading < 0
    ? { path: linktext, subpath: "" }
    : { path: linktext.slice(0, heading), subpath: linktext.slice(heading) };
}
