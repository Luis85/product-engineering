---
title: UX- und Qualitätsreview der Product Engineering Platform
date: 2026-11-22
status: prototype-review
---

# UX- und Qualitätsreview

**Der wichtigste Befund ist die Trennung von Planung, Lieferbereitschaft und Abnahme.** Die Backlog-Hierarchie beantwortet, wo Arbeit hingehört und wie sie priorisiert ist. Tasks, Issues und Bugs werden am PBI geführt. Ready und Done prüfen den konkreten Feature Request. So kann ein PBI im Backlog aktiv sein, ein freigegebener Request bereits laufen und ein offener Bug zugleich die Abnahme blockieren.

Prüfgegenstand ist der eigenständige HTML-Clickdummy mit Beispieldaten. Die Analyse nutzt die Nutzeraufgaben aus dem Produktkonzept, die sichtbaren Zustände der Oberfläche, eine Code-Durchsicht und Browser-Klickpfade. Die Quellen bilden den Bewertungsrahmen. Es gab keine moderierten Nutzertests, keinen vollständigen WCAG-Audit und keine Prüfung der künftigen Obsidian-, Git-, KI-, MCP- oder Factory-Integration.

## Recherche und angewandte Muster

| Recherchebereich | Entscheidung im Clickdummy |
| --- | --- |
| Heuristische Evaluation | Die Hauptaktion folgt dem aktuellen Zustand. Sichtbare Gate-Blocker nennen den nächsten Schritt. Rückgängig und Filter-Reset geben Kontrolle zurück. [1] |
| Informationsarchitektur | Stabile Projektnavigation, handlungsorientierte Überschriften, Listenansicht vor Detailansicht, Kontext und Nachweise in der jeweiligen Fachansicht. [1] [7] [8] |
| Komplexe Backlogs | Struktur, Prioritätsklasse, Rang und Status sind unterschiedliche Informationen. Begleititems haben einen PBI-Bezug. Die Produkt-Backlog-View ist das Referenzmodell für Ranking und Zuordnung. [9] [10] [11] [12] |
| Aufgabenstatus und Fehlerbehebung | Fortschritt erscheint als Text und Zähler. Fehlende Kriterien stehen am jeweiligen Gate. Automatisch erkannte Blocker verlinken auf das Item, das bearbeitet werden kann. [1] [5] [13] [14] |
| Tastatur, Touch und Reflow | Umgruppieren und Ranking haben klickbare Alternativen zum Ziehen. Die Navigation klappt auf kleinen Viewports ein. Breite Datentabellen scrollen innerhalb ihres Bereichs. Der Dialog setzt den Fokus auf ein Eingabefeld oder eine Schaltfläche. [2] [3] [4] [6] [8] |
| Definitionen im Arbeitsablauf | Ready konkretisiert die Eingangsvoraussetzungen. Done ergänzt die technische und fachliche Evidenz. Die Definition of Done ist im Scrum Guide ein Qualitätsmaßstab für das Increment. Der Clickdummy verwendet sie als projektbezogenes Gate für die Request-Abnahme. [15] [16] |
| Evaluationsgrenzen | ISO/IEC 25010:2023 strukturiert die Produktqualität. Für Gebrauchstauglichkeit unter realen Einsatzbedingungen dient ISO/IEC 25019:2023 als ergänzende Referenz. WCAG 2.2 liefert konkrete Prüfaspekte für die Oberfläche. [2] [17] [18] |

## Review aller Ansichten

| Ansicht | Nutzeraufgabe | Befund und Umsetzung | Für den Pilot offen |
| --- | --- | --- | --- |
| Überblick | Lieferstand und nächste Entscheidung erkennen | Der Projektstand benennt den wichtigsten offenen Vorgang. Sechs anklickbare Zustände führen in gefilterte Request-Listen. Nächste Schritte zeigen konkrete Aktionen. | Mit mehreren parallelen Reviews prüfen, ob Nutzer Durchsatz, Blocker und Priorität korrekt einschätzen. |
| Wissen | Research, Produktartefakte und Konzepte finden | Typfilter, Suche, Ergebniszahl und Reset. Eigener Einstieg „Konzepte“ mit arc42-Systembeschreibung, Test-, Betriebs-, Rollen- und Rechtekonzept sowie freier Vorlage. [20] | Auffindbarkeit und sinnvollen Vorlagenumfang bei größeren Produktordnern messen. |
| Wissensartefakt | Lesen, bearbeiten, verknüpfen und Commit prüfen | Lesen, Bearbeiten, Verknüpfungen und Git History bleiben eigene Aufgaben. Dokumente werden über tatsächlich verknüpfte PBIs zusammengeführt. | Obsidian-Pfade, Umbenennungen, Wikilinks und unterschiedliche Markdown-Formate im echten Vault prüfen. |
| Story Maps | Einen Nutzerablauf für das Projekt finden oder anlegen | Projektbezogene Liste mit Ziel, Nutzergruppe und direkter Anlage. | Verständlichkeit der Abgrenzung zwischen Story Map, Journey Map und Backlog prüfen. |
| Story-Map-Detail | Aktivitäten, Schritte, Lieferabschnitte und Stories pflegen | Nutzerablauf und Lieferplanung als zwei getrennte Achsen. Vorhandene Backlog-Items werden über Projekt und Item-ID verknüpft. Rückverweise bleiben am Backlog-Item sichtbar. | Navigation großer Maps, mobile Lesesicht und Zusammenarbeit im echten Vault testen. |
| Backlog | Themen strukturieren und priorisieren | Ebenenwahl und Filter sind getrennt. Die Liste zeigt Hierarchie, Priorität, Status und Verantwortliche. Rangwerte erscheinen im Ebenenfokus, Lieferdetails bei Bedarf. Begleititems haben eine sichtbare Anzahl und starten eingeklappt. [19] | Verschieben, Suchfilter und Undo mit großen, realen Produkt-Backlogs beobachten. |
| Use-Case-PBI | Verhalten, Kriterien und zugehörige Arbeit pflegen | Eigener Tab für Tasks, Issues und Bugs. Anzahl offener Items ist auf der Use-Case-Ansicht sichtbar. Git und Factory bleiben eigene Aufgaben. | Prüfen, ob Fachrollen Begleititems auch ohne Einweisung an der erwarteten Stelle finden. |
| Nachweiskette | Vom Bedarf bis zur Abnahme navigieren | Die erste Lücke hat eine direkte Aktion zum Use-Case. Artefaktstand und CI-Nachweis bleiben über IDs und Commits nachvollziehbar. | Sonderfälle mit mehreren Anforderungen und mehreren betroffenen PBIs modellieren. |
| Prototypen | Eine Variante finden und einem PBI zuordnen | Liste, Use-Case-Referenz und Anlegen bilden einen eigenen Arbeitsbereich. | Projektspezifische Vorlagen und Variantenvergleich mit dem Design-Team validieren. |
| Prototypdetail | Einen Ablauf testen oder als Datei mitnehmen | Vorschau, Code und Änderungen bleiben unterscheidbar. Leerzustand deaktiviert Export bei fehlenden Treffern. | Vorschau und Export mit realen Prototyp-Artefakten und Gerätetypen prüfen. |
| Feature Requests | Den nächsten Handlungsbedarf im Lieferprozess erkennen | Die Liste zeigt Auftrag, PBI, Status, Gate-Fortschritt und Run. Ein Gate-Zähler führt direkt zur Detailprüfung. | Filter nach Verantwortung, Warteschlange und Bearbeitungsdauer mit Factory-Operatoren erproben. |
| Feature-Request-Detail | Paket prüfen, freigeben und den Run verfolgen | Paket, Ready & Done, Factory-Run und Nachweise sind getrennte Tabs. Ready blockiert die Freigabe. Der Regelstand wird für den freigegebenen Request fixiert. | Freigabe durch verschiedene Rollen, parallele Revisionen und Übergabeunterbrechungen mit einer echten Factory prüfen. |
| Reviews | Eine prüfbare Abnahme in der Liste finden | Prüf-Commit, technische Freigabe und fachlicher Status bleiben eigene Informationen. | Sortierung und Zuweisung bei mehreren Produkten und Reviewern validieren. |
| Fachliche Review | Evidenz prüfen und eine Entscheidung dokumentieren | Akzeptanzkriterien und Prüfnachweise stehen zusammen. Done erklärt die fehlenden Bedingungen und verlinkt betroffene Begleititems. Erst danach ist Abnehmen möglich. | Screenreader-Ablauf und Berechtigung für Freigabe und Änderungsanfrage im echten System prüfen. |
| Projektverwaltung | Projektbezogene Regeln und Integrationen pflegen | Stammdaten, Team, Pflichtartefakte, Ready & Done, Vorlagen und Integrationen sind getrennt. Benutzer sehen, welche Regeln aktiv sind und welchen Regelstand sie konfigurieren. | Rollenbasierte Administration, Audit der Regeländerungen und Mehrbenutzerkonflikte festlegen. |

