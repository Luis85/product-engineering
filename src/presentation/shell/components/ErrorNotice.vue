<script setup lang="ts">
import UAlert from "@nuxt/ui/components/Alert.vue";
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref } from "vue";
import { copyDiagnostics } from "../../../application/shell";
import type { UserMessage } from "../../../application/shell";
import { useCommand, useMessages } from "../runtime/use-runtime";

type CustomAction = Exclude<NonNullable<UserMessage["action"]>, "copy-diagnostics">;

const props = defineProps<{
  message: UserMessage;
  handlers?: Partial<Record<CustomAction, () => void | Promise<void>>>;
}>();

const messages = useMessages().shell;
const diagnostics = useCommand(() => copyDiagnostics);
const pending = ref(false);
const icons = {
  info: "i-lucide-info",
  warning: "i-lucide-triangle-alert",
  error: "i-lucide-circle-x",
};

const action = computed(() => {
  const kind = props.message.action;
  if (!kind) return null;
  const run = kind === "copy-diagnostics" ? diagnostics.run : props.handlers?.[kind];
  return run ? { label: messages.actions[kind], run } : null;
});

async function runAction() {
  const current = action.value;
  if (!current || pending.value) return;
  pending.value = true;
  try {
    await current.run();
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <UAlert
    role="alert"
    :title="message.title"
    :color="message.severity"
    :icon="icons[message.severity]"
    variant="subtle"
    orientation="vertical"
  >
    <template #description>
      <div class="pe:flex pe:flex-col pe:items-start pe:gap-1">
        <p>{{ message.detail }}</p>
        <a
          v-if="message.link"
          :href="message.link"
          rel="noopener"
          target="_blank"
          class="pe:underline pe:underline-offset-2"
        >
          {{ messages.settingsTab.issuesLink }}
        </a>
      </div>
    </template>
    <template v-if="action" #actions>
      <UButton
        type="button"
        size="sm"
        variant="outline"
        :color="message.severity"
        v-bind="
          pending
            ? {
                'aria-disabled': true,
                leadingIcon: 'i-lucide-loader-circle',
                ui: { leadingIcon: 'pe:animate-spin pe:motion-reduce:animate-none' },
              }
            : {}
        "
        @click="runAction"
      >
        {{ action.label }}
      </UButton>
    </template>
  </UAlert>
</template>
