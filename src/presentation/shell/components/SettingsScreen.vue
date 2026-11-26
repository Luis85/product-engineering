<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, defineAsyncComponent } from "vue";
import { useNavigate, useRoute, useRouting } from "../navigation";
import { useMessages } from "../runtime/use-runtime";
import NotFoundState from "./NotFoundState.vue";

const catalog = useMessages();
const { definition } = useRouting();
const route = useRoute();
const navigate = useNavigate();
const sections = (definition.sections ?? []).map((section) => ({
  ...section,
  view: defineAsyncComponent(section.component),
  badgeView: section.badge ? defineAsyncComponent(section.badge) : undefined,
}));
const current = computed(() =>
  sections.find((section) => definition.equals(section.route, route.value)),
);
const active = {
  "aria-current": "page",
  color: "primary",
  class:
    "pe:font-semibold pe:after:absolute pe:after:inset-x-2 pe:after:bottom-0 pe:after:h-0.5 pe:after:rounded-full pe:after:bg-primary",
} as const;
const inactive = { color: "neutral" } as const;
const buttons = computed(() => {
  const selected = current.value?.id;
  return sections.map((section) => ({
    ...section,
    attrs: section.id === selected ? active : inactive,
  }));
});
</script>

<template>
  <div data-testid="settings-screen" class="pe:grid pe:min-w-0 pe:gap-4">
    <nav
      v-if="sections.length > 1"
      data-testid="settings-sections"
      :aria-label="catalog.shell.frame.settingsSections"
    >
      <ul class="pe:flex pe:flex-wrap pe:items-center pe:gap-1 pe:border-b pe:border-default">
        <li v-for="section in buttons" :key="section.id" class="pe:min-w-0 pe:max-w-full">
          <UButton
            v-bind="section.attrs"
            variant="ghost"
            type="button"
            size="sm"
            class="pe:relative pe:max-w-full pe:flex-wrap pe:text-left pe:whitespace-normal"
            @click="navigate(section.route)"
          >
            <span>{{ section.label(catalog) }}</span>
            <component :is="section.badgeView" v-if="section.badgeView" />
          </UButton>
        </li>
      </ul>
    </nav>
    <component :is="current.view" v-if="current" :key="current.id" />
    <NotFoundState v-else />
  </div>
</template>
