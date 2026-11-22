import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, onScopeDispose, ref, shallowRef } from "vue";
import type { AppError } from "../../application/errors";
import type { Note, RecordRow } from "../../application/notes";
import type { UserMessage } from "../../application/shell";
import { editedValues, rebaseRecordFrontmatter, sameFrontmatterValue } from "../../domain/notes";
import type {
  FieldIssue,
  FormDraft,
  FormInput,
  NoteFieldCode,
  NoteFieldConflict,
  NoteFields,
  NoteIssue,
  NoteKey,
  NoteType,
} from "../../domain/notes";
import { useCommand, useMessages } from "../shell";
import type { UseCaseFn } from "../shell";
import { allChoicesMade } from "./conflict";
import type { ConflictChoices } from "./conflict";

type FormSummary = { readonly title: string; readonly detail: string };
type FormRoot = () => HTMLElement | null | undefined;
type Saved = Pick<Note, "frontmatter">;

type RecordFormOptions<
  Fields extends NoteFields,
  Extra extends NoteIssue,
  Issue extends FieldIssue,
  Error extends AppError,
> = {
  readonly type: NoteType<Fields>;
  readonly record?: RecordRow<Fields, Extra>;
  readonly initial: FormInput;
  readonly create: UseCaseFn<[FormInput], Saved, Error>;
  readonly update: UseCaseFn<[RecordRow<Fields, Extra>, FormInput], Saved, Error>;
  readonly invalid: Error["_tag"];
  readonly rules: (input: FormInput) => readonly Issue[];
  readonly describe: (
    issue: Issue | FieldIssue<NoteKey<Fields>, NoteFieldCode<Fields>> | Extract<Extra, FieldIssue>,
  ) => string;
  readonly labels: Readonly<Record<NoteKey<Fields>, string>>;
  readonly summary: FormSummary;
  readonly root: FormRoot;
  readonly done: (id: string) => void;
};

function fieldIssues<Issue extends FieldIssue>(
  issues: readonly Issue[],
): ReadonlyMap<string, Issue> {
  return new Map(issues.map((issue) => [issue.key, issue]));
}

function writeIssues<Issue extends FieldIssue>(
  error: AppError,
  tag: AppError["_tag"],
): readonly Issue[] | undefined {
  if (error._tag !== tag || !("issues" in error) || !Array.isArray(error.issues)) return;
  return error.issues as readonly Issue[];
}

function initialIssues<Fields extends NoteFields, Issue extends NoteIssue>(
  row?: RecordRow<Fields, Issue>,
) {
  return (
    row?.issues.filter(
      (
        entry,
      ): entry is FieldIssue<NoteKey<Fields>, NoteFieldCode<Fields>> | Extract<Issue, FieldIssue> =>
        "key" in entry,
    ) ?? []
  );
}

function focusFirstInvalid(root: FormRoot) {
  return nextTick(() => root()?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export function useRecordForm<
  Fields extends NoteFields,
  Extra extends NoteIssue,
  Issue extends FieldIssue,
  Error extends AppError,
>(options: RecordFormOptions<Fields, Extra, Issue, Error>) {
  const messages = useMessages().notes;
  const loaded = shallowRef(options.record);
  const starting: FormDraft = { ...(options.record?.values ?? options.initial) };
  const draft = shallowRef(starting);
  const original = fieldIssues(initialIssues(options.record));
  const server = shallowRef<{
    readonly input: FormInput;
    readonly issues: ReadonlyMap<string, Issue>;
  }>();
  const showValidation = ref(false);
  const showSummary = ref(false);
  const message = shallowRef<UserMessage>();
  const conflicts = shallowRef<readonly NoteFieldConflict[]>([]);
  let active = true;
  onScopeDispose(() => {
    active = false;
  });

  const save = useCommand((input: FormInput) => {
    const record = loaded.value;
    if (!record) return options.create(input);
    return options.update(record, editedValues(options.type, input, draft.value, record.values));
  });

  function revealInvalid() {
    showValidation.value = true;
    showSummary.value = true;
    return focusFirstInvalid(options.root);
  }

  const form = useForm({
    defaultValues: starting,
    validators: {
      onSubmit({ value }) {
        const issues = options.rules(value);
        return issues.length > 0 ? options.summary.title : undefined;
      },
    },
    onSubmitInvalid: () => {
      void revealInvalid();
    },
    async onSubmit({ value }) {
      const outcome = await save.run(value);
      if (!active) return;
      if (outcome._tag === "success") {
        const id = outcome.value.frontmatter.id;
        if (typeof id === "string") options.done(id);
      } else if (outcome._tag === "failure") {
        if (outcome.error._tag === "NoteEditConflictError") {
          conflicts.value = outcome.error.conflicts;
          return;
        }
        const issues = writeIssues<Issue>(outcome.error, options.invalid);
        if (issues && issues.length > 0) {
          server.value = { input: value, issues: fieldIssues(issues) };
          await revealInvalid();
        } else {
          message.value = outcome.message;
        }
      }
    },
  });

  const input = form.useSelector((state) => state.values);
  const submitting = form.useSelector((state) => state.isSubmitting);
  const blocked = computed(
    () => submitting.value || save.pending.value || conflicts.value.length > 0,
  );
  const validation = computed(() => fieldIssues(options.rules(input.value)));

  function issue(key: string): string | undefined {
    const current = input.value[key];
    const rejection = server.value;
    const rejected = rejection?.issues.get(key);
    if (rejected && sameFrontmatterValue(current, rejection?.input[key]))
      return options.describe(rejected);
    const changed = !sameFrontmatterValue(current, starting[key]);
    const saved = original.get(key);
    if (saved && !changed) return options.describe(saved);
    const problem = validation.value.get(key);
    return problem && (showValidation.value || changed) ? options.describe(problem) : undefined;
  }

  function submit() {
    if (blocked.value) return;
    showSummary.value = false;
    message.value = undefined;
    server.value = undefined;
    return form.handleSubmit();
  }

  async function applyChoices(choices: ConflictChoices): Promise<void> {
    const record = loaded.value;
    const fields = conflicts.value;
    if (!record || !allChoicesMade(fields, choices)) return;
    const rebased = rebaseRecordFrontmatter(options.type, record.frontmatter, fields);
    if (rebased._tag === "Failure") {
      const reason = rebased.failure.reason;
      message.value = {
        severity: "warning",
        title: messages.writeRefused.title,
        detail: messages.writeRefused.details[reason],
      };
      conflicts.value = [];
      return;
    }

    loaded.value = {
      ...record,
      frontmatter: rebased.success,
      values: options.type.check(rebased.success).values,
    };
    draft.value = {
      ...draft.value,
      ...Object.fromEntries(fields.map(({ key, current }) => [key, current])),
    };
    for (const { key, current } of fields) {
      if (choices[key] === "current") form.setFieldValue(key, current);
    }
    conflicts.value = [];
    showValidation.value = true;
    await nextTick(() => {
      const root = options.root();
      const focus =
        root?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        root?.querySelector<HTMLElement>('[type="submit"]');
      focus?.focus();
    });
  }

  return {
    form,
    input,
    issue,
    pending: save.pending,
    blocked,
    conflicts,
    summary: computed(() => (showSummary.value ? options.summary : undefined)),
    message,
    labels: options.labels,
    submit,
    applyChoices,
  };
}
