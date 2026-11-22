<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, ref, useId } from "vue";
import type { NoteFieldConflict } from "../../../domain/notes";
import { useMessages } from "../../shell";
import { allChoicesMade, displayConflictValue } from "../conflict";
import type { ConflictChoices } from "../conflict";

const props = defineProps<{
  conflicts: readonly NoteFieldConflict[];
  labels: Readonly<Record<string, string>>;
}>();
const emit = defineEmits<{ apply: [choices: ConflictChoices] }>();
const text = useMessages().notes.conflict;
const id = useId();
const heading = ref<HTMLElement>();
const choices = ref<Record<string, "mine" | "current">>({});
const canApply = computed(() => allChoicesMade(props.conflicts, choices.value));
const fields = computed(() =>
  props.conflicts.map((conflict) => ({
    key: conflict.key,
    label: props.labels[conflict.key] ?? conflict.key,
    base: displayConflictValue(conflict.base, text),
    options: [
      { side: "mine", label: text.mine, value: displayConflictValue(conflict.edited, text) },
      { side: "current", label: text.current, value: displayConflictValue(conflict.current, text) },
    ] as const,
  })),
);

onMounted(() => heading.value?.focus());

function apply() {
  if (canApply.value) emit("apply", { ...choices.value });
}
</script>

<template>
  <section :aria-labelledby="id" class="pe:grid pe:min-w-0 pe:gap-4">
    <div class="pe:grid pe:gap-1">
      <h3 :id="id" ref="heading" tabindex="-1" class="pe:text-base pe:font-semibold">
        {{ text.title }}
      </h3>
      <p class="pe:text-sm pe:text-muted">{{ text.detail }}</p>
    </div>

    <fieldset
      v-for="field in fields"
      :key="field.key"
      class="pe:grid pe:min-w-0 pe:gap-2 pe:rounded-md pe:border pe:border-default pe:p-3"
    >
      <legend class="pe:px-1 pe:text-sm pe:font-medium">{{ field.label }}</legend>
      <dl class="pe:grid pe:min-w-0 pe:gap-0.5 pe:px-1">
        <dt class="pe:text-xs pe:text-muted">{{ text.base }}</dt>
        <dd class="pe:text-sm pe:whitespace-pre-wrap pe:[overflow-wrap:anywhere]">
          {{ field.base }}
        </dd>
      </dl>

      <label
        v-for="option in field.options"
        :key="option.side"
        class="pe:flex pe:min-w-0 pe:cursor-pointer pe:items-start pe:gap-2 pe:rounded-sm pe:px-1 pe:py-1 pe:hover:bg-muted"
      >
        <input
          v-model="choices[field.key]"
          type="radio"
          :name="`${id}-${field.key}`"
          :value="option.side"
          class="pe:mt-1 pe:shrink-0"
        />
        <span class="pe:grid pe:min-w-0 pe:gap-0.5">
          <span class="pe:text-xs pe:font-medium">{{ option.label }}</span>
          <span class="pe:text-sm pe:whitespace-pre-wrap pe:[overflow-wrap:anywhere]">{{
            option.value
          }}</span>
        </span>
      </label>
    </fieldset>

    <div>
      <UButton type="button" :aria-disabled="!canApply" @click="apply">
        {{ text.apply }}
      </UButton>
    </div>
  </section>
</template>
