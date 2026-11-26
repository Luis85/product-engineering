<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { openNote } from "../../../application/notes";
import { ErrorNotice, useCommand, useMessages } from "../../shell";

const props = defineProps<{ path: string }>();
const label = useMessages().notes.openNote;
const command = useCommand(openNote);
const { message, pending } = command;

function open() {
  if (!pending.value) void command.run(props.path);
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:justify-items-start pe:gap-2">
    <UButton
      type="button"
      size="sm"
      variant="outline"
      color="neutral"
      :aria-disabled="pending"
      @click="open"
    >
      {{ label }}
    </UButton>
    <ErrorNotice v-if="message" :message="message" />
  </div>
</template>
