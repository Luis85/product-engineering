# Product Engineering Platform

Dieses Paket bündelt den Stand vom 22. November 2026.

- **[Produktkonzept und Anforderungen](Product-Engineering-Platform-Produktkonzept.md)** – Produktversprechen, Zielgruppen, Artefaktregeln, fachliche Anforderungen, Obsidian-Backlog, Nachweiskette und Abnahmekriterien für das erste Inkrement.
- **[Architektur und Factory-Workflow](Product-Engineering-und-Factory-Architektur.html)** – Visualisierung der Product Engineering Platform und der Factory vom Problem bis zur Lösung, einschließlich Orchestrator und Worker-Clients.
- **[UX- und Qualitätsreview](Product-Engineering-UX-Qualitaetsreview.md)** – Recherche, Review aller Ansichten, Einordnung nach ISO/IEC 25010:2023 sowie das Konzept für User Story Maps mit Backlog-Anbindung. Der Review dokumentiert auch die jüngeren Änderungen an Überblick, Backlog, Begleititems und Ready/Done.
- **[Clickdummy mit Story Maps](Product-Engineering-Clickdummy-Story-Maps.html)** – eigenständiger HTML-Prototyp, der sich direkt im Browser öffnen lässt. Das Kundenportal startet in der Beispiel-Map „Servicefälle verlässlich übergeben“. Der Projektstand wird im Browser gespeichert. Eine optionale Modellanbindung lässt sich in den Plugin-Einstellungen aktivieren.

Der [Implementierungsplan für die nativen Obsidian-Ansichten](../plans/product-views/README.md) enthält die Übergabe an die nächste Sitzung, die Arbeitspakete pro Ansicht und die Abnahmewege.

### Den Projekteinstieg ausprobieren

Über den Projektwähler lässt sich ein leeres Produktprojekt anlegen. Im Überblick führt **Ersten Job beschreiben** über Produktvision und PRD zur Story Map. In deren erstem Lieferabschnitt kann das Team vorhandene Product Backlog Items (PBIs) verknüpfen, neue anlegen und Storys zurückstellen. Tasks, Issues, Fragen und Bugs lassen sich bereits an einer Story erfassen. Am Desktop lässt sich die Seitennavigation auf Symbole einklappen. Auf dem Smartphone öffnet die Menütaste die beschriftete Projektnavigation.

Über **Grundlagen bearbeiten** lassen sich das PRD und die Jobs einer Story Map wechseln oder entfernen. **Verweis hinzufügen** ergänzt beispielsweise ein Interview oder ein Bild aus dem Dateiwähler. Mit **Grundlagen speichern** übernimmt die Map die Auswahl. Das exportierte Prototyp-Briefing enthält die gewählten Wissensnotizen und lesbare lokale Textquellen. Bei lokalen Textdateien über 512 KiB ist der Auszug gekennzeichnet. Bilder erscheinen als Dateiverweise.

### KI-Copilot einrichten und verwenden

Der Copilot ist anfangs ausgeschaltet. Öffne **Plugin-Einstellungen**, wähle **KI-Copilot aktivieren** und speichere die Einstellungen. Die **Lokale Demo** gleicht Suchbegriffe ab, prüft Dokumentmerkmale und füllt Vorlagen aus. Diese Betriebsart benötigt keine Netzwerkverbindung.

In der Betriebsart **Eigener Modellanbieter** sind der Modellname und die vollständige URL eines kompatiblen Chat-Completions-Endpunkts erforderlich. Verwende HTTPS oder für einen lokalen Dienst eine Loopback-Adresse wie `http://localhost:11434/v1/chat/completions`. Der Dienst muss den JSON-POST aus dem Browser per CORS zulassen, bei Authentifizierung auch den Header `Authorization`. Der optionale API-Schlüssel gilt für diesen Tab und diesen Endpoint. Nach dem Neuladen ist er erneut einzugeben. Die gespeicherte Betriebsart gilt projektübergreifend für diesen Browser.

Öffne **KI-Copilot** in der Kopfzeile oder **KI-Review** an einer Notiz. Unter **Quellen wählen** siehst und änderst du den Kontext. Projekthinweise gelten für die Gespräche des geöffneten Projekts. **Senden** übermittelt im Anbietermodus den Auftrag, die gewählten Projektquellen, die Hinweise und den bisherigen Verlauf dieses Gesprächs. Mit **Neues Gespräch** beginnst du einen eigenen Verlauf.

