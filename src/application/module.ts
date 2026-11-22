import type { Effect } from "effect";
import type { Language, UserMessage } from "./shell";

type Tagged = { readonly _tag: string };

export type ErrorTags<E extends Tagged> = { readonly [Tag in E["_tag"]]: true };

type ModuleBase<Name extends string = string, Catalog = unknown> = {
  readonly name: Name;
  readonly catalog: Readonly<Record<Language, Catalog>>;
};

type ErrorPart<E extends Tagged, Catalog> = {
  readonly tags: ErrorTags<NoInfer<E>>;
  readonly describe: (error: E, messages: Catalog) => UserMessage;
};

export type PluginCommand<Messages, Route, Services> = {
  readonly id: string;
  readonly name: (messages: Messages) => string;
  readonly action:
    | { readonly _tag: "open"; readonly route?: Route }
    | { readonly _tag: "run"; readonly effect: Effect.Effect<void, never, Services> };
};

type CommandPart<Command> = { readonly commands?: readonly Command[] };

export type ModuleManifest<
  Name extends string,
  Catalog,
  E extends Tagged = never,
  Command = never,
> = ModuleBase<Name, Catalog> &
  CommandPart<Command> & {
    readonly errors?: ErrorPart<E, Catalog>;
  };

export function defineModule<
  const Name extends string,
  Catalog,
  E extends Tagged = never,
  Command = never,
>(
  manifest: ModuleManifest<Name, Catalog, E, Command> & { readonly errors: ErrorPart<E, Catalog> },
): ModuleManifest<Name, Catalog, E, Command> & { readonly errors: ErrorPart<E, Catalog> };
export function defineModule<const Name extends string, Catalog, Command = never>(
  manifest: ModuleManifest<Name, Catalog, never, Command> & { readonly errors?: never },
): ModuleBase<Name, Catalog> & CommandPart<Command>;
export function defineModule<const Name extends string, Catalog, E extends Tagged, Command>(
  manifest: ModuleManifest<Name, Catalog, E, Command>,
): ModuleManifest<Name, Catalog, E, Command> {
  return manifest;
}

export type CatalogOf<M extends ModuleBase> = {
  readonly [Module in M as Module["name"]]: Module["catalog"][Language];
};

export type ErrorOf<M> = M extends {
  readonly errors: {
    readonly describe: (error: infer E extends Tagged, messages: never) => UserMessage;
  };
}
  ? E
  : never;

export function commandsOf<Command>(modules: readonly CommandPart<Command>[]): readonly Command[] {
  return modules.flatMap(({ commands }) => commands ?? []);
}

type DescribableModule = ModuleBase & {
  readonly errors?: {
    readonly tags: object;
    readonly describe: (error: never, messages: never) => UserMessage;
  };
};

export function catalogOf<M extends ModuleBase>(
  modules: readonly M[],
  language: Language,
): CatalogOf<M> {
  return Object.fromEntries(
    modules.map(({ name, catalog }) => [name, catalog[language]]),
  ) as CatalogOf<M>;
}

export function describerOf<M extends DescribableModule>(modules: readonly M[]) {
  return (error: ErrorOf<M>, messages: CatalogOf<M>): UserMessage => {
    const module = modules.find(({ errors }) => errors && Object.hasOwn(errors.tags, error._tag));
    if (!module?.errors) throw new Error(`No module registered error tag ${error._tag}`);

    // The tag identifies the describer and the same module name identifies its catalog.
    const catalog = messages[module.name as keyof CatalogOf<M>];
    return module.errors.describe(error as never, catalog as never);
  };
}
