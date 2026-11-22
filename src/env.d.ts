declare module "*.vue" {
  import type { Component } from "vue";

  const component: Component;
  export default component;
}
declare module "*.css";

interface ImportMetaEnv {
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