Unter **Aufgabe** stehen **Fragen**, **Prüfen**, **Entwerfen** und **Überarbeiten** zur Wahl. Für einen Entwurf wählst du eine Vorlage, für die Überarbeitung eine Zielnotiz aus den gewählten Quellen. Über **Vorschlag prüfen** kannst du Titel und Text bearbeiten und eine Überarbeitung mit der aktuellen Notiz vergleichen. Erst **Als Entwurf speichern** bzw. **Änderungen übernehmen** schreibt die Notiz. Hat sich die Zielnotiz inzwischen geändert, stehen **Als neue Notiz speichern** und **Vorschlag verwerfen** zur Wahl. Bei ungespeicherten Editoränderungen bleibt der Vorschlag im Gespräch, bis du den Arbeitsstand geklärt hast.

### Von einem Job aus recherchieren und Anforderungen ableiten

Öffne in **Wissen** einen Job to Be Done, etwa **Offene Fälle verlässlich übergeben**. **Research starten** öffnet eine Research-Vorlage für diesen Job. Nach dem Anlegen bleibt der Ausgangsjob an der Research-Notiz verlinkt. Im Job führt **Verknüpfungen → Research zum Job** zurück zur Untersuchung. Diese Verbindung funktioniert bereits vor dem ersten PBI.

**PRD ableiten** übernimmt den Job und, falls vorhanden, die zugehörige Produktvision als Vorauswahl. Im Dialog lassen sich weitere Jobs desselben Projekts ergänzen. Unter **Verknüpfungen** zeigt das gespeicherte PRD seine Grundlagen. Am Job erscheinen die bestehenden und die neu abgeleiteten PRDs unter **Produktanforderungen**.

### Akteure im Wissen erfassen

Unter **Wissen → Akteur → Akteur anlegen** beschreibst du die Beteiligten eines Ablaufs. Der Typ **Mensch** steht für eine Person oder Rolle, **System** für eine Anwendung oder einen Dienst. Die Notiz beschreibt, welchen Beitrag der Akteur im Ablauf leistet. Das Feld **Verantwortlich** bezeichnet das Teammitglied, das die Notiz pflegt, und kann leer bleiben.

Der Filter **Akteurstyp** grenzt die Liste ein. Titel, Typ und Beschreibung lassen sich in der Notiz bearbeiten. Ihre stabile Kennung, etwa `AKT-01`, bleibt beim Umbenennen erhalten. Damit kannst du den Akteur im Vault-Picker als Wikilink einfügen oder unter **Grundlagen** einer Story Map zuordnen. Markdown-Export und Git-Stand enthalten den Typ im Feld `pe-actor-type`.

### Notizen und Dateien verknüpfen

In einer Wissensnotiz oder einem PBI kannst du einen Wikilink direkt in den Text schreiben. `[[Servicefälle übergeben#Problem|Produktanforderung]]` zeigt beim Lesen **Produktanforderung** und öffnet den Abschnitt **Problem** der verlinkten Notiz. Bei gleichnamigen Dateien macht der relative Pfad das Ziel eindeutig, etwa `[[Research/Gespräch.md]]`. Mit `![[Medien/Karte.png]]` lässt sich ein verfügbares Rasterbild einbetten. Beim Bearbeiten und im Markdown-Export bleibt die Linkschreibweise erhalten.

Im Editor fügt **Vault-Verweis** das gewählte Ziel an der Schreibposition ein. Markierter Text wird zum Linknamen. Unter **Verknüpfungen → Vault-Verweise → Verweis hinzufügen** lässt sich eine Datei auch als zusätzliche Quelle zuordnen. Im Auswahlfenster stehen die Projektdateien bereit. Mit **Vault-Ordner auswählen** oder **Dateien auswählen** kannst du lokale Dateien durchsuchen. **Verweis einfügen** bestätigt das Ziel, **Bild einbetten** fügt im Editor ein Rasterbild ein.

Die Ordnerauswahl stellt die Dateipfade für die Sitzung bereit. Beim Bestätigen einer lokalen Datei speichert der Browser eine projektbezogene Kopie in IndexedDB, die auch nach einem Neuladen verfügbar ist. Lokale Vault-Dateien öffnet der Clickdummy schreibgeschützt. Bearbeitbar sind die Wissensnotizen und PBIs des Demo-Projekts im Browser. Soll eine bearbeitete Notiz in den eigenen Obsidian-Vault gelangen, exportiere ihre Markdown-Datei und lege sie dort ab.

### Fachliche Entitäten im Domainmodel beschreiben

Unter **Wissen → Entität** oder direkt im **Domainmodel** kannst du eine Entität anlegen. Der Modellknoten und die Notiz haben dieselbe `ENT`-Kennung. **Notiz öffnen** führt aus dem Diagramm zur Beschreibung, **Im Domainmodel öffnen** zurück zur gewählten Entität. Die Notiz zeigt Attribute sowie eingehende und ausgehende Beziehungen. Im Beispiel umfasst eine Organisation null bis viele Servicefälle (`0..*`). Jeder Servicefall gehört zu genau einer Organisation (`1`).

