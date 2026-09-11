# Generative Fassade — Webapp

Eine Seite, die zeigt, wie generatives Design funktioniert: dieselben Bausteine,
immer neu angeordnet. Beim Scrollen baut sich die Fassade animiert um.

## Starten

Wegen der lokalen Schriften braucht es einen kleinen Server (nicht per Doppelklick öffnen):

```
cd "<dieser Ordner>"
python3 -m http.server 8765
```

Dann im Browser: http://localhost:8765

## Landing Page

* Scrollen wechselt durch die Layouts — Position und Rotation werden animiert.
* **Mausklick** blättert direkt zum nächsten Layout, mit derselben Animation;
  nach dem letzten geht es zurück auf das erste. Technisch wird nur an die
  Scrollposition des nächsten Layouts gefahren — die Animation ist dieselbe
  Mechanik wie beim Scrollen. Klicks auf das „i“ und auf die Vorlage blättern
  nicht, und ein Klick, der die Vorlage wegnimmt, auch nicht.
* Pro Layout eine Bildschirmhöhe Scrollstrecke, mit kurzer Haltephase an jedem Layout.
* Zähler oben rechts zeigt, wo man ist — in derselben kleinen Typo wie die
  Labels: Walbaum SemiBold, volles Schwarz, gleiche Grösse (er rechnet die
  Skalierung des Blattes mit).
* **i** darunter blendet die Vorlage ein — das Foto der echten Fassade
  (`Assets/fenster_vorlage.webp`, 20 vw breit, direkt unter dem Buchstaben).
  Ein Klick daneben, Scrollen oder ESC nimmt es wieder weg; auf das Bild
  selbst darf man klicken. Im Editor ist die ganze Ecke ausgeblendet.
* **T** blendet die kleine Typo (Labels, Adresse, Mail) aus und ein.

## Editor (versteckt)

* **E** öffnet den Editor, **ESC** schliesst ihn wieder. Das Bild bleibt dabei
  stehen: der Editor übernimmt das Layout, das gerade auf dem Schirm ist, und
  die wegfallende Scrollbar wird ausgeglichen — es verschiebt sich nichts.
* Direktlink: `index.html#edit`

**Layouts** (linke Palette)

* Layout anlegen, duplizieren, umbenennen, sortieren, löschen.
* **Layout generieren** würfelt ein Layout nach Regeln aus:
  zufällige Position auf 4-px-Raster, Rotation nur in 90°-Schritten,
  kollisionsfrei, Headline bleibt unten, Infotexte in der rechten Spalte.

**Element** (rechte Palette)

* Es gibt einen festen Satz von acht Elementen — Fenster 1, Tür, Fenster 2, Velo,
  Rote Bank, Adresse, E-Mail, Headline. Jedes davon **genau einmal pro Layout**,
  duplizieren ist nicht vorgesehen.
* Klick auf einen Baustein wählt ihn aus, Ziehen verschiebt ihn.
* **Mehrere auf einmal**: auf der freien Fläche ein Feld aufziehen — alles,
  was es berührt, ist gewählt. **⇧-Klick** nimmt einzelne dazu oder weg,
  **⌘A** wählt alles. Ziehen bewegt die ganze Auswahl, **↺ / ↻ 90°** dreht sie
  um ihre gemeinsame Mitte — die Elemente wandern also umeinander herum und
  bleiben dabei rechtwinklig. Bei einem einzelnen Element dreht es sich wie
  bisher um sich selbst. Die feine gepunktete Klammer zeigt die Gruppe.
* X / Y numerisch, **↺ 90°** / **↻ 90°** dreht — nur rechte Winkel, nie diagonal.
* Label (kleine Typo) pro Baustein: Text, Versatz L-X / L-Y, oder direkt ziehen.
  Beim Drehen springt das Label zurück an die Ecke.
