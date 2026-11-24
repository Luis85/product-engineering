<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import type { BacklogItem } from "../../application/backlog";
import { isCanonicalStoryItem, setStoryMapItemLink } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { StoryMapCard, StoryMapCardLink } from "../../domain/story-maps";
import { leafModalUi } from "../projects";
import { ErrorNotice, useCommand, useMessages, useModal, useNavigationGuard } from "../shell";

const {
  map,
  card,
  items,
  sliceId = undefined,
} = defineProps<{
  readonly map: StoryMapRecord;
  readonly card: StoryMapCard;
  readonly items: readonly BacklogItem[];
  readonly sliceId?: string;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const text = useMessages()["story-maps"];
const open = ref(true);
const { pending, message, run: setLink } = useCommand(setStoryMapItemLink);
const modal = useModal(open, () => emit("dismiss"), close);
useNavigationGuard(() => !pending.value);
const links = computed(() => map.cardLinks.filter(({ cardId }) => cardId === card.id));
const choices = computed(() =>
  items
    .filter(isCanonicalStoryItem)
    .filter(
      ({ id }) =>
        !links.value.some((link) => link.recordId === id && link.projectId === map.projectId),
    ),
);

const form = useForm({
  defaultValues: { itemId: "" },
  async onSubmit({ value }) {
    const item = choices.value.find(({ id }) => id === value.itemId);
    if (!item) return;
    const result = await setLink(
      map,
      { projectId: map.projectId, kind: "item", cardId: card.id, recordId: item.id },
      true,
      sliceId,
    );
    if (result._tag === "success") close();
  },
});

function remove(link: StoryMapCardLink) {
  return setLink(map, link, false, sliceId);
}

function close() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="sliceId ? text.handoff.link : text.journey.editLinks"
    :description="card.title"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <div class="pe:grid pe:min-w-0 pe:gap-3">
        <ul v-if="links.length" class="pe:grid pe:gap-1">
          <li
            v-for="(link, index) in links"
            :key="index"
            class="pe:flex pe:items-center pe:justify-between pe:gap-2"
          >
            <span>{{ link.recordId }}</span>
            <UButton
              type="button"
              variant="ghost"
              color="neutral"
              :label="text.journey.unlink(link.recordId)"
              :disabled="pending"
              @click="remove(link)"
            />
          </li>
        </ul>
        <form class="pe:grid pe:min-w-0 pe:gap-3" @submit.prevent="form.handleSubmit()">
          <p v-if="sliceId && !choices.length">{{ text.handoff.noChoices }}</p>
          <form.Field v-else v-slot="{ field }" name="itemId">
            <label class="pe:grid pe:gap-1">
              {{ text.journey.linkedItems }}
              <select
                name="story-backlog-item"
                class="pe:w-full pe:min-w-0"
                :value="field.state.value"
                :disabled="pending || !choices.length"
                data-autofocus
                required
                @change="field.handleChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>{{ text.journey.chooseItem }}</option>
                <option v-for="item in choices" :key="item.id" :value="item.id">
                  {{ item.id }} · {{ item.title }}
                </option>
              </select>
            </label>
          </form.Field>
          <ErrorNotice v-if="message" :message="message" />
          <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
            <UButton
              type="button"
              variant="ghost"
              color="neutral"
              :label="text.work.close"
              :disabled="pending"
              @click="close"
            />
            <UButton
              v-if="choices.length"
              type="submit"
              :label="text.journey.link"
              :loading="pending"
              data-testid="story-map-link-save"
            />
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
