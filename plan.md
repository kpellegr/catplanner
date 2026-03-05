# **Briefing: Bouw een Studiewijzer Planning Tool voor Daan (ADHD-vriendelijk)**
**Doel**: Bouw een **web-app** die Daan’s weekplanning genereert uit een **studiewijzer (Markdown)**, met ondersteuning voor:
- **Automatische parsing** van taken (alleen WW/STEM, Z-route).
- **Weekrooster** met vaste vakken/hobbies en verplaatsbare taken.
- **Kanban-bord** en **"Vandaag"-view** voor ADHD-vriendelijke weergave.
- **Gedeeltelijke voortgang** (bijv. 30/60 minuten gewerkt).
- **Telegram-notificaties** voor buddies (ouders/docenten).

---

## **1. Context en Eisen**
### **Gebruiker: Daan**
- **ADHD**: Geen strikte timings, visuele duidelijkheid, Kanban/"Vandaag"-view.
- **Richting**: **Wetenschappen-Wiskunde (WW)**, **Z-route voor STEM-vakken**.
- **Input**: Studiewijzer in **Markdown** (voorbeeld: `P3W4.md`).
- **Output**: Gestructureerde **JSON/YAML** voor planning in Vue.js.

### **Technische Keuzes**
- **Frontend**: **Vue.js** (voorkeur van de gebruiker).
- **Data**: **Markdown/YAML** (geen database, human-readable).
- **Backend**: **Client-only** (IndexedDB voor lokale opslag).
- **Notificaties**: **Telegram Bot API**.

---

## **2. Studiewijzer Structuur**
### **Voorbeeld (`P3W4.md`)**
```markdown
## WETENSCHAPPEN > BIOLOGIE
| Richting | Volgorde | Code | Opdrachten                           | Tijd | Route | Flags |
| -------- | -------- | ---- | ------------------------------------ | ---- | ----- | ----- |
| WW       | 1        | BI6  | Studeren toets "Genetisch materiaal" | 25'  | Z     | P     |
| WW       | 2        | BI7  | Verwerken leerstof                   | 40'  | Z     |       |

## WETENSCHAPPEN > CHEMIE
| WW | 1 | CH3 | MC Theorie Atoombouw | rooster | Z | |
```

### **Parser-Logica**
1. **Blokken herkennen**: Gescheiden door `##` (bijv. "WETENSCHAPPEN > BIOLOGIE").
2. **Taken extraheren**:
   - **Richting**: `WW` (Wetenschappen-Wiskunde).
   - **Volgorde**: `1`, `2`, `3` (moet in deze volgorde uitgevoerd worden).
   - **Code**: `BI6`, `CH3` (unieke opdrachtcode).
   - **Tijd**: `25'` (25 minuten) of `rooster` (tijdens les).
   - **Route**: `Z` (Z-route) of `B` (B-route).
   - **Flags**: `P` (inleveren op papier), `M` (materiaal meebrengen), `U` (uitgestelde deadline), `G` (groepswerk).
3. **Filteren**:
   - Alleen taken met **richting = WW** en **route = Z**.
   - **Verificatiestap**: Vraag bevestiging voor onduidelijke taken (bijv. ontbrekende tijd/route).

---

## **3. Gestructureerde Output (JSON/YAML)**
```json
[
  {
    "richting": "WETENSCHAPPEN",
    "vak": "BIOLOGIE",
    "taken": [
      {
        "richting": "WW",
        "volgorde": 1,
        "code": "BI6",
        "omschrijving": "Studeren toets Genetisch materiaal",
        "tijd": 25,
        "route": "Z",
        "flags": ["P"],
        "relevantie": "high"
      }
    ]
  }
]
```

---
## **4. Weekrooster en Planning**
### **Vaste Blokken**
- **Vakken**: Bijv. "Maandag 10:00-12:00: Wiskunde (Z-route)".
- **Hobbies**: Bijv. "Woensdag 15:00-16:30: Voetbal".
- **Ad-hoc**: Bijv. "Donderdag: Schooluitstap".

### **Taken Plannen**
- **"Rooster"-taken**: Automatisch in lesblokken (bijv. `MC Theorie Atoombouw` → Wiskunde-les).
  - **Verplaatsbaar**: Als de taak niet af is, kan Daan deze verslepen naar een **huistaak-slot**.
- **Huistaken**: Daan sleept taken naar vrije tijdsloten, rekening houdend met:
  - **Volgorde** (taak `1` voor `2`).
  - **Tijdsduur** (bijv. 60’ taak past niet in 30’ slot).

### **Gedeeltelijke Voortgang**
- Taken krijgen een **voortgangsbalk** (bijv. "30/60 minuten").
- Status: "Te doen" / "Bezig (30%)" / "Afgerond".

---
## **5. ADHD-Vriendelijke Features**
- **Kanban-bord**:
  - Kolommen: **"Vandaag"** / "Deze Week" / "Te Doen" / "Bezig" / "Klaar".
  - **Kleurcodes**: Groen (Biologie), Blauw (Chemie), Rood (deadline nadert).
- **"Vandaag"-view**:
  - Alleen taken voor vandaag, gesorteerd op volgorde/tijd.
- **Geen strikte timers**: Taken kunnen elke dag verschoven worden.

---
## **6. Telegram Notificaties**
- **Herinneringen**:
  - "Daan, je hebt vandaag 3 taken: [lijst]. Wil je er nu één doen?"
  - "Je hebt 30’ gewerkt aan 'Verwerken Atoombouw'. Wil je de resterende 30’ nu doen?"
