import { shallowRef, watch } from "vue";
import type { RecordRow } from "../../application/notes";

type KeyedRow = Pick<RecordRow, "id" | "path" | "issues">;

export type FocusTarget =
  | { readonly kind: "opener"; readonly element: HTMLElement | undefined }
  | { readonly kind: "saved" | "removed"; readonly key: string };

export function cardKey(row: KeyedRow): string {
  return row.issues.some((issue) => issue.code === "id.duplicate")
    ? row.path
    : (row.id ?? row.path);
}

function focusControl(root: HTMLElement, rows: readonly KeyedRow[], target: FocusTarget) {
  const add = () => root.querySelector<HTMLElement>("[data-focus='add']");
  if (target.kind === "opener") return target.element?.isConnected ? target.element : add();

  const exists = rows.some((row) => cardKey(row) === target.key);
  if (target.kind === "removed") return exists ? null : add();
  if (!exists) return null;

  const card = Array.from(root.querySelectorAll<HTMLElement>("[data-card-key]")).find(
    (element) => element.dataset.cardKey === target.key,
  );
  return (
    card?.querySelector<HTMLElement>("[data-focus='edit']") ??
    card?.querySelector<HTMLElement>("[data-focus='name']")
  );
}

export function useFocusAfter(
  root: () => HTMLElement | null | undefined,
  rows: () => readonly KeyedRow[],
) {
  const request = shallowRef<FocusTarget>();
  watch(
    [root, rows, request],
    ([surface, current, target]) => {
      if (!surface || !target) return;
      const control = focusControl(surface, current, target);
      if (!control) return;
      request.value = undefined;
      control.focus();
    },
    { flush: "post" },
  );

  return (target: FocusTarget) => {
    request.value = target;
  };
}
