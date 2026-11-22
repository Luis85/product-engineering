<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, onScopeDispose, ref, shallowRef, useId } from "vue";
import type { ChatProvider } from "../../../application/integrations";
import { ErrorNotice, useMessages } from "../../shell";
import { createChatSession } from "../chat-session";
import { useProviderChat } from "../use-provider-chat";

const catalog = useMessages().integrations;
const text = catalog.chat;
const provider = ref<ChatProvider>("codex");
const providers = ["codex", "claude-code"] as const;
const providerId = useId();
const providerHintId = useId();
const messageId = useId();
const session = createChatSession(useProviderChat());
const state = shallowRef(session.getState());
const stopRequested = ref(false);
let disposed = false;
const unsubscribe = session.subscribe((next) => {
  state.value = next;
});

onScopeDispose(() => {
  disposed = true;
  unsubscribe();
  session.dispose();
});

const form = useForm({
  defaultValues: { message: "" },
  async onSubmit({ value, formApi }) {
    if (state.value.pending || !value.message.trim()) return;
    stopRequested.value = false;
    const sending = session.send(provider.value, value.message);
    formApi.setFieldValue("message", "");
    await sending;
    if (!disposed && state.value.failure && formApi.getFieldValue("message") === "") {
      formApi.setFieldValue("message", value.message);
    }
  },
});

const message = form.useStore((snapshot) => snapshot.values.message);
const canSend = computed(() => !state.value.pending && message.value.trim().length > 0);
const canStop = computed(() => state.value.pending && !stopRequested.value);
const status = computed(() => {
  if (state.value.pending) return stopRequested.value ? text.stopping : text.responding;
  return stopRequested.value ? text.stopped : "";
});
const failure = computed(() => {
  const current = state.value.failure;
  return current
    ? catalog.chatFailures[current.reason](catalog.providers[current.provider])
    : undefined;
});
const transcript = computed(() =>
  state.value.messages.map((entry) => ({
    ...entry,
    styles: entry.role === "user" ? "pe:self-end pe:bg-muted" : "pe:self-start",
  })),
);

function submit() {
  if (canSend.value) return form.handleSubmit();
}

function stop(): void {
  if (!canStop.value) return;
  stopRequested.value = true;
  session.cancel();
}
</script>

<template>
  <div data-testid="agent-chat-screen" class="pe:grid pe:min-w-0 pe:gap-4">
    <header class="pe:flex pe:flex-wrap pe:items-end pe:justify-between pe:gap-3">
      <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <label :for="providerId" class="pe:text-sm pe:font-medium">{{ text.provider }}</label>
        <select
          :id="providerId"
          v-model="provider"
          :aria-describedby="providerHintId"
          class="pe:min-h-8 pe:w-fit pe:max-w-full pe:rounded-md pe:border pe:border-accented pe:bg-default pe:px-2.5 pe:py-1 pe:text-sm"
        >
          <option v-for="key in providers" :key="key" :value="key">
            {{ catalog.providers[key] }}
          </option>
        </select>
      </div>
    </header>
    <p :id="providerHintId" class="pe:text-sm pe:text-muted">{{ text.recipientHint }}</p>

    <ol
      role="log"
      aria-live="polite"
      :aria-label="text.conversation"
      :aria-busy="state.pending"
      tabindex="0"
      class="pe:flex pe:max-h-[min(55vh,32rem)] pe:min-h-20 pe:min-w-0 pe:flex-col pe:gap-3 pe:overflow-auto pe:rounded-md pe:border pe:border-default pe:p-3"
    >
      <li v-if="transcript.length === 0" class="pe:text-sm pe:text-muted">{{ text.empty }}</li>
      <li
        v-for="(entry, index) in transcript"
        :key="index"
        :class="entry.styles"
        class="pe:grid pe:min-w-0 pe:max-w-full pe:gap-1 pe:rounded-md pe:px-3 pe:py-2"
      >
        <span class="pe:text-xs pe:font-semibold pe:text-toned">{{
          text.speakers[entry.role]
        }}</span>
        <p class="pe:max-w-[68ch] pe:text-sm pe:whitespace-pre-wrap pe:[overflow-wrap:anywhere]">
          {{ entry.content }}
        </p>
      </li>
    </ol>

    <ErrorNotice v-if="failure" :message="failure" />

    <form class="pe:grid pe:min-w-0 pe:gap-2" @submit.prevent="submit">
      <label :for="messageId" class="pe:text-sm pe:font-medium">{{ text.message }}</label>
      <form.Field v-slot="{ field }" name="message">
        <UTextarea
          :id="messageId"
          :name="field.name"
          :model-value="field.state.value"
          :rows="3"
          :maxrows="8"
          autoresize
          aria-required="true"
          class="pe:w-full"
          @blur="field.handleBlur()"
          @update:model-value="(value) => field.handleChange(value)"
        />
      </form.Field>
      <div class="pe:flex pe:min-w-0 pe:flex-wrap pe:items-center pe:justify-between pe:gap-2">
        <p role="status" class="pe:text-sm pe:text-muted">{{ status }}</p>
        <div class="pe:flex pe:flex-wrap pe:gap-2">
          <UButton
            type="button"
            data-testid="stop-response"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-disabled="!canStop"
            class="pe:aria-disabled:text-muted"
            @click="stop"
            >{{ text.stop }}</UButton
          >
          <UButton
            type="submit"
            size="sm"
            :aria-disabled="!canSend"
            class="pe:aria-disabled:opacity-70"
            >{{ text.send }}</UButton
          >
        </div>
      </div>
    </form>
  </div>
</template>