- **Buddy-updates**:
  - "Daan heeft 'Biologie: MC Genetisch materiaal' afgerond."

---
## **7. Technische Implementatie**
### **Stap 1: Parser in JavaScript**
```javascript
const fs = require('fs');

function parseStudiewijzer(markdownContent) {
  const lines = markdownContent.split('\n');
  const blokken = [];
  let currentBlok = null;
  let inTable = false;

  lines.forEach(line => {
    if (line.startsWith('##')) {
      const blokNaam = line.replace('## ', '').trim();
      const [richting, vak] = blokNaam.split(' > ');
      currentBlok = { richting: richting.trim(), vak: vak.trim(), taken: [] };
      blokken.push(currentBlok);
      inTable = false;
    }
    else if (line.includes('|---|') || line.includes('| --- ')) {
      inTable = true;
    }
    else if (inTable && line.includes('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      if (cells.length >= 4) {
        const [richting, volgorde, code, omschrijving, tijd, route, flags] = cells;
        if (richting && omschrijving) {
          currentBlok.taken.push({
            richting,
            volgorde: volgorde || null,
            code: code || null,
            omschrijving: omschrijving.replace(/"/g, ''),
            tijd: tijd?.replace(/'/g, ''),
            route: route || null,
            flags: flags ? flags.split('').filter(f => ['P', 'M', 'U', 'G'].includes(f)) : []
          });
        }
      }
    }
    else if (inTable && line.trim() === '') {
      inTable = false;
    }
  });
  return blokken;
}

// Filter voor Daan
function filterRelevanteTaken(blokken, config) {
  return blokken
    .filter(blok => config.belangrijkeRichtingen.includes(blok.richting))
    .map(blok => ({
      ...blok,
      taken: blok.taken.filter(taak => taak.richting === 'WW' && taak.route === 'Z')
    }))
    .filter(blok => blok.taken.length > 0);
}

// Configuratie
const config = {
  belangrijkeRichtingen: ['WETENSCHAPPEN'],
  belangrijkeVakken: ['BIOLOGIE', 'CHEMIE', 'FYSICA', 'WISKUNDE'],
  route: 'Z'
};

// Lees en parse het bestand
const markdownContent = fs.readFileSync('P3W4.md', 'utf8');
const geparsteData = parseStudiewijzer(markdownContent);
const relevanteTaken = filterRelevanteTaken(geparseData, config);

console.log(JSON.stringify(relevanteTaken, null, 2));
```

### **Stap 2: Vue.js Integratie**
```vue
<template>
  <div>
    <input type="file" @change="handleFileUpload" accept=".md,.txt" />
    <pre v-if="geparsteData">{{ geparsteData }}</pre>
  </div>
</template>

<script>
export default {
  data() {
    return {
      geparseData: null,
      config: {
        belangrijkeRichtingen: ['WETENSCHAPPEN'],
        belangrijkeVakken: ['BIOLOGIE', 'CHEMIE', 'FYSICA', 'WISKUNDE'],
        route: 'Z'
      }
    };
  },
  methods: {
    parseStudiewijzer(markdownContent) { /* Voeg de parser-functie hier toe */ },
    filterRelevanteTaken(blokken) { /* Voeg de filter-functie hier toe */ },
    handleFileUpload(event) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.geparseData = this.filterRelevanteTaken(
          this.parseStudiewijzer(e.target.result),
          this.config
        );
      };
      reader.readAsText(file);
    }
  }
};
</script>
```

### **Stap 3: Telegram Bot (Optioneel)**
```javascript
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot('JOUW_TELEGRAM_TOKEN', { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Hallo! Ik stuur updates over Daan's planning.");
});

// Stuur notificatie
function stuurNotificatie(chatId, bericht) {
  bot.sendMessage(chatId, bericht);
}
```

---
## **8. Stappenplan voor de Agent**
1. **Parser Bouwen**:
   - Implementeer de `parseStudiewijzer`-functie in JavaScript.
   - Test met `P3W4.md` en valideer de output.
2. **Vue.js Frontend**:
   - Bouw een component om het Markdown-bestand te uploaden en de geparste data te tonen.
   - Voeg een **Kanban-bord** en **"Vandaag"-view** toe.
3. **Weekrooster**:
   - Implementeer vaste blokken (vakken/hobbies) en sleepfunctie voor taken.
4. **Telegram Notificaties**:
   - Integreer de Telegram-bot voor herinneringen en buddy-updates.
5. **Testen**:
   - Test met Daan en pas de UI aan op basis van feedback (bijv. kleuren, grootte).

---
## **9. Vragen voor de Agent**
1. **Parser**:
   - Moet de parser **extra validatieregels** hebben (bijv. voor deadlines of volgorde)?
   - Hoe gaan we om met **"rooster"-taken** (tijdens les vs. huistaak)?
2. **Frontend**:
   - Wil je een **voorbeeld-implementatie** van de Vue-component voor het uploaden en tonen van data?
   - Moeten we **animaties** toevoegen voor het slepen van taken?
3. **Telegram**:
   - Moeten notificaties **dagelijks** of alleen bij belangrijke updates (bijv. deadline nadert)?

---
## **10. Leverables**
1. **Parser-script** (JavaScript) om studiewijzers naar JSON te converteren.
2. **Vue.js app** met:
   - Upload-functie voor Markdown.
   - Kanban-bord en "Vandaag"-view.
   - Sleepfunctie voor taken.
3. **Telegram-bot** voor notificaties.
4. **Documentatie** voor hoe Daan/ouders de tool kunnen gebruiken.
