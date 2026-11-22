export type Frontmatter = Readonly<Record<string, unknown>>;

export interface FrontmatterPatch {
  readonly set?: Frontmatter;
  readonly remove?: readonly string[];
}
