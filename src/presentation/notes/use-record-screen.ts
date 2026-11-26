import { computed, shallowRef } from "vue";
import type { Ref } from "vue";
import { rebuildNoteIndex, recordFolder } from "../../application/notes";
import type { NoteIndexReadError, RecordList, RecordRow } from "../../application/notes";
import { describeError } from "../../application/user-messages";
import type { NoteFields, NoteIssue, NoteType } from "../../domain/notes";
import { useCommand, useDelayed, useMessages, useModal, useSettings } from "../shell";
import { cardKey, useFocusAfter } from "./focus-after";
import type { FocusTarget } from "./focus-after";

type ScreenOptions<Fields extends NoteFields, Issue extends NoteIssue> = {
  readonly type: NoteType<Fields>;
  readonly list: Readonly<Ref<RecordList<Fields, Issue>>>;
  readonly root: () => HTMLElement | null | undefined;
};

type IndexStatus = { readonly ready: boolean; readonly failure: NoteIndexReadError | undefined };

export function useIndexStatus(current: () => IndexStatus) {
  const messages = useMessages();
  const rebuild = useCommand(() => rebuildNoteIndex);
  const loading = useDelayed(() => !current().ready && !current().failure);
  const failure = computed(() => {
    const error = current().failure;
    return error ? describeError(error, messages) : undefined;
  });
  return {
    loading,
    failure,
    retry: async () => {
      await rebuild.run();
    },
  };
}

function useRecordModal<Selection>(focus: (target: FocusTarget) => void) {
  const selection = shallowRef<Selection>();
  let restore: FocusTarget | undefined;
  const open = computed(() => selection.value !== undefined);
  const props = useModal(open, () => {
    if (restore) focus(restore);
    restore = undefined;
  });
  return {
    selection,
    open,
    props,
    show(value: Selection, opener?: HTMLElement) {
      restore = { kind: "opener", element: opener };
      selection.value = value;
    },
    close(target?: FocusTarget) {
      if (target) restore = target;
      selection.value = undefined;
    },
  };
}

export function useRecordScreen<Fields extends NoteFields, Issue extends NoteIssue = never>({
  type,
  list,
  root,
}: ScreenOptions<Fields, Issue>) {
  type Row = RecordRow<Fields, Issue>;
  type Sheet = { readonly mode: "create" } | { readonly mode: "edit"; readonly row: Row };
  const settings = useSettings();
  const status = useIndexStatus(() => list.value);
  const focus = useFocusAfter(root, () => list.value.rows);
  const sheet = useRecordModal<Sheet>(focus);
  const deletion = useRecordModal<Row>(focus);

  return {
    ...status,
    folder: computed(() => recordFolder(settings.value.rootFolder, type)),
    empty: computed(() => list.value.ready && !list.value.failure && list.value.rows.length === 0),
    sheet: sheet.selection,
    sheetOpen: sheet.open,
    sheetProps: sheet.props,
    deleting: deletion.selection,
    deleteOpen: deletion.open,
    deleteProps: deletion.props,
    openCreate: (opener?: HTMLElement) => sheet.show({ mode: "create" }, opener),
    openEdit: (row: Row, opener?: HTMLElement) => sheet.show({ mode: "edit", row }, opener),
    openDelete: (row: Row, opener?: HTMLElement) => deletion.show(row, opener),
    closeSheet: () => sheet.close(),
    closeDelete: () => deletion.close(),
    saved: (id: string) => sheet.close({ kind: "saved", key: id }),
    deleted: () => {
      const row = deletion.selection.value;
      deletion.close(row ? { kind: "removed", key: cardKey(row) } : undefined);
    },
  };
}