## Review der wiederkehrenden Komponenten

| Komponente | Eignung und umgesetzte Änderung | Offener Nachweis |
| --- | --- | --- |
| Projektnavigation und Kopfzeile | Produktkontext und Hauptbereich bleiben sichtbar. Mobile Menüs und Kontextleiste geben ihren Zustand programmatisch an. | Kontrast und Fokus unter den tatsächlichen Obsidian-Themes messen. |
| Suche, Filter und Ergebnisfelder | Im Wissensbereich direkt filterbar. Die globale Suche enthält auch Tasks, Issues und Bugs. Ein Reset bringt den Fokus zurück zum Suchfeld. | Screenreader-Ansagen für schnelle Eingabefolgen manuell prüfen. |
| Tabellen, Baum, Board und Drag-Griff | Parent-Zuordnung, Rang und Status separat. Der Griff öffnet eine Alternative ohne Ziehen. Kontextzeilen unterstützen die Orientierung. | Verschieben mit Touch und reinem Tastaturablauf bei sehr langen Tabellen beobachten. |
| Tabs und Breadcrumbs | Hauptaufgaben werden über benannte Umschalter gruppiert. Der Rückweg zur übergeordneten Liste bleibt sichtbar. | Semantik bei eingebetteten Tabs und Tastaturnavigation mit assistiver Technik prüfen. |
| Statuschips, Hinweise und Gate-Zähler | Text trägt die Zustandsinformation. Zähler und Blocker zeigen, wo eine Entscheidung aussteht. | Begriffe und Zuordnung zwischen Backlog, Factory und Fachreview in einem Verständnistest verifizieren. |
| Editor und Markdown-Export | Visuelle Formatierung, Quelltextvorschau und Datei-Export teilen denselben Arbeitsstand. | Roundtrips für Tabellen, verschachtelte Listen und Obsidian-Erweiterungen prüfen. |
| Dialoge, Formulare und Toasts | Benannte Eingaben, initialer Fokus, Schließen per Escape und Fokus-Rückgabe, soweit der Auslöser noch vorhanden ist. Konfigurieren und Bestätigen sind getrennte Aktionen. | Vollständigen Formularfehler- und Dialogtest mit Screenreader und hoher Vergrößerung durchführen. |
| Kontextleiste und KI-Copilot | Sekundäre Informationen stehen außerhalb des Hauptflusses. Auf schmalen Viewports führt das Öffnen zur Kontextleiste. KI-Antworten bleiben als Demo erkennbar. | Informationsmenge, Nachvollziehbarkeit einer KI-Empfehlung und Bedienung mit vielen Artefakten testen. |
| Git-Historie und Diff | Arbeitsstand, Item-Commit und Prüf-Commit haben verschiedene Bedeutungen. Änderungspfade und Factory-Paket bleiben nachvollziehbar. | Git-Renames, Merge-Konflikte, gleichzeitige Änderungen und Reproduzierbarkeit in echten Repositories prüfen. |
| Freigabe, Reset und Export | Gate deaktiviert die Freigabe und erklärt Ursachen. Reset erfordert eine Bestätigung. Export verwendet den referenzierten Paketstand. | Rechte, Wiederanlauf und konsistente Exportdateien bei Unterbrechungen testen. |

## Unabhängiger Review und vertiefte Korrekturen

Die Reviews deckten Produktmanagement und Backlog, Fachanalyse und Requirements, UX und Barrierefreiheit, Delivery und QA sowie Betrieb und technische Qualität ab. Für Story Maps gab es eigene Beiträge für Design, Implementierung und Verifikation. Die Befunde wurden am Clickdummy zusammengeführt.

| Perspektive | Korrektur im integrierten Stand |
| --- | --- |
| Product Owner und Stakeholder | Projektstand und nächste Entscheidung ersetzen das Beispielbanner. Die Lieferphasen sind klickbare Filter mit realen Request-Anzahlen. |
| Backlog-Planung | Zwischen Geschwisterzeilen wird sortiert. Der Drop auf den Ziel-Parent oder eine explizite Auswahl ändern den Cluster. Die Produktreihenfolge im Ebenenfokus lässt die Parent-Zuordnung bestehen. |
| Fachanalyse und Redaktion | Konzepte erhalten Vorlagen und Filter. Eine Bearbeitung mit ungespeicherten Änderungen wird beim Wechsel über die App-Navigation abgefragt. Sprachangaben in eingefügten Markdown-Codeblöcken bleiben beim Bearbeiten erhalten. |
| Factory und Betrieb | Veraltete Pakete können nicht erneut dispatcht werden. Eine Folgerevision hält frühere Run- und Commit-Referenzen fest und der Lieferumfang bleibt im Entwurf editierbar. |
| QA und Governance | Done-Blocker folgen den beim Freigeben erfassten und den später zugeordneten Begleititems. Eine Umgruppierung allein hebt einen offenen Blocker nicht auf. Fehlende historische Einzelbelege bleiben kenntlich. |
| Zuverlässigkeit | Deep Links enthalten die Projekt-ID. Bei nicht verfügbarem lokalen Speicher zeigt die App den Sitzungsmodus. Das Browserprüfskript verwendet frische Nachweisbilder und prüft den Browser-Exitcode. |

