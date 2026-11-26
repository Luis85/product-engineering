<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, onScopeDispose, ref, shallowRef, useId, watch } from "vue";
import { aiCapability, sameAiCapability } from "../../../application/integrations";
import { openProjectIntegrationSettings } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useSettings } from "../../shell";
import { createChatSession } from "../chat-session";
import { useProviderChat } from "../use-provider-chat";

const catalog = useMessages().integrations;
const text = catalog.chat;
const settings = useSettings();
const settingsLink = useCommand(openProjectIntegrationSettings);
const capability = computed(() => aiCapability(settings.value));
const enabled = computed(() => capability.value.enabled);
const provider = computed(() => capability.value.mode);
const messageId = useId();
const session = createChatSession(useProviderChat());
const state = shallowRef(session.getState());
const stopRequested = ref(false);
let disposed = false;
let configuration = 0;
const unsubscribe = session.subscribe((next) => {
  state.value = next;
});

onScopeDispose(() => {
  disposed = true;
  unsubscribe();
  session.dispose();
});
watch(
  capability,
  (current, previous) => {
    if (sameAiCapability(current, previous)) return;
    configuration += 1;
    stopRequested.value = false;
    session.reset();
  },
  { flush: "sync" },
);

const form = useForm({
  defaultValues: { message: "" },
  async onSubmit({ value, formApi }) {
    if (!enabled.value || state.value.pending || !value.message.trim()) return;
    const sentWith = configuration;
    stopRequested.value = false;
    const sending = session.send(provider.value, value.message);
    formApi.setFieldValue("message", "");
    await sending;
    if (
      !disposed &&
      sentWith === configuration &&
      state.value.failure &&
      formApi.getFieldValue("message") === ""
    ) {
      formApi.setFieldValue("message", value.message);
    }
  },
});

const message = form.useStore((snapshot) => snapshot.values.message);
const canSend = computed(
  () => enabled.value && !state.value.pending && message.value.trim().length > 0,
);
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
const missingExecutable = computed(() => {
  const current = state.value.failure;
  return current?.reason === "provider-not-found" && current.provider !== "demo"
    ? current.provider
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
  <div v-if="enabled" data-testid="agent-chat-screen" class="pe:grid pe:min-w-0 pe:gap-4">
    <header class="pe:flex pe:flex-wrap pe:items-end pe:justify-between pe:gap-3">
      <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
      <dl class="pe:grid pe:min-w-0 pe:gap-1 pe:text-sm">
        <dt class="pe:font-medium">{{ catalog.settings.ai.mode.name }}</dt>
        <dd>{{ catalog.settings.ai.modes[provider] }}</dd>
      </dl>
    </header>
    <p class="pe:text-sm pe:text-muted">{{ catalog.settings.ai.disclosure(provider) }}</p>

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
    <UButton
      v-if="missingExecutable"
      type="button"
      variant="outline"
      color="neutral"
      class="pe:w-fit pe:whitespace-normal"
      @click="settingsLink.run(missingExecutable)"
      >{{ text.correctExecutable }}</UButton
    >
    <ErrorNotice v-if="settingsLink.message.value" :message="settingsLink.message.value" />

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
  <div v-else data-testid="agent-chat-screen" class="pe:grid pe:gap-3">
    <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
    <ErrorNotice :message="catalog.chatFailures['consent-required'](catalog.providers[provider])" />
  </div>
</template>
