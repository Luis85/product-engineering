import { nfrCategories, nfrStandards, pbiFeature } from "../../domain/backlog";
import type { NfrCategory } from "../../domain/backlog";
import type { ResolvedPrototypeBrief } from "./brief";
import type { en } from "./i18n/en";

type Labels = typeof en.brief;
type Inputs = NonNullable<ResolvedPrototypeBrief["inputs"]>;

const heading = (level: number, title: string, ...body: string[]) =>
  ["#".repeat(level) + " " + title, ...body.filter(Boolean)].join("\n\n");
const list = (rows: readonly string[]) => rows.map((row) => "- " + row).join("\n");
const ref = ({ title, id }: { title: string; id: string }) => `${title} (${id})`;

function journeySection(journey: NonNullable<Inputs["journey"]>, text: Labels) {
  const cardRow = ({ id, title, sliceId, description }: (typeof journey.cards)[number]) => {
    const links = journey.links
      .filter(({ cardId }) => cardId === id)
      .map(({ recordId }) => recordId);
    const notes = journey.work
      .filter(({ cardId }) => cardId === id)
      .map((item) => `  - ${ref(item)} · ${item.body}`);
    const deferred = journey.sliceDeferrals.some(
      (entry) => entry.cardId === id && entry.sliceId === sliceId,
    );
    return [
      [ref({ id, title }), sliceId, deferred && text.deferred, description, ...links]
        .filter(Boolean)
        .join(" · "),
      ...notes,
    ].join("\n");
  };
  const stepSection = (step: (typeof journey.steps)[number]) =>
    heading(
      4,
      ref(step),
      list(journey.cards.filter(({ stepId }) => stepId === step.id).map(cardRow)),
    );
  const activitySections = journey.activities.map((activity) =>
    heading(
      3,
      ref(activity),
      ...journey.steps.filter(({ activityId }) => activityId === activity.id).map(stepSection),
    ),
  );
  const otherSteps = journey.steps
    .filter(({ activityId }) => !journey.activities.some(({ id }) => id === activityId))
    .map(stepSection);
  const otherCards = journey.cards.filter(
    ({ stepId }) => !journey.steps.some(({ id }) => id === stepId),
  );
  return heading(
    2,
    text.journey,
    `${journey.displayId} · ${journey.title}\n\n${text.persona} · ${journey.persona}\n\n${text.goal} · ${journey.goal}`,
    ...activitySections,
    ...otherSteps,
    list(otherCards.map(cardRow)),
    ...(journey.slices.length
      ? [
          heading(
            3,
            text.slices,
            list(
              journey.slices.map((slice) =>
                [ref(slice), slice.outcome].filter(Boolean).join(" · "),
              ),
            ),
          ),
        ]
      : []),
  );
}

function backlogSection(items: Inputs["backlog"], text: Labels, language: "de" | "en") {
  return heading(
    2,
    text.backlog,
    ...items.map((item) => {
      if (item.missing) return heading(3, `${item.id} · ${text.missing}`);
      return heading(
        3,
        `${item.id} · ${item.title}`,
        item.parent ? `${text.parent} · ${item.parent}` : "",
        item.body,
        typeof item.requirement === "string" ? `${text.requirement} · ${item.requirement}` : "",
        list(item.sources.map(({ kind, id }) => `${kind} · ${id}`)),
        list(item.criteria.map(({ id, text: criterion }) => `${id} · ${criterion}`)),
        pbiFeature(item, item.criteria, language),
      );
    }),
  );
}

function nfrSection(
  nfrs: Inputs["nfrs"],
  text: Labels,
  categoryLabel: (id: NfrCategory) => string,
) {
  return heading(
    2,
    text.nfrs,
    ...nfrs.map((nfr) =>
      heading(
        3,
        ref(nfr),
        nfr.requirement,
        `${text.acceptance}\n\n${nfr.acceptance}`,
        nfr.categories.length
          ? `${text.taxonomy} · ${nfr.categories
              .map((id) => {
                const standard = nfrCategories.find(([category]) => category === id)?.[1];
                return `${categoryLabel(id)} (${standard ? nfrStandards[standard] : id} · ${id})`;
              })
              .join(", ")}`
          : "",
        `${text.origins} · ${nfr.sources
          .map((source) =>
            ref({
              ...source,
              id: source.displayId ?? source.id,
            }),
          )
          .join(" / ")}`,
      ),
    ),
  );
}

