<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import type { storyMapRows } from "../../application/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import { useMessages } from "../shell";

defineProps<{
  readonly canCreate: boolean;
  readonly rows: ReturnType<typeof storyMapRows>;
  readonly status:
    { readonly label: string; readonly role: string; readonly empty?: boolean } | undefined;
}>();
const emit = defineEmits<{ open: [StoryMapId, HTMLElement]; create: [Event] }>();
const text = useMessages()["story-maps"];
</script>

<template>
  <section class="pe-story-maps" data-testid="story-maps">
    <header class="pe-story-maps-heading">
      <div>
        <h1 tabindex="-1" class="pe-story-map-title">{{ text.title }}</h1>
        <p class="pe:text-sm pe:text-muted">{{ text.intro }}</p>
      </div>
      <UButton
        v-if="canCreate"
        type="button"
        icon="i-lucide-plus"
        :label="text.create"
        data-testid="story-map-create"
        data-pe-focus-key="story-map-create"
        @click="emit('create', $event)"
      />
    </header>
    <p
      v-if="status"
      :role="status.role"
      :class="{ 'pe-story-maps-empty': status.empty }"
      :data-testid="status.empty ? 'story-maps-empty' : undefined"
    >
      {{ status.label }}
    </p>
    <ul v-else :aria-label="text.title" class="pe-story-map-list">
      <li v-for="map in rows" :key="map.id">
        <button
          type="button"
          class="pe-story-map-row"
          data-testid="story-map-row"
          :data-story-map-id="map.id"
          :data-pe-focus-key="map.id"
          @click="emit('open', map.id, $event.currentTarget as HTMLElement)"
        >
          <span class="pe-story-map-row-copy">
            <strong data-testid="story-map-row-title">{{ map.title }}</strong>
            <span>{{ map.goal }}</span>
          </span>
          <span class="pe-story-map-row-meta">
            <span>{{ map.persona }}</span>
            <span data-testid="story-map-row-counts">
              {{ map.displayId }} · {{ text.storyCount(map.storyCount) }} ·
              {{ text.linkedStoryCount(map.linkedStoryCount) }}
            </span>
          </span>
          <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <slot />
  </section>
</template>