## Nachprüfung der Arbeitsabläufe am 22. November 2026

Die Nachprüfung folgte konkreten Entscheidungen in zwei Beispielprojekten. Zu jedem bearbeiteten Fehler wurde zuerst das bisherige Verhalten im Browser reproduziert. Besonders aufschlussreich waren der Rückweg aus einem Detail, das Abbrechen eines Dialogs mit laufender Bearbeitung und das erneute Öffnen nach einem Reload.

| Perspektive | Geprüfte Ansichten und Dialoge | Befund und überprüfte Änderung |
| --- | --- | --- |
| Produkt und Planung | Projektwähler, leerer Überblick, Story Maps, Aktivitäten, Schritte, Lieferabschnitt, Story, Begleititem und Übergabe an ein PBI | Der Einstieg in ein PBI brach bei fehlendem Epic oder Feature ab. Die erforderliche Einordnung lässt sich jetzt im begonnenen Ablauf abschließen. Abbrechen und Zurückkehren wurden ebenfalls geprüft. |
| Informationsarchitektur | Backlog-Liste und Board, Rang- und Bearbeitungsdialoge, PBI-Tabs, Kriterien, Wissensnotizen und ihre Verknüpfungen | Rangänderungen konnten Eingaben im Dialog verwerfen. Jetzt lässt sich die Bearbeitung fortsetzen oder abbrechen. Der Rückweg von einer Quelle öffnet wieder den gewählten PBI-Tab. Eine direkte Notizquelle erscheint genau einmal, auch wenn sie zusätzlich über ein PBI erreichbar ist. |
| Redaktion und Barrierefreiheit | Wissensbibliothek, Lesen, Editor, Git-Verlauf, Markdown-Vorschau, Linkdialog, Projektsuche, Projektwechsel, Kontextleiste und Copilot | Browser-Zurück konnte einen ungespeicherten Text verwerfen. Weiterbearbeiten erhält den Entwurf und setzt den Fokus zurück. Dasselbe wurde beim Anlegen eines Projekts geprüft. Escape schließt die Suche auch mit eingegebenem Suchtext. Die Suche findet `SM-01` und `PT-03` im Kundenportal und berücksichtigt nach einem Projektwechsel den neuen Bestand. Der Linkdialog lässt eine ungültige Adresse zur Korrektur stehen. [W3C · Dialoge](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [W3C · Fokusreihenfolge](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) |
| UX und Prototyping | Prototypübersicht, Briefing mit Gestaltungsvorgaben, Quellenzugriff aus Map, Liste, Board und Item, Browser-Vorschau, HTML-Übernahme und Export | Das Briefing übernimmt den ausgewählten Umfang. Von der Variante führt ein Rückweg zur Quelle. Wer während der Feature-Bearbeitung eine Variante anlegt, kann zum offenen Entwurf zurückkehren. Beispiel und generiertes HTML verwenden einen Browserrahmen mit Dateinamen. Eine erneute Simulation fragt vor dem Ersetzen eines importierten Ergebnisses nach. |
| Delivery und QA | Nachweiskette, Request-Paket, Ready/Done, Run und Rückfrage, Prüfnachweise, fachliche Review, Projektverwaltung und Teamdialog | Am Beispiel `FR-024` wurde der freigegebene Text mit einem nachträglich geänderten Arbeitsstand verglichen. Die Paketansicht hält den ursprünglichen Text lesbar und verlinkt den heutigen Stand. Eine Änderungsanfrage nennt Request, Revision und Prüf-Commit. Rückfragen zeigen den Umfang des konkreten Auftrags. Doppelte Teamzuordnungen lassen sich direkt am Eingabefeld korrigieren. |
| Qualitätsanforderungen und Governance | NFR-Katalog im Backlog, Anlegen und Bearbeiten, Normfilter, CSV-Import, Vorschau und Bestätigung | Eine Anforderung erhält ein messbares Abnahmekriterium. Dieselbe NFR kann mehreren Kategorien angehören. Die Vorschau meldet unbekannte Kategorien und Konflikte mit Zeilenangabe. Identische Einträge werden beim erneuten Import übersprungen. Das CSV-Beispiel aus der README wurde im Browser importiert und nach einem Reload wiedergefunden. |

Für die Übergabe aus der Planung und den Rückweg nach einer Korrektur dienten die GOV.UK-Muster für einzelne Entscheidungen und die Prüfung vor dem Bestätigen als Vergleich. Bei einer fachlich angefragten Änderung muss auch die Nachweiskette diesen konkreten Status zeigen. Die Unterscheidung der Review-Entscheidungen orientiert sich an der dokumentierten GitHub-Praxis. [GOV.UK · Question pages](https://design-system.service.gov.uk/patterns/question-pages/) · [GOV.UK · Check answers](https://design-system.service.gov.uk/patterns/check-answers/) · [GitHub · Resolving reviews](https://docs.github.com/en/pull-requests/concepts/resolving-reviews)

**Einordnung der Normen.** ISO/IEC 25010:2023 liefert das Modell für die Produktqualität. Die Sicherheitszuordnung verwendet die vier Themen der Referenzmaßnahmen aus Anhang A von ISO/IEC 27001:2022. Die Auswahl einer Kategorie dokumentiert den fachlichen Bezug. Ob die Anforderung erfüllt ist, muss das Team am jeweiligen Abnahmekriterium prüfen. [ISO · Produktqualitätsmodell](https://www.iso.org/standard/78176.html) · [ISO · Informationssicherheitsmanagement](https://www.iso.org/standard/27001)

**Prüfgrenzen.** Die Browserläufe nutzten isolierte lokale Daten und Desktop- sowie Telefon-Viewports. Tastaturbedienung, sichtbarer Fokus, Abbrechen, Datenbezüge und erneutes Laden wurden in ausgewählten Pfaden geprüft. Moderierte Nutzertests, Screenreader-Prüfungen, reale Geräte sowie die Anbindung an Obsidian, externe Agenten und eine produktive Factory stehen aus. Die CSV-Prüfung umfasste auch zitierte Felder mit Zeilenumbrüchen und verdoppelten Anführungszeichen. [RFC 4180 · CSV-Feldregeln](https://datatracker.ietf.org/doc/html/rfc4180)

### Abschließende Sichtprüfung nach Arbeitsbereich

Die Ansichten wurden mit den Beispieldaten des Kundenportals bei 1.338 und 390 Pixeln Breite im Browser durchgespielt. Der Vergleich umfasste auch geöffnete Dialoge, den Rückweg zu einem Eintrag und die Bedienung per Tastatur.

| Arbeitsbereich | Befund und Ergebnis |
| --- | --- |
| Überblick | Bei 390 px hatte der Titel „Gefilterte Servicefälle exportieren“ in der Prioritätenliste nur 87 px Platz. Er nutzt jetzt 320 px in der ersten Zeile. Priorität, Backlog-Status und Lieferstand stehen mit ihren Bezeichnungen darunter. |
| Wissen | **Notiz bearbeiten** ist beim Lesen direkt erreichbar. **Notizaktionen** bündelt weitere Befehle. Auf der Lesefläche gliedern Überschriften und Abstand die Abschnitte. Bei Wechseln zwischen Lesen, Bearbeiten, Verknüpfungen und Git-Verlauf änderte sich die Position des aktivierten Tabs im geprüften PRD um höchstens 1 px. Nach dem Rückweg aus einer Notiz bleibt der Fokus beim zuvor geöffneten Bibliothekseintrag. Vorher sprang die nächste Tab-Taste auf dem Telefon um mehr als 1.200 px zum Seitenanfang. |
| Story Maps | Die Map-Liste führt in den Nutzerablauf. Am Kopf der Map öffnen **Grundlagen**, **Prototypen**, **NFRs** und **Entitäten** jeweils die zugehörigen Einträge und Aktionen. Die Zähler bleiben gemeinsam sichtbar, auch bei 320 px. In der Vergleichsaufnahme bei 1.252 × 816 px sank die Höhe des eingeklappten Kopfbereichs von 348 auf 188 px. Der erste Lieferabschnitt begann bei 476 statt 636 px. Nach der Backlog-Prüfung führt die Zurück-Taste mit Fokus zum Auslöser im gleichen Abschnitt. |
| Backlog und Deliverables | Die vier Backlog-Ansichten bleiben auch auf schmalen Displays anwählbar. Beim Wechsel aus dem Feature-Editor in die Git-Historie schützt eine Rückfrage die angefangene Beschreibung. Bei Deliverables wurden das Verknüpfen einer vorhandenen Notiz, die Anlage aus einer Vorlage und das Abbrechen auf dem Telefon geprüft. |
| Domainmodel | Entitäten und Beziehungen waren bei beiden Breiten auswählbar. Die Auswahl im Diagramm behielt beim Wechsel zur nächsten Entität ihre Position im sichtbaren Ausschnitt. Zoom am Mauszeiger, Kameraverschiebung und die beschrifteten Bedienelemente wurden ergänzend geprüft. |
| Nachweiskette, Feature Requests und Reviews | Geprüft wurden vollständige und lückenhafte Nachweisketten, Entwurf und freigegebenes Paket, Ready/Done, Factory-Lauf, Rückfrage, Nachweis und Review-Entscheidung. Trace-Filter und Review-Checkboxen behielten den Fokus. Beim Setzen eines Prüfmerkmals verschob sich dessen Checkbox bei beiden Breiten um 0 px. |
| Prototypen und Projektverwaltung | Auf dem Telefon nutzen die Grundlagenlinks im Briefing nun die verfügbare Breite untereinander. Beim Entwurf genügt die Überschrift **Briefing**. Externe HTML-Übernahme, Export, Vorschau, Code und Revisionen wurden ebenso durchlaufen wie Team, Regeln, Vorlagen und Integrationen. Nach dem Umschalten der MCP-Freigabe per Leertaste bleibt der Fokus auf dem Schalter. |
| Plugin-Einstellungen und Copilot | Geprüft wurden ausgeschaltete KI, lokale Demo, die Optionen für einen eigenen Anbieter und die Gesprächsansicht als Seitenleiste und mobiles Menü. Bei 1.338 × 700 px sprang das Gespräch zuvor beim Senden nach oben, sodass **Abbrechen** unter dem sichtbaren Rand lag. Die Leiste behält jetzt ihre Scrollposition. Die laufende Anfrage lässt sich dort abbrechen und der Nachrichtentext weiterbearbeiten. |

Die Sichtprüfung nutzte lokale Chromium-/Edge-Sitzungen und simulierte Abläufe. Sie ergänzt die Browsertests um den Bildvergleich. Der Einsatz mit Screenreadern, auf physischen Telefonen und mit produktiven KI-, Factory- und MCP-Diensten bleibt gesondert zu prüfen.

## KI-Copilot im Produktprojekt

**Kontext auswählen.** ChatPRD bündelt Anweisungen, Wissen und Gespräche je Vorhaben. Im Clickdummy startet die Quellenwahl beim geöffneten Artefakt. Im Projektüberblick beginnt sie leer. Vor dem Senden lässt sich prüfen, welche Notizen, PBIs oder anderen Projektstände zur konkreten Frage gehören. [ChatPRD · Projekte und gespeichertes Wissen](https://www.chatprd.ai/docs/create-and-use-projects)

**Fragen, prüfen und schreiben.** ChatPRD verbindet Vorlagen mit Arbeitsaufträgen und nennt Lücken, Annahmen und Randfälle als Prüfpunkte für einen PRD. Im Clickdummy stehen Fragen und Reviews neben Entwürfen für Vision, JTBD, Research und PRD. Bei einer Überarbeitung wählt die Person eine bestehende Notiz als Ziel. Die vorgeschlagene Fassung bleibt bis zur ausdrücklichen Übernahme vom gespeicherten Notizstand getrennt. [ChatPRD · Vorlagen](https://www.chatprd.ai/docs/create-and-use-templates) · [ChatPRD · Einen PRD ausarbeiten und prüfen](https://www.chatprd.ai/docs/writing-your-first-prd)

**Lokaler und verbundener Betrieb.** Die lokale Demo sucht passende Textstellen, prüft ausgewählte Dokumentmerkmale und füllt Vorlagen aus. Ein konfigurierter Modellanbieter erhält beim Senden den Auftrag, die gewählten Quellentexte, die Projekthinweise und die bisherigen Nachrichten dieses Gesprächs. Frühere Nachrichten können bereits zitierte Quellen enthalten. Private Vault-Dateien und eingebettete Prototypdateien werden durch die Quellenwahl nicht eingelesen. Die Tests prüfen Moduswechsel, die Begrenzung des Pakets sowie fehlerhafte Modellantworten mit einem kontrollierten Transport. Produktive Anbieterverträge und die Qualität der Modellantworten müssen im jeweiligen Einsatz geprüft werden. Obsidian verlangt für Community-Plugins eine Offenlegung der verwendeten Netzwerkdienste und ihres Zwecks. [Obsidian · Developer policies](https://docs.obsidian.md/community-directory/developer-policies)

## Prüfung anhand ISO/IEC 25010:2023

Die neun Merkmale dienen als Bewertungsraster. „Im Clickdummy geprüft“ benennt einen konkreten Prototypnachweis. Die letzte Spalte hält die ausstehenden Prüfungen für die produktive Umsetzung fest. [17] [18]

| Qualitätsmerkmal | Stand im Clickdummy | Nachweis für das Produkt |
| --- | --- | --- |
| Funktionale Eignung | Anlegen und Ändern aller drei Begleititem-Typen, Ready- und Done-Regeln, Blockierung, Freigabe und Abnahme sind als Browserablauf prüfbar. | Vertragstests für Projektgrenzen, referenzierte Git-Stände, Freigaberechte und Factory-Zustandsübergänge. |
| Leistungseffizienz | Eine lokale HTML-Datei ohne CDN-Abhängigkeit. Browserprüfung mit Demodaten. | Interaktionslatenz, Speicher und Ressourcenbedarf in Obsidian auf Zielgeräten mit repräsentativen Backlogs messen. |
| Kompatibilität | Desktop- und Mobile-Viewport in Edge sowie lokale Markdown- und JSON-Exporte abgedeckt. | Obsidian- und Bases-Versionen, Git-Worktrees, OS-Dateisysteme und Factory-JSON-Verträge in einer Matrix prüfen. |
| Interaktionsfähigkeit | Heuristikreview der Ansichten. Direkte Aktionen an Blockern, Tastaturalternative für Ranking, benannte Steuerelemente und Fokus-Rückgabe. | Moderierte Aufgaben je Rolle und manuelle WCAG-Prüfungen mit Tastatur, Touch, Vergrößerung und Screenreader. |
| Zuverlässigkeit | Formularzustände, Undo, Revision und Versionsbindung der Regeln geprüft. Factory-Ausfall und Rückfrage sind simuliert. | Atomic Writes, doppelte Zustellung, Wiederanlauf, Rollback und konkurrierende Bearbeitung unter Fehlerbedingungen testen. |
| Sicherheit | Der Prototyp arbeitet mit lokalen Demodaten und simulierten Integrationen. Projektspezifische Konfiguration ist in den Daten getrennt. | Authentisierung, rollenbasierte Rechte, Projektisolation, geheime Daten, Markdown und Exportpfade in einem Sicherheitsreview prüfen. |
| Wartbarkeit | Backlog, Regeln, Editor, Git und Ansichten sind im Quellaufbau getrennt. Ein Browserablauf deckt die Übergänge ab. | Regeln als validierbares Schema publizieren, Testabdeckung für Zustandsregeln sichern und Obsidian-Adapter entkoppelt prüfen. |
| Flexibilität | Regeltypen lassen sich pro Projekt konfigurieren. Neue Regelstände wirken auf Entwürfe und kommende Freigaben. Freigegebene Requests behalten ihre Definitionen. | Migration mehrerer Vault-Schemata, Wiederverwendung von Projektvorlagen und Wechsel von Integrationsadaptern prüfen. |
| Safety | Keine sicherheitskritische Betriebsfreigabe ist Bestandteil der Demo. Bestätigung und Sperren schützen gegen versehentliche Bedienhandlungen. | Einsatzzweck und mögliche Auswirkungen realer Fehlfreigaben bewerten. Bei sicherheitskritischem Einsatz fachliche Freigabeschranken und Gefährdungsanalyse ergänzen. |

## Vom ersten Job zum ersten Backlog-Eintrag

Ein neues Projekt startet im Überblick mit **Ersten Job beschreiben**. Im Kundenportal öffnet die Demo dagegen die bereits ausgearbeitete Map „Servicefälle verlässlich übergeben“. Wer den Einstieg erprobt, legt über den Projektwähler ein eigenes Produktprojekt an. Wissen, Story Maps und Backlog sind dort zunächst leer.

### Welche Entscheidung wird weitergegeben?

| Station | Frage an das Team | Umsetzung im Clickdummy |
| --- | --- | --- |
| Job to Be Done | Wer möchte in welcher Situation welchen Fortschritt erreichen? | Die erste Notiz hält Situation, Ziel, heutige Alternative und Evidenz fest. Im Beispiel will die Koordinatorin offene Fälle an die nächste Schicht übergeben. Heute führt sie mehrere Ergebnisseiten von Hand zusammen. |
| Produktvision | Welche dauerhafte Verbesserung soll das Produkt bewirken? | Vom Job aus lässt sich die gemeinsame Produktvision anlegen oder wieder öffnen. Für das Kundenportal ist das eine verlässliche Übergabe ohne manuelle Zwischenlisten. |
| PRD | Welches Ergebnis verfolgen wir jetzt und woran erkennen wir den Erfolg? | Ein PRD referenziert die Vision und einen oder mehrere Jobs. `PRD-03` enthält `REQ-18` für die vollständige Übergabe der gefilterten Fälle der eigenen Organisation. Drei Minuten sind das Pilotziel. |
| Story Map | Welche Schritte führen die Koordinatorin zum Ergebnis? | Das Team kann die Map am PRD beginnen und den vorgeschlagenen Kontext bearbeiten. Anforderung und zugehörige Jobs bleiben als Quellen nachvollziehbar. Mehrere Lösungsentwürfe dürfen am selben PRD ansetzen. |
| Erster Lieferabschnitt | Was soll die Zielgruppe mit dieser Lieferung durchgängig tun können? | Das Team ordnet Storys einem benannten Abschnitt zu und beschreibt dessen Nutzerergebnis. Die Backlog-Prüfung öffnet die Storys genau dieses Abschnitts. |
| Backlog | Welche Arbeit ist schon abgedeckt, was übernehmen wir neu? | Pro Story kann das Team ein vorhandenes Item verknüpfen, ein PBI anlegen oder die Entscheidung zurückstellen. Neu angelegte und bereits bestehende PBIs sind in der Prüfung unterscheidbar. |

Der Überblick verlinkt vorhandene Jobs, Vision, PRD, Map und PBIs direkt. Bei mehreren Vorhaben lässt sich der Planungskontext wechseln. Sobald Feature Requests laufen, stehen die anstehenden Lieferentscheidungen im Vordergrund. Die fachliche Paketfreigabe hat eigene Kriterien.

### Die Übergabe an das Backlog am Beispiel

1. `JOB-12 · Offene Fälle verlässlich übergeben` und `PRD-03 / REQ-18` führen zur Map `SM-01`. Der erste Abschnitt reicht vom Öffnen der Fallübersicht bis zur Weitergabe der Liste. Hier wird CSV als konkrete Lösung sichtbar.
2. Die Export-Story verweist bereits auf `UC-09`, die Filter-Story auf `UC-14`. Die Übersichts-Story hat einen Feature-Verweis auf `FE-01`. Das Team kann darunter gezielt ein PBI für diese Story anlegen. Die unverplante Idee „Übergabeliste mit dem Team teilen“ liegt außerhalb des Abschnitts.
3. **PBI aus Story anlegen** übernimmt Titel, Bedarf und vorhandene Quellen. Das Team wählt das übergeordnete Feature. Fehlt die Hierarchie, lassen sich Epic und Feature bei derselben Übergabe anlegen. Das neue PBI erhält einen Rückweg zur Karte. Seine Verantwortung ist optional und bleibt bis zur Zuweisung offen.
4. Das Board zeigt **Product Backlog Items (PBIs)** in den Spalten **Backlog**, **Open**, **In Progress**, **Review**, **In Development** und **Done**. Im ursprünglich geprüften Board folgte **Done** direkt auf **Review**. Heute kennzeichnet **In Development** auch die Übergabe an die Factory. Die Liste zeigt zusätzlich die Hierarchie und Begleititems. Rang und Bearbeitungsstand gehören zum Backlog. Die Map beschreibt den Nutzerablauf und den geplanten Lieferumfang.

### Klärung und Prototyping am Vorhaben

**Begleititems.** Eine Story kann bereits vor der Übergabe einen Task, ein Issue, eine Frage oder einen Bug haben. Ihr Zähler zeigt, wie viele Einträge offen sind. Ein Eintrag kann an der Story bleiben oder einem verknüpften PBI zugeordnet werden. Bei mehreren PBIs wählt das Team die Zuordnung ausdrücklich. Änderungen am zugeordneten Eintrag sind von der Karte und vom PBI aus sichtbar. Eine offene Frage zählt bei der Prüfung aller offenen Begleititems. Die Bug-Regel berücksichtigt ausschließlich Bugs.

**Prototyp-Briefing.** Ausgangspunkt ist ein einzelnes Backlog-Item oder eine ganze Story Map. Das Team kann Styleguide und Designsystem aus dem Wissensbereich auswählen. Der Clickdummy kennzeichnet die lokale Generierung als Simulation. Für die Arbeit mit einem externen Agenten exportiert das Team das Briefing und übernimmt das zurückgelieferte HTML anschließend in die Prototypvorschau.

### Forschungsgrundlage und Prüfung

- **Job und Lösungsentwurf.** Die JTBD-Forschung untersucht den gewünschten Fortschritt in einer konkreten Situation. Bettencourt und Ulwick zeigen, wie das heutige Vorgehen Hinweise auf den zugrunde liegenden Job liefert. Torres beschreibt, wie mehrere Lösungen für dieselbe Gelegenheit verglichen werden können. Daraus folgt für den Einstieg, Job, heutige Hürde und Lösungsidee getrennt erfassbar zu machen. [Christensen Institute](https://www.christenseninstitute.org/theory/jobs-to-be-done/) · [Bettencourt und Ulwick](https://strategyn.com/wp-content/uploads/2019/10/The_Customer_Centered_Innovation_Map___HBR.pdf) · [Product Talk](https://www.producttalk.org/opportunity-solution-trees/)
- **Vision und PRD.** Pichlers Vision Board fragt nach der positiven Veränderung für die Zielgruppe. Atlassians PRD-Praxis konkretisiert Ziel, Umfang, Annahmen und Erfolgskriterien. Die vorgeschlagene Übergabe zeigt deshalb die gemeinsame Vision als Kontext und fokussiert die Arbeit am PRD auf eine überprüfbare Anforderung. [Product Vision Board](https://www.romanpichler.com/downloads/tools/Product-Vision-Board-with-Checklist.pdf) · [Atlassian zum PRD](https://www.atlassian.com/agile/product-management/requirements/)
- **Map und Backlog.** Patton beschreibt einen Release-Schnitt über mehrere Schritte, der einer Zielgruppe ein Ergebnis ermöglicht. Miro demonstriert sowohl die Auswahl bestehender Vorgänge als auch die Anlage aus einer Karte. Der Scrum Guide beschreibt ein geordnetes Product Backlog. Für das Kundenportal lässt sich daraus eine bewusste Übernahme je Story mit einem gemeinsamen Backlog ableiten. [Pattons illustrierte Anleitung](https://www.jpattonassociates.com/wp-content/uploads/2015/03/story_mapping.pdf) · [Miro Jira Cards](https://help.miro.com/hc/en-us/articles/360017572434-Jira-Cards) · [Scrum Guide](https://scrumguides.org/scrum-guide.html#product-backlog)
- **Orientierung über mehrere Sitzungen.** Das GOV.UK Design System zeigt, wie sichtbare Aufgaben, Reihenfolge und Bearbeitungsstand einen längeren Vorgang verständlich machen. Hier ist eine wiederaufnehmbare Empfehlung auf dem Überblick sinnvoll. Ob die Begriffe beim Produktteam funktionieren, muss am Entwurf geprüft werden. [GOV.UK, Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/)

**Erster Usability-Test.** Ein Product Owner bekommt ein leeres Projekt und einen kurzen Interviewauszug zur Schichtübergabe. Die Testleitung bittet die Person, eine erste nutzbare Übergabe zu planen und zu zeigen, was das Team dafür bauen soll. Eine zweite Person beginnt bei `UC-09` und erklärt, wem die Arbeit hilft, woran Erfolg erkennbar ist und was bewusst später kommt. Beobachtet werden die erste gewählte Aktion, unnötige Neueingaben, doppelte PBIs und die Auffindbarkeit des Rückwegs. Der Test ist für den umgesetzten Clickdummy vorgesehen. Ergebnisse aus moderierten Nutzertests stehen noch aus.

## Fachliche Entitäten als Wissensnotizen

Chens Entity-Relationship-Modell unterscheidet fachliche Entitäten, ihre Attribute und ihre Beziehungen. IBM erläutert, wie die Kardinalität die erlaubte Anzahl an jedem Beziehungsende beschreibt. Im Kundenportal lautet ein Beispiel **Organisation (1) umfasst Servicefall (0..*)**. Eine Organisation kann mehrere Servicefälle haben oder noch keinen. Ein Servicefall gehört genau einer Organisation. Das Verb und beide Werte bleiben auch in der Textansicht lesbar. [Chen · Originalarbeit im MIT-Archiv](https://dspace.mit.edu/entities/publication/5f4dcb94-111c-4368-8374-cec8842dee1d) · [IBM · Entity-Relationship-Diagramme](https://www.ibm.com/think/topics/entity-relationship-diagram)

Die Wissensnotiz und der Modellknoten teilen dieselbe Kennung. Der Markdown-Export verwendet flache Obsidian-Listeneigenschaften für Attributnamen und verknüpfte Entitäten. Beschreibungen, Verben und Kardinalitäten stehen lesbar im Text. Wikilinks verweisen auf stabile Dateinamen wie `[[ENT-02]]`. Im Browser wurden Umbenennungen von beiden Beziehungsenden aus und die Übereinstimmung von Export und Git-Stand geprüft. Für die grafische Bedienung dient WCAG 2.5.7 als Maßstab für Alternativen zum Ziehen. [Obsidian · Properties](https://obsidian.md/help/properties) · [W3C · Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

## User-Story-Maps mit Backlog-Anbindung

**Nutzeraufgabe.** Ein Produktteam erfasst einen durchgehenden Nutzerablauf, identifiziert Lücken und schneidet lieferbare Teilumfänge. Danach verlinkt es vorhandene Backlog-Items mit den Stories. Im Backlog bleibt sichtbar, zu welchen Maps und Stories ein Item beiträgt.

### Erkenntnisse aus der Recherche

| Perspektive | Erkenntnis | Konsequenz für den Clickdummy |
| --- | --- | --- |
| Story-Mapping-Methode | Jeff Patton beschreibt die Map als Möglichkeit, Arbeit im Zusammenhang eines Nutzerablaufs zu sehen. Gruppen und Schritte bilden einen erzählbaren Ablauf. Durchgehende Schnitte dienen der Planung von Lieferumfängen. | Map mit Zielgruppe und Ziel, horizontaler Abfolge von Aktivitäten und Nutzerschritten sowie vertikal angeordneten Lieferabschnitten. Der Schnitt wird über mehrere Schritte gelesen. [Patton · Backlog im Zusammenhang](https://jpattonassociates.com/making-sense-out-of-your-user-story-backlog/) · [Patton · Anleitung](https://www.jpattonassociates.com/wp-content/uploads/2015/01/patton_story_mapping_bettersw_1109.pdf) |
| Refinement und Releases | Agile Alliance und Atlassian beschreiben Story Mapping als visuelle Zusammenarbeit rund um Nutzeraufgaben und Prioritäten. Ein erster Lieferabschnitt soll einen zusammenhängenden Nutzungsablauf ermöglichen. | Lieferabschnitte erhalten einen Namen für die vereinbarte Lieferung. Beim gemeinsamen Durchgehen zeigt sich, ob für das Lieferziel ein Schritt fehlt. Ein Release-Schnitt bleibt eine fachliche Entscheidung des Teams. [Agile Alliance · Story Mapping](https://agilealliance.org/glossary/story-mapping/) · [Atlassian · Story Mapping](https://www.atlassian.com/agile/product-management/story-mapping) |
| Interaktion in visuellen Arbeitsräumen | Miro setzt auf eine strukturierte Vorlage und erlaubt Teams, den Umfang unter den Schritten zu platzieren. Journey Maps dokumentieren außerdem Erleben und Wahrnehmung in einem Szenario. | Desktop nutzt eine gerasterte Map mit beschrifteten Achsen und Aktionen am jeweiligen Element. Die Oberfläche fokussiert auf Stories und Lieferung, während Research und Journey-Evidenz als Kontext dienen können. [Miro · User Story Mapping](https://help.miro.com/hc/en-us/articles/360020712554-User-story-mapping) · [Nielsen Norman Group · Journey Mapping](https://www.nngroup.com/articles/journey-mapping-101/) |
| Anbindung an die Planung | Azure Boards nutzt Features und Epics zur Strukturierung größerer Backlogs. StoriesOnBoard zeigt eine reale Anbindung über Work-Item- und Release-Zuordnungen. Beide Perspektiven können auf dieselben Backlog-Items zugreifen. | Story-Karten referenzieren vorhandene Items über Projekt und Item-ID. Story-Reihenfolge und Lieferabschnitt sind Eigenschaften der Map. Backlog-Hierarchie und Backlog-Rang werden im Backlog gepflegt. Titel, Typ und Status werden beim Anzeigen aus dem aktuellen Item gelesen. [Microsoft · Epics und Features](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/define-features-epics) · [StoriesOnBoard · Azure Boards](https://docs.storiesonboard.com/en/articles/9100523-setting-up-azure-devops-integration-for-your-story-map) · [StoriesOnBoard · Release-Zuordnung](https://docs.storiesonboard.com/en/articles/9101384-how-to-setup-release-synchronization-with-azure-devops) |
| Obsidian und beständige Identität | Obsidian unterstützt Wiki- und Markdown-Links und kann interne Links bei Umbenennungen aktualisieren. Die dauerhafte Verknüpfung im Produktmodell braucht zusätzlich eine stabile Referenz. | Der Clickdummy verwendet stabile Item-IDs innerhalb eines Projekts. Für den Obsidian-Pilot empfiehlt sich eine projektgebundene Notiz-ID mit optionaler Pfadauflösung. Der Export kann ID und lesbaren Link kombinieren. [Obsidian · Interne Links](https://obsidian.md/help/links) |
| Barrierearme Bedienung | WCAG 2.2 verlangt für Ziehfunktionen eine Bedienalternative mit einem einzelnen Zeiger. Das WAI-ARIA-Gittermuster erfordert zusätzlich eine bewusst implementierte Fokus- und Pfeiltastensteuerung. Reflow erlaubt inhaltlich erforderliche zweidimensionale Bereiche. | Anlegen, zuordnen und umsortieren erfolgt über benannte Buttons und Auswahlfelder. Bei breiten Maps ist die zweidimensionale Fläche separat scrollbar. Für schmale Ansichten ist die Zuordnung jeder Story zu Schritt und Lieferung besonders wichtig. [W3C · Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) · [WAI-ARIA · Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) · [W3C · Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |

### Sechs Beispiele im Bildvergleich

| Beispiel | Worauf sich ein Blick lohnt |
| --- | --- |
| Jeff Patton, kommentierte Übersicht | In der Skizze auf Seite 1 zeigen Pfeile auf die Aktivitäten und Schritte des *Backbone*. Details hängen unter dem jeweiligen Schritt. Links neben einem horizontalen Schnitt steht das angestrebte Ergebnis für die Zielgruppe. [Quick Reference, Seite 1](https://jpattonassociates.com/wp-content/uploads/2015/03/story_mapping.pdf#page=1) |
| Jeff Patton, Flugbuchung | Abbildung 2 erzählt die Buchung von der Wahl des Reiseziels bis zur Bezahlung. Abbildung 3 ergänzt Varianten unter den einzelnen Schritten. So gehören Flughafencode und Stadtname beide zur Ortswahl, während die Zahlung ihre eigene Spalte behält. [Flugbuchung, Abbildungen 2 und 3](https://www.jpattonassociates.com/wp-content/uploads/2015/01/patton_story_mapping_bettersw_1109.pdf#page=4) |
| Nielsen Norman Group, mobile Scheckeinreichung | Oberhalb der Linie für den ersten Prototyp liegen das Fotografieren des Schecks und die Bestätigung der Einreichung. Eine spätere SMS-Bestätigung liegt darunter. Das erklärte Lernziel ist, ob Kundinnen und Kunden den Ablauf verstehen und den Scheck erfolgreich einreichen können. [Abbildung zum MVP-Schnitt](https://media.nngroup.com/media/editor/2020/11/30/mvp-slice-in-story-map) · [Erläuterung im Artikel](https://www.nngroup.com/articles/user-story-mapping/) |
| Miro, Triebwerksentwurf | Im Jira-Beispiel stehen drei Aufgabenspalten unter einer Aktivität. Der MVP reicht über alle drei Spalten. Auf den Karten bleibt der Titel lesbar, darunter stehen Status und Jira-ID. [Abbildung mit Jira-Karten](https://help.miro.com/hc/article_attachments/21017695659282) |
| StoriesOnBoard, Online-Shop | Unter den blauen Nutzerzielen stehen gelbe Schritte. Die Storys verteilen sich innerhalb des MVP unterschiedlich dicht auf die Spalten. Noch unverplante Karten liegen weiter unten in einem eigenen Abschnitt. Ein weiteres Beispiel zeigt verknüpfte Jira-IDs direkt auf den Karten. [Map mit Release-Schnitt](https://docs.storiesonboard.com/en/articles/14422387-user-story-mapping-101) · [Verknüpfte Karten](https://docs.storiesonboard.com/en/articles/9031700-how-to-push-cards-to-jira-from-your-nextgen-story-map) |
| Easy Agile, Jira-Board | In der erweiterten Hierarchie überspannt eine Initiative ihre zugehörigen Epics. Jede Story steht unter ihrem Epic, und die Sprint-Zeile läuft über die gesamte Breite. [Abbildung zur erweiterten Hierarchie](https://help.easyagile.com/easy-agile-teamrhythm/story-map-issue-hierarchy) |

**Entscheidung für das Kundenportal.** Die Abfolge der Nutzerschritte bestimmt die Spalten. Jeder Lieferabschnitt benennt das erreichbare Ergebnis. Für „Gefilterte Fälle in einer Datei übergeben“ lässt sich der Weg vom Öffnen der Fallübersicht über den Filter bis zum Export durchgehen. Eine leere Zelle bedeutet, dass für diesen Schritt in diesem Abschnitt keine Story eingeplant ist. „Ohne Lieferabschnitt“ sammelt dagegen konkrete Storys, deren Lieferung noch offen ist. Ein Link wie `UC-09` führt von der Story zu ihrem Backlog-Item. Für schmale Ansichten gilt als Prüffrage, ob an jeder Story sowohl der Nutzerschritt als auch der Lieferabschnitt erkennbar bleiben.

### Informationsarchitektur und Datenlogik

- **Story Maps** ist ein eigener Einstieg innerhalb des aktiven Produkts. Die Übersicht nennt Titel, Ziel und Umfang der Maps. Die Detailansicht führt von Aktivitäten über Nutzerschritte und Story-Karten bis zum verbundenen Backlog-Item.
- **Aktivität, Nutzerschritt, Story und Lieferabschnitt** sind eigene fachliche Begriffe. Ein technischer Task bleibt ein Backlog-Item. Eine Story ohne Backlog-Referenz kann in Discovery und Refinement trotzdem geplant und sichtbar gehalten werden.
- **Backlog-Referenzen** können mehrere Items mit einer Story verbinden. Dieselbe ID kann an mehreren Stellen vorkommen und ergibt dann mehrere Rückverweise. Entfernen einer Referenz ändert nur ihre Verbindung zur Story. Umbenennen des Items bleibt in der Map nachvollziehbar. Fehlende Ziele werden als fehlende Referenz erkennbar.
- **Struktur und Priorität** bleiben unabhängig. Das Verschieben einer Story ändert die Reihenfolge, den Nutzerschritt oder den Lieferabschnitt der Map. Eine Release-Zuordnung in der Map beschreibt den geplanten Umfang. Übergabe, Ready/Done und Git-Evidenz laufen weiterhin über die zugehörigen Feature Requests.

### Prüfszenarien und Abwägungen

| Qualitätsblick | Prüfszenario oder offene Entscheidung |
| --- | --- |
| Funktionale Eignung | Map erstellen, Nutzerziel hinterlegen, Aktivität und Nutzerschritt ergänzen, Lieferabschnitt anlegen, Story hinzufügen und ein vorhandenes PBI verbinden. Von der Story zum Item und über den Rückverweis zurück navigieren. |
| Integrität | Ein Item umbenennen und eine Story verschieben. Titeländerung in der Map sehen, während Backlog-Rang und Parent unverändert bleiben. Eine Verknüpfung lösen. Das Backlog-Item und seine Git-Historie bleiben verfügbar. |
| Zuverlässigkeit | Zweites Projekt mit ähnlichen Item-IDs anlegen; anhand der gespeicherten Projektgrenze prüfen, dass Links und Rückverweise den richtigen Bestand verwenden. Nach erneutem Laden die Map und alle Verknüpfungen prüfen. |
| Interaktionsfähigkeit | Die Browserprüfung deckt die Story-Map-Aktionen bei Desktop- und 390 px breitem Mobile-Viewport ab. Auf Mobilgeräten erscheint die Map in einer gestapelten Ansicht. Auf größeren Bildschirmen scrollen breite Maps innerhalb ihres eigenen Bereichs. Manuelle Prüfungen mit Touch und Screenreader stehen für das Plugin aus. |
| Bewusster Umfang | Der Clickdummy zeigt die Verknüpfung mit dem vorhandenen Backlog. Automatische Synchronisierung mit Azure Boards, direkte Obsidian-Persistenz und Multiuser-Zusammenarbeit benötigen zusätzliche Vertrags- und Integrationsprüfungen. |

## Quellen

1. [Nielsen Norman Group · 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
2. [W3C · WCAG 2.2](https://www.w3.org/TR/WCAG22/)
3. [W3C · Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)
4. [W3C · Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) und [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
5. [W3C · Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
6. [W3C APG · Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
7. [W3C · Headings and Labels](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels)
8. [W3C · Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
9. [Microsoft Learn · Product Backlog](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/create-your-backlog?view=azure-devops) und [Ranking und Priorität](https://learn.microsoft.com/en-us/azure/devops/boards/queries/planning-ranking-priorities?view=azure-devops)
10. [GitHub Docs · Adding Sub-Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) und [Issue Types](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-the-issue-type-field)
11. [Obsidian Help · Bases Syntax](https://obsidian.md/help/bases/syntax)
12. [Luis85 · Product Backlog View](https://github.com/Luis85/backlog-view)
13. [Carbon Design System · Data Table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines)
14. [GOV.UK Design System · Task List](https://design-system.service.gov.uk/components/task-list/) und [Error Summary](https://design-system.service.gov.uk/components/error-summary/)
15. [Scrum Guide · Definition of Done](https://scrumguides.org/scrum-guide.html?frame=0)
16. [Atlassian · Definition of Ready](https://www.atlassian.com/agile/project-management/definition-of-ready/)
17. [ISO · ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) und [IEC-Katalog](https://webstore.iec.ch/en/publication/90024)
18. [ISO · ISO/IEC 25019:2023](https://www.iso.org/standard/78177.html)
19. [Microsoft Learn · Backlog organisieren](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/organize-backlog?view=azure-devops), [Spalten konfigurieren](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/set-column-options?view=azure-devops) und [Backlogs filtern](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/filter-backlogs-boards-plans?view=azure-devops)
20. [arc42 · Dokumentation und Gliederung](https://docs.arc42.org/home/)