* Ebene nach vorn / hinten, Löschen.
* **Ausrichten**: beim Ziehen fängt das Element an den anderen Elementen ein und
  eine rote Hilfslinie zeigt, woran. Fanglinien sind bei Bausteinen die vier Kanten
  und die Mitte, bei Typo die linke Kante und die Grundlinie, dazu Rand und Mitte
  des Blattes. Es gewinnt immer die nächstgelegene Linie (Fangweite 6 px).
  **⌥** beim Ziehen schaltet das Ausrichten aus, dann gilt wieder das Raster.
* **Hinzufügen** zeigt alle acht Elemente. Was schon im Layout ist, ist ausgegraut;
  ein gelöschtes Element kommt darüber wieder herein — an seiner Position aus der Vorlage.

**Kopfzeile**

* **Kleine Typo** — Labels und Infotexte global aus/ein.
* **Raster** — 10-px-Raster einblenden; dann rastet das Ziehen ein, wo nichts zum
  Ausrichten in der Nähe ist.
* **Rotation schalten** — aus: die Drehung wird mitanimiert (kurz diagonal).
  ein: die Drehung springt in der Mitte des Übergangs um, es entstehen nie Diagonalen.
* **Export / Import** — Layouts als JSON sichern und laden.
* **Zurücksetzen** — zurück auf die Vorlage.

**Tasten im Editor**: Pfeile 1 px · ⇧Pfeile 10 px · R / ⇧R drehen ·
⇧Klick zur Auswahl dazu · ⌘A alles wählen · ⌥ beim Ziehen ohne Ausrichten ·
⌫ löschen · G Raster · T kleine Typo · ESC Auswahl weg, dann zurück

## Wo die Layouts liegen

Zwei Orte, und der Unterschied ist wichtig:

* **`localStorage` im Browser** (Schlüssel `gf.fassade.v1`) — dort landet
  automatisch jede Änderung aus dem Editor. Das hängt am Browser und an der
  Adresse, unter der die Seite läuft. Es liegt **nicht** im Projektordner und
  geht darum auch nicht mit auf Git — und `localhost:8765` und die spätere
  Web-Adresse sind zwei verschiedene Speicher.
* **`layouts.json` neben `index.html`** — die Datei, die mitgeliefert wird.
  Hat ein Besucher noch nichts im eigenen Browser, wird sie geladen. Fehlt
  sie, gilt die Vorlage aus `js/assets.js`.

**Layouts veröffentlichen**: im Editor auf **Export**, die Datei als
`layouts.json` in diesen Ordner legen, committen. Das ist der Stand, den
Besucher sehen. Im eigenen Browser bleibt der eigene Stand sichtbar (der
localStorage hat Vorrang) — zum Gegenprüfen ein privates Fenster nehmen.

**Zurücksetzen** im Editor geht auf die Vorlage aus `js/assets.js` zurück,
nicht auf `layouts.json`. Danach wieder importieren oder neu laden.

## Aufbau

```
index.html        Gerüst
css/style.css     Schriften, Fassade, Editor-Chrome
js/assets.js      Bausteine (Pfade aus /Assets) + Standard-Layout nach Vorlage
js/state.js       Datenmodell, Speicherung, generative Regeln
js/render.js      SVG-Aufbau, Interpolation zwischen zwei Layouts
js/editor.js      Editor
js/main.js        Landing Page, Scroll → Animation
```

Die Fassade ist ein SVG mit fixem Koordinatensystem von **1160 × 800**
(gleiches Format wie die Vorlage) und skaliert mit dem Fenster. Das Blatt
liegt am **linken** Bildschirmrand an (`preserveAspectRatio="xMinYMid meet"`),
überschüssige Breite fällt nach rechts — dorthin, wo im Editor die
Bedienspalte steht. Damit reicht auch das Raster bis an den linken Rand.
Die Bausteine liegen auf 64 % ihrer Originalgrösse — so wie in der Vorlage.

Neue Bausteine kommen in `js/assets.js` dazu: Pfade und Masse in `GF.SHAPES`,
dann ein Eintrag mit fester `id` in `GF.defaultLayout()` und ein Anzeigename in
`GF.ROSTER_NAMES`. Diese Liste ist die einzige Quelle für die Editor-Palette,
den Generator und die Animation zwischen den Layouts.