function domainSection(domain: Inputs["domain"], text: Labels) {
  return heading(
    2,
    text.domain,
    ...domain.entities.map((entity) =>
      heading(
        3,
        ref({ ...entity, id: entity.displayId }),
        entity.definition,
        `${text.origins} · ${entity.origins.map(ref).join(" / ")}`,
        list(
          entity.attributes.map(({ name, description }) =>
            [name, description].filter(Boolean).join(" · "),
          ),
        ),
      ),
    ),
    ...(domain.neighbors.length
      ? [heading(3, text.neighbors, list(domain.neighbors.map(ref)))]
      : []),
    ...(domain.edges.length
      ? [
          heading(
            3,
            text.relationships,
            list(
              domain.edges.map(
                (edge) =>
                  `${ref(edge.sourceEntity)} → **${edge.verb}** → ${ref(edge.targetEntity)} · ${edge.id}\n  - ${text.sourceCardinality} · ${edge.sourceCardinality}\n  - ${text.targetCardinality} · ${edge.targetCardinality}${edge.rule ? "\n  - " + edge.rule : ""}`,
              ),
            ),
          ),
        ]
      : []),
  );
}

function foundationFiles(files: Inputs["files"], text: Labels) {
  return heading(
    2,
    text.files,
    ...files.map((file) => {
      const references = file.references.map(
        (reference) => "`" + reference.replaceAll("`", "'") + "`",
      );
      const details = [references.join(" · "), `${text.origins} · ${file.origins.join(" / ")}`];
      if (file.status === "text") details.push(file.text, file.truncated ? text.excerpt : "");
      else details.push(text.fileStatus[file.status]);
      return heading(3, file.path ?? text.missing, ...details);
    }),
  );
}

export function prototypeBriefMarkdown(
  brief: ResolvedPrototypeBrief,
  text: Labels,
  categoryLabel: (id: NfrCategory) => string,
  language: "de" | "en",
  includeFiles = true,
) {
  const { project, title, displayId, description, selection, sourceId, inputs } = brief;
  return (
    [
      heading(1, `${text.title} · ${title}`),
      `${text.project} · ${project.name} (${project.id})\n\n${text.prototype} · ${displayId}\n\n${text.scope} · ${selection ? ref({ ...selection, id: selection.displayId }) : [sourceId, text.missing].filter(Boolean).join(" · ")}`,
      heading(2, text.task, description),
      heading(2, text.result, text.offline),
      ...(inputs?.journey ? [journeySection(inputs.journey, text)] : []),
      ...(inputs?.backlog.length ? [backlogSection(inputs.backlog, text, language)] : []),
      ...(inputs?.nfrs.length ? [nfrSection(inputs.nfrs, text, categoryLabel)] : []),
      ...(inputs?.domain.entities.length ? [domainSection(inputs.domain, text)] : []),
      ...(inputs?.documents.length
        ? [
            heading(
              2,
              text.documents,
              ...inputs.documents.map((document) =>
                heading(
                  3,
                  `${text.documentKinds[document.kind as keyof Labels["documentKinds"]] ?? document.kind} · ${document.title ? ref({ title: document.title, id: document.displayId ?? document.id }) : document.id + " · " + text.missing}`,
                  `${text.origins} · ${document.origins.join(" / ")}`,
                  document.requirement ? `${text.requirement} · ${document.requirement}` : "",
                  document.body ?? "",
                ),
              ),
            ),
          ]
        : []),
      ...(includeFiles && inputs?.files.length ? [foundationFiles(inputs.files, text)] : []),
    ].join("\n\n") + "\n"
  );
}
