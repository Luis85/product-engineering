import type { ItemIssue, ItemKey, ItemStatus } from "../../../domain/items";
import type { IssueSentences, RecordTexts } from "../../notes";

type CustomIssue =
  "title.invalid" | "title.too-long" | "title.taken" | "title.duplicate" | "status.unknown";

export interface ItemsCatalog extends RecordTexts<ItemIssue> {
  readonly settings: {
    readonly label: string;
    readonly empty: string;
    readonly loading: string;
    readonly folder: (path: string) => string;
  };
  readonly fields: Readonly<Record<ItemKey, string>>;
  readonly missing: Readonly<Record<"title" | "status", string>>;
  readonly issues: Required<Pick<IssueSentences<ItemIssue>, CustomIssue>>;
  readonly status: Readonly<Record<ItemStatus, string>>;
  readonly form: {
    readonly createTitle: string;
    readonly editTitle: string;
    readonly summary: { readonly title: string; readonly detail: string };
  };
  readonly actions: {
    readonly add: string;
    readonly edit: string;
    readonly remove: string;
    readonly cancel: string;
    readonly save: string;
  };
}