**Notiz exportieren** gibt die Beschreibung, Attributnamen und ihre Erläuterungen sowie die fachlichen Beziehungen als Markdown aus. Die Verweise verwenden stabile Wikilinks zu den Entitätsdateien. Bei einer Umbenennung im Modell bleibt die Zuordnung deshalb erhalten.

Mit dem Mausrad zoomst du an der Position des Zeigers. Ziehe die freie Diagrammfläche mit Maus oder Finger, um den Ausschnitt zu verschieben. Mit Tastaturfokus auf der Fläche verschieben die Pfeiltasten die Ansicht, mit Fokus auf einer Entität den Knoten. **Originalgröße** setzt den Zoom auf 100 % zurück. **Einpassen** rückt das gesamte Modell ins Bild.

### Domainkontext einem Vorhaben zuordnen

**Produktumfang zuordnen** verbindet eine Entität mit PRDs, ganzen Story Maps oder Backlog-Einträgen im selben Projekt. Vom Vorhaben aus lässt sich dieselbe Zuordnung über **Entitäten zuordnen** bearbeiten. Ein Team kann so zum Beispiel „Organisation“ am PRD für die Fallübergabe hinterlegen und den Fachbegriff später am zugehörigen PBI wiederfinden.

Für ein PBI berücksichtigt der Clickdummy auch Zuordnungen an seinem PRD, übergeordneten Features oder Epics, seinen Begleititems und den zugehörigen Story Maps. Bei einer Map zählen ihre verknüpften Einträge und ihre fachlichen Grundlagen. Der Abschnitt **Entitäten im Umfang** nennt die Herkunft jeder Entität. Weitere Entitäten an den Enden dieser Beziehungen stehen unter **Nachbarn außerhalb des Umfangs**. So lässt sich eine Beziehung mit Verb, Kardinalitäten und Geschäftsregel verstehen, ohne einen weiteren Modellzweig in das Vorhaben aufzunehmen.

Ein Request-Entwurf zeigt den aktuellen Domainkontext. Bei der Freigabe werden Definitionen, Attribute, Herkunft und Beziehungen zusammen mit der Revision festgehalten. Nach einer Modelländerung zeigen Nachweise und JSON-Export weiterhin diesen Stand. Das Prototyp-Briefing übernimmt den aktuellen Domainkontext seiner Quelle. Bei einer einzelnen NFR bestimmen deren zugeordnete Backlog-Einträge und Maps den Umfang. Der Kontext steht auch in der exportierten Briefing-Datei für einen externen Agenten.

### Mit dem Board arbeiten

**Backlog** öffnet zuerst das **Board**. Es zeigt die Spalten **Backlog**, **Open**, **In Progress**, **Review**, **In Development** und **Done**. Die beiden äußeren Spalten lassen sich einzeln einklappen. In der Spalte **Backlog** legt **PBI anlegen** ein neues Item an. Über **Liste** lässt sich die Hierarchie von Epics, Features, PBIs und Begleititems bearbeiten. Bei Epics und Features kannst du eine Beschreibung in Markdown, die verantwortliche Person und einen eigenen Status hinterlegen. **Beschreibung bearbeiten** wechselt von der Vorschau zur Eingabe. Der Gruppenstatus ist optional und wird unabhängig vom Bearbeitungsstand der untergeordneten PBIs geführt.

Auf einer PBI-Karte öffnet **Begleititem erfassen** die Auswahl für Task, Issue, Frage oder Bug. Ist das PBI ausreichend vorbereitet, lässt sich von der Karte ein **Feature Request erstellen**. Vorhandene Requests sind mit ID und Titel verlinkt. Beim Versand an die Factory wechselt das PBI zu **In Development**. Nach der fachlichen Abnahme entscheidet das Team über den Wechsel zu **Done**. In der simulierten Git-Historie lässt sich der Arbeitsstand mit dem letzten Commit vergleichen. Ein ausgewählter Commit zeigt seine Änderungen gegenüber dem Vorgänger.

### Lieferergebnisse im Backlog verfolgen

Unter **Backlog → Deliverables** hältst du für jedes erwartete Lieferergebnis fest, woran das Team die Fertigstellung erkennt. Verantwortung, Fälligkeit und Dokumentvorlage sind optional. Suche und Filter zeigen beispielsweise alle geplanten Testkonzepte. Der Bearbeitungsstand lässt sich direkt in der Liste von **Geplant** bis **Erledigt** ändern.

