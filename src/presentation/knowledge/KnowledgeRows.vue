<script setup lang="ts">
import type { KnowledgeRecord, KnowledgeShelf } from "../../application/knowledge";
import { useMessages } from "../shell";

defineProps<{
  readonly groups: readonly {
    readonly group: KnowledgeShelf;
    readonly records: readonly KnowledgeRecord[];
  }[];
  readonly excerpts: ReadonlyMap<string, string> | undefined;
  readonly typeLabel: (record: KnowledgeRecord) => string;
  readonly owner: (record: KnowledgeRecord) => string;
}>();
const emit = defineEmits<{ select: [record: KnowledgeRecord] }>();
const text = useMessages().knowledge;
</script>

<template>
  <section v-for="{ group, records } in groups" :key="group" class="pe:grid pe:min-w-0 pe:gap-2">
    <h2 class="pe:text-lg pe:font-semibold">{{ text.shelves[group] }}</h2>
    <ul class="pe:grid pe:min-w-0 pe:gap-2">
      <li v-for="record in records" :key="record.id" class="pe:min-w-0">
        <button
          type="button"
          :data-knowledge-record="record.id"
          :data-pe-focus-key="record.id"
          class="pe:grid pe:h-auto pe:w-full pe:min-w-0 pe:cursor-pointer pe:grid-cols-1 pe:gap-1 pe:rounded-lg pe:border pe:border-default pe:bg-default pe:p-3 pe:text-left pe:whitespace-normal pe:shadow-none pe:hover:bg-muted pe:focus-visible:outline-2 pe:focus-visible:outline-primary"
          @click="emit('select', record)"
        >
          <strong class="pe:wrap-anywhere pe:text-base">{{ record.title }}</strong>
          <span v-if="excerpts?.get(record.id)" class="pe:wrap-anywhere pe:text-sm">{{
            excerpts.get(record.id)
          }}</span>
          <span
            class="pe:flex pe:flex-wrap pe:gap-x-2 pe:gap-y-1 pe:wrap-anywhere pe:text-xs pe:text-muted"
          >
            <span>{{ typeLabel(record) }}</span>
            <span>{{ record.displayId }}</span>
            <span v-if="record.values.requirement_id">{{ record.values.requirement_id }}</span>
            <span v-if="record.values.approval">{{ text.approvals[record.values.approval] }}</span>
            <span>{{ owner(record) }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
