<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted } from "vue";
import type { ResolvedPrototypeBrief } from "../../application/prototypes";
import { isKnowledgeId } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import type { PrototypeId } from "../../domain/prototypes";
import { useRestoreWorkspacePosition, useWorkspaceOriginKey } from "../projects";
import { useMessages } from "../shell";
import { usePrototypeNoteNavigation } from "./note-navigation";

type Row = {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly string[];
  readonly note?: KnowledgeId;
};
type Inputs = NonNullable<ResolvedPrototypeBrief["inputs"]>;

const { brief, prototypeId } = defineProps<{
  readonly brief: ResolvedPrototypeBrief;
  readonly prototypeId: PrototypeId;
}>();
const text = useMessages().prototypes.brief;
const openNote = usePrototypeNoteNavigation();
const noteFocusPrefix = "prototype-brief-note-";
const revealOnReturn = useWorkspaceOriginKey()()?.startsWith(noteFocusPrefix) ?? false;
const restore = useRestoreWorkspacePosition();
onMounted(() => restore());

function origins(sources: readonly { readonly title: string }[]) {
  return text.origins + " · " + sources.map(({ title }) => title).join(" / ");
}

function nfrRows(nfrs: Inputs["nfrs"]): Row[] {
  return nfrs.map((nfr) => ({
    id: nfr.id,
    title: nfr.title,
    lines: [nfr.requirement, text.acceptance + " · " + nfr.acceptance, origins(nfr.sources)],
  }));
}

function domainRows(domain: Inputs["domain"]): Row[] {
  return [
    ...domain.entities.map((entity) => ({
      id: entity.id,
      title: entity.displayId + " · " + entity.title,
      lines: [
        entity.definition,
        ...entity.attributes.map(({ name, description }) =>
          [name, description].filter(Boolean).join(" · "),
        ),
        origins(entity.origins),
      ],
    })),
    ...domain.edges.map((edge) => ({
      id: edge.id,
      title: `${edge.sourceEntity.title} → ${edge.verb} → ${edge.targetEntity.title}`,
      lines: [
        `${text.sourceCardinality} · ${edge.sourceCardinality} · ${text.targetCardinality} · ${edge.targetCardinality}`,
        edge.rule ?? "",
      ],
    })),
  ];
}

function documentRows(documents: Inputs["documents"]): Row[] {
  return documents
    .filter(({ kind }) => kind !== "style-guide" && kind !== "design-system")
    .map((doc) => ({
      id: doc.kind + ":" + doc.id,
      title: doc.title ? `${doc.displayId} · ${doc.title}` : `${doc.id} · ${text.missing}`,
      lines: [],
      ...(doc.title && isKnowledgeId(doc.id) && { note: doc.id }),
    }));
}

function fileRows(files: Inputs["files"]): Row[] {
  return files.map((file) => ({
    id: file.path ?? file.references.join(" · "),
    title: file.path ?? file.references.join(" · "),
    lines: file.status === "unavailable" ? [text.missing] : [],
  }));
}

const sections = computed(() => {
  if (!brief.inputs) return [];
  const input = brief.inputs;
  return [
    { title: text.nfrs, rows: nfrRows(input.nfrs) },
    { title: text.domain, rows: domainRows(input.domain) },
    { title: text.documents, rows: documentRows(input.documents) },
    { title: text.files, rows: fileRows(input.files) },
  ].filter(({ rows }) => rows.length);
});

function openDocument(id: KnowledgeId | undefined, event: MouseEvent) {
  if (id) return openNote(brief.project.id, prototypeId, id, event);
}
</script>

<template>
  <details
    v-if="sections.length"
    class="pe-prototype-brief pe-prototype-context"
    data-testid="prototype-brief-context"
    :open="revealOnReturn"
  >
    <summary>{{ text.context }}</summary>
    <div v-for="section in sections" :key="section.title">
      <h2>{{ section.title }}</h2>
      <ul>
        <li v-for="row in section.rows" :key="row.id">
          <UButton
            v-if="row.note"
            type="button"
            color="neutral"
            variant="link"
            class="pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-pe-focus-key="noteFocusPrefix + row.note"
            @click="openDocument(row.note, $event)"
            >{{ row.title }}</UButton
          >
          <strong v-else>{{ row.title }}</strong>
          <p v-for="(line, index) in row.lines.filter(Boolean)" :key="index">{{ line }}</p>
        </li>
      </ul>
    </div>
  </details>
</template>
