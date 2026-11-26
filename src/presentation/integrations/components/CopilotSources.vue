<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed } from "vue";
import type { CopilotSource } from "../../../application/integrations";
import { useMessages } from "../../shell";

const { options, selected } = defineProps<{
  readonly options: readonly CopilotSource[];
  readonly selected: readonly string[];
}>();
const emit = defineEmits<{ toggle: [key: string, checked: boolean] }>();
const text = useMessages().integrations.copilot;
const chosen = computed(() =>
  selected.map((key) => ({
    key,
    record: options.find((source) => source.key === key),
  })),
);

function toggle(event: Event) {
  const input = event.target as HTMLInputElement;
  emit("toggle", input.value, input.checked);
}
</script>

<template>
  <section class="pe-copilot-context" :aria-label="text.sources">
    <details class="pe-copilot-sources">
      <summary data-testid="copilot-choose-sources">
        <strong>{{ text.sources }}</strong>
        <span>
          <UIcon name="i-lucide-link" aria-hidden="true" />
          {{ text.selectSources }}
        </span>
      </summary>
      <div class="pe-copilot-source-list">
        <label v-for="source in options" :key="source.key" class="pe:flex pe:items-start pe:gap-2">
          <input
            :checked="selected.includes(source.key)"
            data-testid="copilot-source"
            type="checkbox"
            :value="source.key"
            @change="toggle"
          />
          <span>{{ source.displayId }} · {{ source.title }}</span>
        </label>
      </div>
    </details>
    <ul v-if="chosen.length" data-testid="copilot-selected-sources" class="pe:grid pe:gap-1">
      <li v-for="{ key, record } in chosen" :key="key" class="pe:min-w-0 pe:wrap-anywhere">
        <span v-if="record" class="pe:font-semibold pe:text-primary"
          >{{ record.displayId }} · {{ record.title }}</span
        >
        <UButton
          v-else
          type="button"
          color="neutral"
          size="xs"
          variant="outline"
          data-testid="copilot-remove-missing-source"
          @click="emit('toggle', key, false)"
          >{{ text.removeMissingSource }}</UButton
        >
      </li>
    </ul>
  </section>
</template>
