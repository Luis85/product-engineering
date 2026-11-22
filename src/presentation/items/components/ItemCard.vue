<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { describeItemIssue, shownItemName } from "../../../application/items";
import type { ItemRow } from "../../../application/items";
import { cardKey, OpenNoteButton } from "../../notes";
import { useMessages } from "../../shell";

const props = defineProps<{ row: ItemRow }>();
const emit = defineEmits<{ edit: [event: MouseEvent]; remove: [event: MouseEvent] }>();
const messages = useMessages();
const text = messages.items;
const name = computed(() => shownItemName(props.row));
const issues = computed(() =>
  props.row.issues.map((issue) => ({ code: issue.code, text: describeItemIssue(issue, messages) })),
);
const details = computed(() => {
  const { status, due } = props.row.values;
  return [
    { label: text.fields.status, value: status ? text.status[status] : undefined },
    { label: text.fields.due, value: due },
  ].filter(({ value }) => value !== undefined);
});
</script>

<template>
  <li :data-card-key="cardKey(row)" class="pe:grid pe:min-w-0 pe:gap-2 pe:py-3">
    <h3
      class="pe:text-base pe:font-semibold pe:[overflow-wrap:anywhere]"
      data-focus="name"
      tabindex="-1"
    >
      {{ name }}
    </h3>
    <dl
      v-if="details.length"
      class="pe:m-0 pe:flex pe:min-w-0 pe:flex-wrap pe:gap-x-4 pe:gap-y-2 pe:text-sm"
    >
      <div v-for="detail in details" :key="detail.label" class="pe:grid pe:gap-0.5">
        <dt class="pe:text-xs pe:text-muted">{{ detail.label }}</dt>
        <dd class="pe:m-0">{{ detail.value }}</dd>
      </div>
    </dl>
    <ul v-if="issues.length" class="pe:grid pe:gap-1 pe:text-sm pe:text-warning">
      <li
        v-for="(issue, index) in issues"
        :key="index"
        :data-issue-code="issue.code"
        class="pe:[overflow-wrap:anywhere]"
      >
        {{ issue.text }}
      </li>
    </ul>
    <div v-if="row.editable" class="pe:flex pe:flex-wrap pe:gap-1">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        data-focus="edit"
        @click="emit('edit', $event)"
      >
        {{ text.actions.edit }}
      </UButton>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        data-focus="remove"
        @click="emit('remove', $event)"
      >
        {{ text.actions.remove }}
      </UButton>
    </div>
    <OpenNoteButton v-else :path="row.path" />
  </li>
</template>
