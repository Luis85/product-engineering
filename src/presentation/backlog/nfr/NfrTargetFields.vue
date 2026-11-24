<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { nfrTargetKey } from "../../../application/backlog";
import type { NfrTargetOption } from "../../../application/backlog";
import type { NfrTarget } from "../../../domain/backlog";
import { useMessages } from "../../shell";

const { options } = defineProps<{ readonly options: readonly NfrTargetOption[] }>();
const targets = defineModel<readonly NfrTarget[]>({ required: true });
const emit = defineEmits<{ open: [NfrTarget, MouseEvent] }>();
const text = useMessages().backlog.nfr;
const lookup = computed(() => new Map(options.map((target) => [nfrTargetKey(target), target])));
const chosen = computed(() => new Set(targets.value.map(nfrTargetKey)));
const missing = computed(() =>
  targets.value.filter((target) => !lookup.value.has(nfrTargetKey(target))),
);
const choices = computed(() => [...options, ...missing.value]);

function label(target: NfrTarget) {
  return target.id + " · " + (lookup.value.get(nfrTargetKey(target))?.title ?? text.targetMissing);
}

function toggle(target: NfrTarget, event: Event) {
  const checked = (event.currentTarget as HTMLInputElement).checked;
  targets.value = checked
    ? [...targets.value, { kind: target.kind, id: target.id }]
    : targets.value.filter((entry) => nfrTargetKey(entry) !== nfrTargetKey(target));
}
</script>

<template>
  <fieldset class="pe-nfr-fieldset">
    <legend>{{ text.targets }}</legend>
    <ul v-if="targets.length" class="pe:grid pe:gap-1">
      <li v-for="target in targets" :key="nfrTargetKey(target)">
        <UButton
          v-if="target.kind === 'item' && lookup.has(nfrTargetKey(target))"
          type="button"
          variant="link"
          class="pe-nfr-link"
          :data-nfr-open-target="nfrTargetKey(target)"
          :data-pe-focus-key="'nfr-target-' + nfrTargetKey(target)"
          @click="emit('open', target, $event)"
        >
          {{ label(target) }}
        </UButton>
        <span v-else class="pe:text-muted">{{ label(target) }}</span>
      </li>
    </ul>
    <details v-if="choices.length">
      <summary data-testid="nfr-target-choices">{{ text.chooseTargets }}</summary>
      <div class="pe-nfr-checklist">
        <label v-for="target in choices" :key="nfrTargetKey(target)">
          <input
            type="checkbox"
            :value="nfrTargetKey(target)"
            :checked="chosen.has(nfrTargetKey(target))"
            @change="toggle(target, $event)"
          />
          <span>{{ label(target) }}</span>
        </label>
      </div>
    </details>
    <p v-else class="pe:text-muted">{{ text.noTargets }}</p>
  </fieldset>
</template>
