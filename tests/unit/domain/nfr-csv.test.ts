import { expect, it } from "vitest";
import { previewNfrCsv } from "../../../src/domain/backlog";

const header = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien";
const kim = "project-member-33333333-3333-4333-8333-000000000001";
const members = [{ id: kim, name: "Kim" }] as const;
const preview = (source: string) => previewNfrCsv(source, [], members);

it("parses BOM, both standards, German labels, quoted separators, doubled quotes and multiline fields", () => {
  expect(
    preview(
      `\uFEFF${header}\r\nIndex;"Die Suche liefert ""Treffer""; mobil.";"Unter 100 ms\r\nbei 10 000 Datensätzen";Kim;Leistungseffizienz|ISO/IEC 27001:Technische Maßnahmen|performance-efficiency`,
    ),
  ).toEqual({
    issues: [],
    rows: [
      {
        line: 2,
        status: "new",
        values: {
          title: "Index",
          requirement: 'Die Suche liefert "Treffer"; mobil.',
          acceptance: "Unter 100 ms\nbei 10 000 Datensätzen",
          owner_id: kim,
          categories: ["performance-efficiency", "technological"],
        },
      },
    ],
  });
  expect(
    preview(
      'Kategorien,Titel,Verantwortlich,Abnahmekriterium,Anforderung\n,"Index, mobil",,100 ms,Schnell',
    ).rows[0],
  ).toMatchObject({
    status: "new",
    values: { title: "Index, mobil", categories: [] },
  });
});

it("diagnoses distinct header, physical row positions, malformed quotes and field counts", () => {
  expect(preview(`${header}\r"Whitespace after quote" \t;A;B;;`).rows[0]).toMatchObject({
    line: 2,
    status: "new",
    values: { title: "Whitespace after quote" },
  });
  expect(preview("").issues).toEqual([{ line: 1, code: "header-missing" }]);
  expect(preview(`\n${header.replace("Kategorien", "Titel")}\nFoo;a;b;;`).issues).toEqual([
    { line: 2, code: "header" },
  ]);
  expect(preview(header).issues).toEqual([{ line: 1, code: "rows-missing" }]);
  const source = `${header}\r\nIndex;"Mehrzeiliger\r\nText";Unter 1s;;security\r\nIndex;Andere Angaben;Unter 1s;;security\r\nBad;A"B;c;;\r\nTail;"X"Y;c;;\r\nKurz;X\r\nEnd;"Offen\r\nnoch offen`;
  expect(preview(source).issues.map(({ line, code }) => [line, code])).toEqual([
    [4, "conflict"],
    [5, "quote"],
    [6, "quote-tail"],
    [7, "columns"],
    [8, "quote-open"],
  ]);
});

it("rejects blank required fields, bad categories, and ambiguous or foreign owners", () => {
  const source = `${header}\n; ; ;John;|27001:security\nOther;A;B;Kim;Organisatorische Maßnahmen`;
  const result = previewNfrCsv(
    source,
    [],
    [...members, { id: "project-member-33333333-3333-4333-8333-000000000002", name: "KIM" }],
  );
  expect(result.issues).toEqual([
    { line: 2, code: "title" },
    { line: 2, code: "requirement" },
    { line: 2, code: "acceptance" },
    { line: 2, code: "owner", value: "John" },
    { line: 2, code: "category-empty" },
    { line: 2, code: "category", value: "27001:security" },
    { line: 3, code: "owner", value: "Kim" },
  ]);
});

it("skips normalized identical records, but rejects a match when a conflicting stored title also exists", () => {
  const existing = {
    title: "Änderung",
    requirement: "A",
    acceptance: "B",
    categories: ["security", "organizational"],
  } as const;
  const source = `${header}\nA\u0308NDERUNG;A;B;;organizational|security\nNeue;A;B;${kim};\nNeue;A;B;Kim;`;
  expect(previewNfrCsv(source, [existing], members).rows.map(({ status }) => status)).toEqual([
    "skip",
    "new",
    "skip",
  ]);
  expect(
    previewNfrCsv(source, [existing, { ...existing, acceptance: "C" }], members).issues,
  ).toEqual([{ line: 2, code: "conflict" }]);
});