Mit **Notiz verknüpfen** ordnest du eine vorhandene Projektnotiz zu. **Notiz anlegen** öffnet die gewählte Vorlage mit dem Titel des Deliverables. Nach dem Speichern führt die Liste zur Notiz. In deren **Verknüpfungen** öffnet die `DEL`-Kennung wieder das zugehörige Lieferergebnis. Die fachliche Freigabe der Notiz und die Abnahme von Feature Requests haben eigene Zustände.

### Einen Prototyp vom Vorhaben aus öffnen

In einer Story Map oder einem geöffneten PBI zeigt **Prototypen** die zugehörigen Entwürfe. **Prototyp anlegen** übernimmt die Quelle in das Briefing. Auch die Zeilen der Backlog-Liste und die PBI-Karten im Board bieten diesen Einstieg. So lässt sich etwa am PBI `UC-09` der vorhandene CSV-Entwurf öffnen oder eine zweite Variante zum selben Ablauf anlegen.

Im Briefing lassen sich Styleguide und Designsystem aus **Wissen** auswählen. In der Betriebsart **Lokale Demo** erzeugt **Agentenlauf simulieren** eine lokale HTML-Vorschau. Mit eigenem Modellanbieter öffnet **HTML mit KI erstellen** die Angaben zu Zielhost und Modell. Unter **Übermitteltes Briefing ansehen** prüfst du den Umfang, bevor **Generierung starten** ihn sendet. Lokale Dateianhänge erscheinen in diesem Auftrag als Pfade.

Auch mit ausgeschaltetem Copilot kannst du über **Briefing exportieren** eine Datei für einen externen Agenten erhalten. Dessen Ergebnis lässt sich mit **HTML übernehmen** als Datei oder Quelltext einlesen. **HTML exportieren** liefert die aktuelle Variante als eigenständige Datei.

### Nichtfunktionale Anforderungen zuordnen

Unter **Backlog → NFRs** erfasst das Team eine nichtfunktionale Anforderung (NFR) mit messbarem Abnahmekriterium. **Gilt für** verknüpft sie mit Backlog-Einträgen und ganzen Story Maps des Projekts. Umgekehrt lässt sich am Eintrag oder an der Map über **NFRs zuordnen** die Auswahl ändern. Die verknüpften Titel führen in beide Richtungen zum jeweiligen Datensatz.

| Gewählter Umfang | Berücksichtigte NFR-Zuordnungen |
| --- | --- |
| Backlog-Eintrag | Der Eintrag, seine über- und untergeordneten Einträge sowie Maps, die ihn oder einen seiner Untereinträge verlinken. Bei Begleititems zählt auch eine Map, die ihr PBI verlinkt. |
| Story Map | Die Map, ihre verknüpften Backlog-Einträge und deren übergeordnete Einträge. Bei einem verknüpften PBI zählen auch dessen Begleititems. |
| Einzelne NFR als Prototypquelle | Die ausgewählte Anforderung selbst. |

Das Prototyp-Briefing enthält jede zutreffende NFR einmal mit Abnahmekriterium und Herkunft. Bei einem Feature Request zeigt der Entwurf die derzeit für das PBI geltenden NFRs. Die Freigabe hält diesen Stand für die Revision fest. Änderungen am Katalog fließen in spätere Entwürfe ein.

### Nichtfunktionale Anforderungen importieren

Der Direktpfad für das Kundenportal lautet `#/project/kundenportal/backlog/nfrs`. **NFRs importieren** nimmt eine lokale CSV-Datei oder eingefügten Text an. Die Kopfzeile nennt alle fünf Spalten. Titel, Anforderung und messbares Abnahmekriterium müssen in jeder Datenzeile stehen.

```csv
Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien
Antwortzeit der Suche;Die Suche liefert die Fallliste ohne lange Wartezeit.;95 % der Suchanfragen liefern in einer Sekunde ein Ergebnis.;;25010:performance-efficiency
```

Als Feldtrenner sind Semikolon und Komma möglich. Mehrere Kategorien stehen im selben Feld, getrennt durch `|`. Zuständigkeit und Kategorien dürfen leer bleiben. **Vorschau prüfen** zeigt die erkannten Zuordnungen und die betroffenen Zeilen bei Fehlern. Erst die Bestätigung übernimmt gültige neue Einträge. Identische bereits vorhandene Einträge werden übersprungen.

### Optionale Browsertests

Die Tests benötigen Python mit Playwright sowie Chromium oder Microsoft Edge. Der Aufruf erfolgt im Stammverzeichnis des Repositorys.

```sh
python -m unittest discover -s docs/concept/tests
```

Mit der Umgebungsvariable `CLICKDUMMY_BROWSER` lässt sich der Pfad zur ausführbaren Browserdatei vorgeben.
