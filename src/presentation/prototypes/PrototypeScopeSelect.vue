<script setup lang="ts">
import { computed } from "vue";
import type { PrototypeSourceOption } from "../../application/prototypes";
import { prototypeSourceKey, prototypeSourceKinds } from "../../domain/prototypes";
import { useMessages } from "../shell";

const { options, invalid, busy, autofocus } = defineProps<{
  readonly options: readonly PrototypeSourceOption[];
  readonly invalid: boolean;
  readonly busy: boolean;
  readonly autofocus: boolean;
}>();
const text = useMessages().prototypes;
const value = defineModel<string>({ required: true });
const groups = computed(() =>
  prototypeSourceKinds.flatMap((kind) => {
    const choices = options.filter((option) => option.source.kind === kind);
    return choices.length ? [{ kind, choices }] : [];
  }),
);
const missing = computed(
  () => value.value && !options.some(({ source }) => prototypeSourceKey(source) === value.value),
);
const missingLabel = computed(() => `${value.value.split(":").at(-1)} · ${text.missingSource}`);
const autofocusMarker = autofocus ? "" : undefined;
</script>

<template>
  <label class="pe:grid pe:min-w-0 pe:gap-1 pe:text-sm">
    <span class="pe:font-medium">{{ text.scope }}</span>
    <select
      v-model="value"
      name="scope"
      class="pe-prototype-select"
      :disabled="busy"
      aria-required="true"
      :aria-invalid="invalid"
      :data-autofocus="autofocusMarker"
    >
      <option value="">{{ text.chooseScope }}</option>
      <option v-if="missing" :value="value">{{ missingLabel }}</option>
      <optgroup v-for="group in groups" :key="group.kind" :label="text.sourceKinds[group.kind]">
        <option
          v-for="option in group.choices"
          :key="option.source.id"
          :value="prototypeSourceKey(option.source)"
        >
          {{ option.displayId }} · {{ option.title }}
        </option>
      </optgroup>
    </select>
    <span v-if="invalid" role="alert" class="pe:text-error">{{ text.errors.source }}</span>
  </label>
</template>
