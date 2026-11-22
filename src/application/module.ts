import { Layer } from "effect";
import type { Effect, Schema } from "effect";
import type { NoteType } from "../domain/notes";
import type { Language, RouteLike, UserMessage } from "./shell";

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
type NoteTypePart = { readonly noteTypes?: readonly NoteType[] };

type ServiceLayer = Layer.Layer<never, never, unknown>;
type ServicePart<Services extends ServiceLayer> = { readonly services?: Services };

type RouteSchemas = readonly Schema.Codec<RouteLike, unknown>[];
type SectionDefinitions = readonly { readonly id: string; readonly order: number }[];

type RoutingPart<Schemas extends RouteSchemas, Sections extends SectionDefinitions> = {
  readonly routes?: Schemas;
  readonly sections?: Sections;
};

export type ModuleManifest<
  Name extends string,
  Catalog,
  E extends Tagged = never,
  Command = never,
  Services extends ServiceLayer = never,
  Schemas extends RouteSchemas = never,
  Sections extends SectionDefinitions = never,
> = ModuleBase<Name, Catalog> &
  CommandPart<Command> &
  NoteTypePart &
  ServicePart<Services> &
  RoutingPart<Schemas, Sections> & {
    readonly errors?: ErrorPart<E, Catalog>;
  };

export function defineModule<
  const Name extends string,
  Catalog,
  E extends Tagged = never,
  Command = never,
  Services extends ServiceLayer = never,
  const Schemas extends RouteSchemas = never,
  const Sections extends SectionDefinitions = never,
>(
  manifest: ModuleManifest<Name, Catalog, E, Command, Services, Schemas, Sections> & {
    readonly errors: ErrorPart<E, Catalog>;
  },
): ModuleManifest<Name, Catalog, E, Command, Services, Schemas, Sections> & {
  readonly errors: ErrorPart<E, Catalog>;
};
export function defineModule<
  const Name extends string,
  Catalog,
  Command = never,
  Services extends ServiceLayer = never,
  const Schemas extends RouteSchemas = never,
  const Sections extends SectionDefinitions = never,
>(
  manifest: ModuleManifest<Name, Catalog, never, Command, Services, Schemas, Sections> & {
    readonly errors?: never;
  },
): ModuleBase<Name, Catalog> &
  CommandPart<Command> &
  NoteTypePart &
  ServicePart<Services> &
  RoutingPart<Schemas, Sections>;
export function defineModule<
  const Name extends string,
  Catalog,
  E extends Tagged,
  Command,
  Services extends ServiceLayer,
  Schemas extends RouteSchemas,
  Sections extends SectionDefinitions,
>(
  manifest: ModuleManifest<Name, Catalog, E, Command, Services, Schemas, Sections>,
): ModuleManifest<Name, Catalog, E, Command, Services, Schemas, Sections> {
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

export function noteTypesOf(modules: readonly NoteTypePart[]): readonly NoteType[] {
  const types = modules.flatMap(({ noteTypes }) => noteTypes ?? []);
  const names = new Set<string>();
  for (const { type } of types) {
    if (names.has(type)) throw new Error(`Duplicate note type ${type}`);
    names.add(type);
  }
  return types;
}

export type ServicesOf<M> =
  M extends ServicePart<infer Services extends ServiceLayer> ? Layer.Success<Services> : never;

export function servicesLayerOf<M extends ServicePart<ServiceLayer>>(modules: readonly M[]) {
  // The constraint widens each property read, but every retained layer came from M.
  const layers = modules.flatMap(({ services }) =>
    services === undefined ? [] : [services],
  ) as NonNullable<M["services"]>[];
  return Layer.mergeAll(Layer.empty, ...layers);
}

export type SectionOf<M> =
  M extends RoutingPart<RouteSchemas, infer Sections> ? Sections[number]["id"] : never;

export function sectionsOf<M extends RoutingPart<RouteSchemas, SectionDefinitions>>(
  modules: readonly M[],
): readonly SectionOf<M>[] {
  // Sorting changes order only, retaining each manifest's declared literal IDs.
  return modules
    .flatMap(({ sections }) => sections ?? [])
    .toSorted((left, right) => left.order - right.order)
    .map(({ id }) => id) as SectionOf<M>[];
}

export type RouteOf<M> =
  M extends RoutingPart<infer Schemas, SectionDefinitions> ? Schemas[number]["Type"] : never;

export function routeSchemasOf<M extends RoutingPart<RouteSchemas, SectionDefinitions>>(
  modules: readonly M[],
): readonly NonNullable<M["routes"]>[number][] {
  return modules.flatMap(({ routes }) => routes ?? []);
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
