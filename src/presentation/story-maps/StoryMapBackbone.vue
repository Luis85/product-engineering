<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { StoryMapNodeEdit } from "../../application/story-maps";
import type { StoryMapActivity, StoryMapStep } from "../../domain/story-maps";
import { useMessages } from "../shell";
import StoryMapOrderButtons from "./StoryMapOrderButtons.vue";
import StoryMapTools from "./StoryMapTools.vue";

const { activities } = defineProps<{
  readonly activities: readonly (StoryMapActivity & { readonly steps: readonly StoryMapStep[] })[];
}>();
const emit = defineEmits<{
  edit: [value: StoryMapNodeEdit, origin?: HTMLElement];
  move: [kind: StoryMapNodeEdit["kind"], id: string, offset: -1 | 1, origin?: HTMLElement];
}>();
const text = useMessages()["story-maps"];

function edit(value: StoryMapNodeEdit, origin?: HTMLElement) {
  emit("edit", value, origin);
}
function move(kind: StoryMapNodeEdit["kind"], id: string, offset: -1 | 1, origin?: HTMLElement) {
  emit("move", kind, id, offset, origin);
}
</script>

<template>
  <section class="pe-story-grid pe-story-backbone" :aria-label="text.journey.backbone">
    <div class="pe-story-axis">
      <span>{{ text.journey.activityAxis }}</span><span>{{ text.journey.stepAxis }}</span>
    </div>
    <div
      v-for="(activity, index) in activities"
      :key="activity.id"
      class="pe-story-activity"
      :data-testid="'story-map-activity-' + activity.id"
      :style="{ '--pe-activity-columns': Math.max(activity.steps.length, 1) }"
    >
      <div class="pe-story-activity-header">
        <h3>{{ activity.title }}</h3>
        <div class="pe-story-node-tools">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-plus"
            data-testid="story-map-add-step"
            :aria-label="text.journey.addStep(activity.title)"
            :title="text.journey.addStep(activity.title)"
            @click="
              edit(
                { kind: 'step', node: { id: '', title: '', activityId: activity.id } },
                $event.currentTarget as HTMLElement,
              )
            "
          />
          <StoryMapTools :label="text.journey.nodeActions(activity.title)" :node="activity.id">
            <template #default="{ invoke }">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                :label="text.journey.edit.activity"
                @click="invoke((origin) => edit({ kind: 'activity', node: activity }, origin))"
              />
              <StoryMapOrderButtons
                :index="index"
                :length="activities.length"
                @move="
                  (offset) => invoke((origin) => move('activity', activity.id, offset, origin))
                "
              />
            </template>
          </StoryMapTools>
        </div>
      </div>
      <div v-for="(step, stepIndex) in activity.steps" :key="step.id" class="pe-story-step">
        <h4>{{ step.title }}</h4>
        <StoryMapTools :label="text.journey.nodeActions(step.title)" :node="step.id">
          <template #default="{ invoke }">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              :label="text.journey.edit.step"
              @click="invoke((origin) => edit({ kind: 'step', node: step }, origin))"
            />
            <StoryMapOrderButtons
              :index="stepIndex"
              :length="activity.steps.length"
              @move="(offset) => invoke((origin) => move('step', step.id, offset, origin))"
            />
          </template>
        </StoryMapTools>
      </div>
      <p v-if="!activity.steps.length" class="pe-story-step">
        {{ text.journey.missingStep }}
      </p>
    </div>
  </section>
</template>
