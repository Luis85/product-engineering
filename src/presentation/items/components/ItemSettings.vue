<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import USlideover from "@nuxt/ui/components/Slideover.vue";
import { computed, ref } from "vue";
import { deleteItem, itemChanges, itemList, shownItemName } from "../../../application/items";
import type { ItemRow } from "../../../application/items";
import { itemType } from "../../../domain/items";
import { cardKey, DeleteRecordDialog, useRecordScreen } from "../../notes";
import { ErrorNotice, useMessages, useStream } from "../../shell";
import ItemCard from "./ItemCard.vue";
import ItemForm from "./ItemForm.vue";

const text = useMessages().items;
const root = ref<HTMLElement | null>(null);
const list = useStream(itemList, itemChanges);
const screen = useRecordScreen({ type: itemType, list, root: () => root.value });
const {
  loading,
  failure,
  retry,
  folder,
  empty,
  sheet,
  sheetOpen,
  sheetProps,
  deleting,
  deleteOpen,
  deleteProps,
} = screen;
const saving = ref(false);
const canAdd = computed(() => list.value.ready && !list.value.failure);
const sheetTitle = computed<string>((previous) => {
  if (!sheet.value) return previous ?? text.form.createTitle;
  return sheet.value.mode === "edit" ? text.form.editTitle : text.form.createTitle;
});
const formRecord = computed(() =>
  sheet.value?.mode === "edit" ? { record: sheet.value.row } : {},
);
const deleteTitle = computed<string>((previous) =>
  deleting.value ? shownItemName(deleting.value) : (previous ?? ""),
);

function opener(event: MouseEvent): HTMLElement | undefined {
  return (event.currentTarget as HTMLElement | null) ?? undefined;
}

function add(event: MouseEvent) {
  if (canAdd.value) screen.openCreate(opener(event));
}

function edit(row: ItemRow, event: MouseEvent) {
  screen.openEdit(row, opener(event));
}

function askDelete(row: ItemRow, event: MouseEvent) {
  screen.openDelete(row, opener(event));
}

function closeSheet(open = false) {
  if (!open && !saving.value) screen.closeSheet();
}

function closeDelete(open: boolean) {
  if (!open) screen.closeDelete();
}

function removeSelected() {
  const row = deleting.value;
  if (!row) throw new Error("Delete requires a selected item");
  return deleteItem(row);
}
</script>

<template>
  <section
    ref="root"
    data-testid="items-screen"
    :data-index-ready="list.ready ? 'true' : 'false'"
    :aria-busy="!list.ready && !list.failure"
    class="pe:grid pe:min-w-0 pe:gap-4"
  >
    <header class="pe:flex pe:min-w-0 pe:flex-wrap pe:items-end pe:justify-between pe:gap-3">
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <h2 class="pe:text-lg pe:font-semibold">{{ text.settings.label }}</h2>
        <p class="pe:text-sm pe:text-muted pe:[overflow-wrap:anywhere]">
          {{ text.settings.folder(folder) }}
        </p>
      </div>
      <UButton type="button" data-focus="add" :aria-disabled="!canAdd" @click="add">{{
        text.actions.add
      }}</UButton>
    </header>

    <ErrorNotice v-if="failure" :message="failure" :handlers="{ retry }" />
    <p v-if="loading" role="status" class="pe:text-sm pe:text-muted">{{ text.settings.loading }}</p>
    <p v-if="empty" data-testid="items-empty" class="pe:text-sm pe:text-muted">
      {{ text.settings.empty }}
    </p>

    <ul v-if="list.rows.length" data-testid="item-list" class="pe:divide-y pe:divide-default">
      <ItemCard
        v-for="row in list.rows"
        :key="cardKey(row)"
        :row="row"
        @edit="edit(row, $event)"
        @remove="askDelete(row, $event)"
      />
    </ul>

    <USlideover
      :open="sheetOpen"
      :title="sheetTitle"
      :content="sheetProps"
      :dismissible="!saving"
      :close="false"
      @update:open="closeSheet"
    >
      <template #body>
        <ItemForm
          v-if="sheet"
          v-bind="formRecord"
          :rows="list.rows"
          @saved="screen.saved"
          @cancel="closeSheet()"
          @saving="saving = $event"
        />
      </template>
    </USlideover>
    <DeleteRecordDialog
      :open="deleteOpen"
      :title="deleteTitle"
      :modal-props="deleteProps"
      :remove="removeSelected"
      @update:open="closeDelete"
      @deleted="screen.deleted"
    />
  </section>
</template>
