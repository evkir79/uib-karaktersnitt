# UiB Karaktersnitt

En frittstående skrivebordsapp for macOS og Windows som beregner vektet karaktersnitt etter reglene ved Universitetet i Bergen. Appen er bygget med Electron og vanlig HTML/CSS/JavaScript, og fagene dine lagres lokalt på maskinen.

## Last ned

Hent siste versjon under **[Releases](https://github.com/evkir79/uib-karaktersnitt/releases/latest)**. Du trenger ikke installere noe annet.

| System                       | Fil                                          |
|------------------------------|----------------------------------------------|
| Mac med Apple Silicon (M1–M4) | `UiB-Karaktersnitt-<versjon>-mac-arm64.dmg`  |
| Mac med Intel-prosessor      | `UiB-Karaktersnitt-<versjon>-mac-x64.dmg`    |
| Windows (installasjon)       | `UiB-Karaktersnitt-Setup-<versjon>.exe`      |
| Windows (uten installasjon)  | `UiB-Karaktersnitt-Portable-<versjon>.exe`   |

**Mac:** Åpne .dmg-filen og dra appen til Programmer. Appen er ikke signert av Apple. Hvis macOS sier at appen «er skadet» eller «ikke kan åpnes», kjør dette én gang i Terminal:

```bash
xattr -cr "/Applications/UiB Karaktersnitt.app"
```

**Windows:** Hvis SmartScreen advarer, klikk **Mer informasjon** og deretter **Kjør likevel**.

### Lage en ny versjon

Filene bygges automatisk av GitHub Actions (`.github/workflows/release.yml`). Slik lager du en ny versjon:

1. Øk `version` i `package.json`, for eksempel til `1.0.1`, og commit endringen.
2. Lag og push en tag med samme nummer:
   ```bash
   git tag v1.0.1
   git push origin main v1.0.1
   ```
3. Etter cirka 5–10 minutter ligger de nye filene under Releases.

## Funksjoner

- **Vektet snitt:** Σ(karakterverdi × studiepoeng) ÷ Σ(studiepoeng), med A = 5, B = 4, C = 3, D = 2, E = 1 og F = 0.
- **Bestått / Ikke bestått:** Slike emner teller ikke i snittet, men bestått-studiepoeng regnes med i «stp bestått».
- **Bokstavsnitt:** Snittet avrundes til nærmeste hele karakter, og x.5 rundes opp:

  | Snitt       | Bokstav |
  |-------------|---------|
  | 4.50 – 5.00 | A       |
  | 3.50 – 4.49 | B       |
  | 2.50 – 3.49 | C       |
  | 1.50 – 2.49 | D       |
  | 0.50 – 1.49 | E       |
  | under 0.50  | F       |

- **Studiepoeng:** Viser hvor mange studiepoeng som er registrert, bestått og med i snittet.
- **«Hva må jeg få?»:** Viser hvilket snitt du trenger på de gjenstående studiepoengene for å nå et mål, foreslår en karakterkombinasjon, og viser minste antall studiepoeng med bare A som trengs for hvert bokstavsnitt.
- **Visualisering:** En skala fra 0 til 5 med UiB-grensene og din posisjon, pluss fordelingen av studiepoeng per karakter.
- **Redigering:** Rediger et emne med blyant-ikonet eller ved å dobbeltklikke på raden. Slett ett emne eller alle emnene. Etter en sletting vises en «Angre»-knapp i 6 sekunder.
- **Valgfritt:** Du kan slå av at F (0 poeng) tas med i snittet. Noen beregninger, blant annet ved opptak, ser bort fra strøkne emner.
- **Tema:** Lys, mørk eller system (følger operativsystemet).

Dataene lagres i `karakterer.json` i appens brukermappe:

- macOS: `~/Library/Application Support/UiB Karaktersnitt/`
- Windows: `%APPDATA%\UiB Karaktersnitt\`

---

## 1. Kjøre appen lokalt (utviklingsmodus)

### Forutsetninger

Du trenger **Node.js 20 eller nyere**, og npm følger med.

- **macOS:** Last ned LTS-versjonen fra <https://nodejs.org>, eller installer med Homebrew:
  ```bash
  brew install node
  ```
- **Windows:** Last ned LTS-installasjonsfilen fra <https://nodejs.org>, eller bruk:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

Sjekk at installasjonen virker:

```bash
node -v
npm -v
```

### Steg for steg

1. Åpne en terminal (macOS) eller PowerShell (Windows) i prosjektmappen:
   ```bash
   cd uib-karaktersnitt
   ```
2. Installer avhengighetene (Electron og electron-builder):
   ```bash
   npm install
   ```
3. Start appen:
   ```bash
   npm start
   ```

Når du har endret filene i `src/`, laster du appen på nytt med **Cmd+R** (macOS) eller **Ctrl+R** (Windows). Utviklerverktøyene åpnes med **Cmd+Opt+I** / **Ctrl+Shift+I**.

> Tips: Du kan også åpne `src/index.html` rett i en nettleser for å teste grensesnittet. Data lagres da i nettleserens localStorage i stedet for i en JSON-fil.

---

## 2. Bygge en installerbar fil

Appen pakkes med [electron-builder](https://www.electron.build/). Ferdige filer havner i mappen `dist/`.

### macOS (.dmg og .app)

Kjør dette **på en Mac**:

```bash
npm run dist:mac
```

Resultatet er:

- `dist/UiB-Karaktersnitt-1.0.0-mac-arm64.dmg` for Apple Silicon (M1/M2/M3/M4)
- `dist/UiB-Karaktersnitt-1.0.0-mac-x64.dmg` for Intel
- `.zip`-filer med selve `.app`-pakken
- `dist/mac-arm64/UiB Karaktersnitt.app` og `dist/mac/UiB Karaktersnitt.app`, som du kan dra rett inn i Programmer

**Åpne en usignert app:** Appen er ikke signert med et Apple Developer-sertifikat, så macOS advarer første gang du åpner den. Høyreklikk appen, velg **Åpne**, og bekreft med **Åpne** igjen. Fungerer ikke det, kan du fjerne karantenemerket:

```bash
xattr -cr "/Applications/UiB Karaktersnitt.app"
```

### Windows (.exe)

Kjør dette **på en Windows-maskin**:

```powershell
npm run dist:win
```

Resultatet er:

- `dist\UiB-Karaktersnitt-Setup-1.0.0.exe`, en installasjonsfil som lager snarveier i Start-menyen og på skrivebordet
- `dist\UiB-Karaktersnitt-Portable-1.0.0.exe`, en portabel versjon som kjører uten installasjon

**Hvis SmartScreen advarer:** Windows kan vise «Windows beskyttet PC-en» fordi filen er usignert. Klikk **Mer informasjon** og deretter **Kjør likevel**.

### Bygge for Windows fra Mac (valgfritt)

electron-builder kan lage Windows-filer fra macOS, men det er enklest og mest pålitelig å bygge på det operativsystemet du skal lage filer for. Vil du likevel prøve:

```bash
npm run dist:win
```

Det kan kreve at [Wine](https://www.winehq.org/) er installert, blant annet for å sette ikon og metadata. Det er ikke mulig å bygge `.dmg` fra Windows.

### Egendefinert ikon (valgfritt)

Legg en kvadratisk PNG på minst 512 × 512 piksler i `build/icon.png`. electron-builder lager da `.icns` og `.ico` automatisk. Uten egen fil brukes standardikonet til Electron.

---

## Prosjektstruktur

```
uib-karaktersnitt/
├── package.json      # Skript og electron-builder-oppsett
├── main.js           # Electron-hovedprosess: vindu og lagring til JSON
├── preload.js        # Sikker bro mellom vinduet og hovedprosessen
├── build/            # (valgfritt) icon.png for installasjonsfilene
└── src/
    ├── index.html    # Grensesnitt
    ├── styles.css    # Design, lys og mørk modus
    └── app.js        # UiB-regler, beregninger og logikk
```

Reglene for karakterverdier og bokstavgrenser står øverst i `src/app.js`, i `GRADE_VALUES` og `THRESHOLDS`, så de er lette å justere.
