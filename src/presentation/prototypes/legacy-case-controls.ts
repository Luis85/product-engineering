import fixture from "./legacy-pt-03.html?raw";

export const bundledPrototypeHtml = fixture;

export type LegacyCaseLabels = {
  readonly heading: string;
  readonly caption: string;
  readonly contact: string;
  readonly status: string;
};

export const legacyCaseStyles = `<style>
main{padding:clamp(1rem,3vw,1.5rem)}
main>p{margin:.25rem 0 .9rem}
.case-toggle{padding:0;min-height:2rem;text-align:start;overflow-wrap:anywhere;color:inherit;background:transparent;border:0}
.case-toggle::before{content:"›";display:inline-block;margin-inline-end:.4rem}
.case-toggle[aria-expanded="true"]::before{transform:rotate(90deg)}
.case-detail td{background:#f6f5f9}
.case-detail p{margin:.25rem 0 0}
@media(max-width:28rem){
  main{padding:.65rem}
  .tools,label{gap:.35rem}
  .tools button,.tools select{padding-inline:.45rem}
  table{table-layout:fixed}
  th,td{padding:.45rem .35rem;overflow-wrap:anywhere;vertical-align:top}
  th:nth-child(2){width:36%}
}
</style>`;

export function legacyCaseScript({ contact, status }: LegacyCaseLabels) {
  const localized = JSON.stringify({ contact, status }).replace(/</g, "\\u003c");
  return `
const caseLabels = ${localized};
let selectedCase = null;
function selectCase(next) {
  if (selectedCase) {
    selectedCase.detail.hidden = true;
    selectedCase.button.setAttribute("aria-expanded", "false");
  }
  selectedCase = next;
  if (next) {
    next.detail.hidden = false;
    next.button.setAttribute("aria-expanded", "true");
  }
}
function addCaseToggle(row) {
  const [idCell, titleCell, contactCell, statusCell] = row.cells;
  const detailId = "case-detail-" + idCell.textContent;
  const title = titleCell.textContent;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "case-toggle";
  button.textContent = title;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", detailId);
  titleCell.replaceChildren(button);

  const detail = document.createElement("tr");
  detail.className = "case-detail";
  detail.id = detailId;
  detail.hidden = true;
  const cell = detail.insertCell();
  cell.colSpan = row.cells.length;
  const heading = document.createElement("strong");
  heading.textContent = idCell.textContent + " · " + title;
  const information = document.createElement("p");
  information.textContent = caseLabels.contact + ": " + contactCell.textContent + " · " + caseLabels.status + ": " + statusCell.textContent;
  cell.append(heading, information);
  row.after(detail);

  const entry = { button, detail };
  button.addEventListener("click", () => selectCase(entry === selectedCase ? null : entry));
}
rows.forEach(addCaseToggle);
statusFilter.addEventListener("change", () => selectCase(null));
`;
}
