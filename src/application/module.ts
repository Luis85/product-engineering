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

export type ModuleManifest<Name extends string, Catalog, E extends Tagged = never> = ModuleBase<
  Name,
  Catalog
> & {
  readonly errors?: ErrorPart<E, Catalog>;
};

export function defineModule<const Name extends string, Catalog, E extends Tagged = never>(
  manifest: ModuleBase<Name, Catalog> & { readonly errors: ErrorPart<E, Catalog> },
): ModuleBase<Name, Catalog> & { readonly errors: ErrorPart<E, Catalog> };
export function defineModule<const Name extends string, Catalog>(
  manifest: ModuleBase<Name, Catalog> & { readonly errors?: never },
): ModuleBase<Name, Catalog>;
export function defineModule<const Name extends string, Catalog, E extends Tagged>(
  manifest: ModuleManifest<Name, Catalog, E>,
): ModuleManifest<Name, Catalog, E> {
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
