import { Schema } from "effect";

export type RouteLike = { readonly name: string };

export type Routes<R extends RouteLike> = {
  readonly start: R;
  readonly decode: (value: unknown) => R;
  readonly equals: (left: R, right: R) => boolean;
};

export function routesOf<R extends RouteLike>(
  schema: Schema.Codec<R, unknown>,
  start: NoInfer<R>,
): Routes<R> {
  const decode = Schema.decodeUnknownSync(schema);
  return {
    start,
    decode(value) {
      try {
        return decode(value);
      } catch {
        return start;
      }
    },
    equals: Schema.toEquivalence(schema),
  };
}

export const SETTINGS = "settings";

export type SettingsRoute<Section extends string = string> = {
  readonly name: typeof SETTINGS;
  readonly section: Section;
};

export function settingsRoute<const Sections extends readonly string[]>(sections: Sections) {
  return Schema.Struct({
    name: Schema.Literal(SETTINGS),
    section: Schema.Literals(sections),
  });
}
