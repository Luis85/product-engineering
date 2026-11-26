import { onScopeDispose, ref, shallowRef } from "vue";
import { applyCopilotProposal, prepareCopilotProposal } from "../../application/integrations";
import type { CopilotProposal } from "../../application/integrations";
import type { ProjectId } from "../../application/projects";
import type { Route } from "../../application/routes";
import { parseCopilotProposal } from "../../domain/integrations";
import type { CopilotProposalContent } from "../../domain/integrations";
import { useCommand, useQuery } from "../shell";

export function useCopilotProposal(projectId: ProjectId, destination: (route: Route) => void) {
  const prepare = useQuery(prepareCopilotProposal);
  const apply = useCommand(applyCopilotProposal);
  const proposal = shallowRef<{
    readonly context: CopilotProposal;
    readonly content: CopilotProposalContent;
  }>();
  const staleProposal = ref(false);
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  function captureProposal(context: CopilotProposal, reply: string) {
    const content = parseCopilotProposal(reply);
    if (!content) return false;
    proposal.value = { context, content };
    staleProposal.value = false;
    return true;
  }

  async function applyProposal(content: CopilotProposalContent, asNew: boolean) {
    const current = proposal.value;
    if (!current || apply.pending.value) return;
    const result = await apply.run(projectId, current.context, content, asNew);
    if (disposed || proposal.value !== current) return;
    if (result._tag === "success") {
      proposal.value = undefined;
      destination(result.value);
    } else if (result._tag === "failure" && current.context.base && !asNew) {
      staleProposal.value = true;
    }
  }

  return { prepare, apply, proposal, staleProposal, captureProposal, applyProposal };
}
