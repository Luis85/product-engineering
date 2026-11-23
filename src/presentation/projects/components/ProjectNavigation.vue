<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { Route } from "../../../application/routes";
import type { Project } from "../../../application/projects";
import { useMessages } from "../../shell";
import type { NavigationGroup } from "../sections";

const { collapsed, groups, project, section } = defineProps<{
  readonly project: Project | undefined;
  readonly collapsed: boolean;
  readonly groups: readonly NavigationGroup[];
  readonly section: Route["name"];
}>();
const emit = defineEmits<{ pick: [trigger: HTMLElement]; select: [route: Route] }>();
const text = useMessages().projects;
const title = computed(() => project?.name ?? text.title);
const buttons = computed(() =>
  groups.map((group) => ({
    ...group,
    items: group.items.map((entry) => ({
      ...entry,
      attributes:
        section === entry.route.name
          ? ({ "aria-current": "page", color: "primary", variant: "soft" } as const)
          : ({ color: "neutral", variant: "ghost" } as const),
    })),
  })),
);
const buttonClass = computed(() => (collapsed ? "pe:justify-center" : "pe:w-full pe:text-left"));
</script>

<template>
  <UButton
    :aria-label="text.picker"
    :title="text.picker"
    icon="i-lucide-folder"
    variant="soft"
    color="neutral"
    type="button"
    data-pe-focus-key="project-picker"
    data-autofocus
    :class="buttonClass"
    @click="emit('pick', $event.currentTarget as HTMLElement)"
  >
    <span v-if="!collapsed" class="pe:grid pe:min-w-0 pe:gap-0.5">
      <strong class="pe:truncate">{{ title }}</strong>
      <span v-if="project" class="pe:text-xs pe:font-normal pe:text-muted">{{ text.project }}</span>
    </span>
  </UButton>
  <nav :aria-label="text.navigation" data-testid="frame-navigation" class="pe:grid pe:gap-4">
    <div v-for="group in buttons" :key="group.label" class="pe:grid pe:gap-1">
      <p v-if="!collapsed" class="pe:px-2 pe:text-xs pe:font-semibold pe:text-muted">
        {{ group.label }}
      </p>
      <UButton
        v-for="entry in group.items"
        :key="entry.route.name"
        :aria-label="entry.label"
        :title="entry.label"
        v-bind="entry.attributes"
        :icon="entry.icon"
        :data-pe-focus-key="entry.route.name"
        type="button"
        :class="buttonClass"
        @click="emit('select', entry.route)"
      >
        <span v-if="!collapsed" class="pe:whitespace-normal">{{ entry.label }}</span>
      </UButton>
    </div>
  </nav>
</template>
