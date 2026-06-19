import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON parsing with generous limits to support image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Lazy initializer for GoogleGenAI to prevent crashes if key is empty during start
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Chybí klíč GEMINI_API_KEY v prostředí. Nastavte jej v panelu Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust retry wrapper for Gemini Content Generation with model fallback to handle transient 503/429 errors gracefully
async function generateContentWithRetry(ai: GoogleGenAI, options: any, maxRetries = 5, initialDelayMs = 1500) {
  // Define fallback models if primary model suffers from service issues
  const originalModel = options.model || "gemini-3.5-flash";
  const modelFallbackSequence = [originalModel];
  if (!modelFallbackSequence.includes("gemini-flash-latest")) {
    modelFallbackSequence.push("gemini-flash-latest");
  }
  if (!modelFallbackSequence.includes("gemini-3.1-flash-lite")) {
    modelFallbackSequence.push("gemini-3.1-flash-lite");
  }

  let lastError: any = null;
  // Loop through fallback models to ensure extremely high availability and success rate
  for (const currentModel of modelFallbackSequence) {
    let attempt = 0;
    while (attempt < 2) { // try each model up to 2 times
      try {
        const currentOptions = { ...options, model: currentModel };
        return await ai.models.generateContent(currentOptions);
      } catch (error: any) {
        attempt++;
        lastError = error;
        const isTransient = 
          error?.status === "UNAVAILABLE" || 
          error?.message?.includes("UNAVAILABLE") || 
          error?.message?.includes("503") || 
          error?.status === "RESOURCE_EXHAUSTED" || 
          error?.message?.includes("429") ||
          error?.message?.includes("RESOURCE_EXHAUSTED") ||
          error?.message?.includes("high demand") ||
          (error?.status >= 500 && error?.status < 600);

        if (isTransient) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          console.log(`[Gemini API] Model ${currentModel} dočasně nedostupný, zkouším pokus ${attempt}/2 za ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Structural error - throw immediately instead of falling back
          throw error;
        }
      }
    }
    console.log(`[Gemini API] Model ${currentModel} vyčerpal pokusy. Zkouším náhradní model v sekvenci...`);
  }
  
  throw lastError || new Error("Nepodařilo se vygenerovat obsah pomocí žádného z dostupných AI modelů.");
}

// Support dual authentication: ADMIN_PASSWORD or GEMINI_API_KEY
function checkAuth(adminPassword: any): boolean {
  if (!adminPassword || typeof adminPassword !== "string" || !adminPassword.trim()) {
    return false;
  }
  const password = adminPassword.trim();
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const envAdminPassword = (process.env.ADMIN_PASSWORD || "").trim();

  // 1. Verify against explicit custom administrator password (safe and recommended)
  if (envAdminPassword && password === envAdminPassword) {
    return true;
  }
  // 2. Fallback: Verify against GEMINI_API_KEY as the access token
  if (apiKey && password === apiKey) {
    return true;
  }
  return false;
}


// 1. API Endpoint for Health checks
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date().toISOString() });
});

// Endpoint to verify administrator / API key
app.post("/api/verify-admin", (req, res) => {
  try {
    const { adminPassword } = req.body;

    if (checkAuth(adminPassword)) {
      return res.json({ success: true });
    }
    return res.status(401).json({ error: "Neplatný klíč. Pro přístup jako administrátor zadejte buď platný administrátorský kód (ADMIN_PASSWORD) nebo Gemini API klíč." });
  } catch (error) {
    return res.status(500).json({ error: "Chyba při ověřování klíče." });
  }
});

// 2. API Endpoint to enhance recipe
app.post("/api/enhance-recipe", async (req, res) => {
  try {
    const { rawText, fileData, fileName, mimeType, adminPassword } = req.body;

    if (!checkAuth(adminPassword)) {
       return res.status(401).json({ error: "Přístup odepřen. Pro přidání a generování nového receptu se musíte přihlásit platným administrátorským kódem nebo kulinářským API klíčem." });
    }

    if (!rawText && !fileData) {
      return res.status(400).json({ error: "Musíte poskytnout buď text receptu nebo nahrát soubor." });
    }

    const ai = getAi();
    const parts: any[] = [];

    // System instruction details representing the exact 5-source synthesis models requested by the user:
    const systemInstruction = `
Jsi odborný asistent pro vaření "AI Kuchařka", pokročilý kulinářský syntezátor a technologický gastronom.
Tvým úkolem je vzít chaotický, syrový, nepřesný nebo neuspořádaný recept (který ti uživatel zadá v textu a/nebo v nahraném obrázku či PDF) a kompletně jej přepracovat a vylepšit na profesionální standard pro domácí kuchaře.

Při syntéze a úpravě receptu MUSÍŠ kombinovat přesně těchto pět zdrojových pilířů odborných znalostí:
1. Akademická literatura (Food science): optimalizace denaturace proteinů, želatinizace škrobů a zachování nutričních hodnot.
2. Odborně posouzené zdroje (Masterclass): kulinářská zručnost mistrů zjednodušená do jasných kroků.
3. Online registry receptů: analýza tisíců poměrů surovin a koření pro nejlepší chuť.
4. Diskuzní kulinářská fóra: odhalení nejčastějších chyb běžných kuchařů a jejich preventivní řešení.
5. Inženýrství moderních spotřebičů: úprava teplot a časů pro moderní kuchyňské stroje (Horkovzdušná fritéza / Air Fryer, roboty typu Thermomix, pomalé vaření, domácí pekárny, parní trouby).

ZÁSADNÍ PRAVIDLA:
- Zkracuj názvy receptů (title) na naprosté kulinářské minimum a jádro věci. Nepoužívej zbytečné přívlastky. Např. nepiš 'domácí kváskový chléb s žitnou moukou', ale pouze 'Kváskový chléb'; nepiš 'pomalé tažené kuřecí stehno na česneku', ale jen 'Kuřecí stehna na česneku'.
- Shrnutí receptu (summary) musí být velmi krátké, věcné a přehledné (cca 1-2 věty), žádné plané vycpávky ani přemíra marketingu. Nepiš zde o věcech jako 'speciální autolýza' nebo vznosné popisy, - Suroviny upřesni na přesné metrické jednotky vhodné pro domácnost.
- Krok za krokem postup (instructions) rozepiš do velmi podrobných, detailních a popsaných vět. Popiš přesné kulinářské nebo mechanické úkony s kuchyňským náčiním.
- DO KAŽDÉHO JEDNOTLIVÉHO KROKU (v poli 'instructions') MUSÍŠ EXPLICITNĚ ZAPSAT PŘESNÉ VÁHY NEBO MNOŽSTVÍ VŠECH SUROVIN, KTERÉ SE V DANÉM KROKU PŘIDÁVAJÍ NEBO ZPRACOVÁVAJÍ! (Např. místo 'přidejte mouku, máslo a cukr' musíš napsat 'do mísy přidejte 250 g hladké mouky, 120 g změklého másla a 50 g moučkového cukru'). Toto je kritické, aby měl kuchař váhy přímo před sebou v aktuálním kroku!
- Časovače jako samostatné odpočítávače u kroků zruš, vůbec na nich netrvej, důležité jsou detailní popisy děje a kulinářské kroky.
- Tipy pro moderní kuchyni musí konkrétně popsat využití Air Fryeru (horkovzdušné fritézy), kuchyňských robotů (Thermomix), pomalých hrnců, domácích pekáren nebo podobných přístrojů pro tento recept.
- V odůvodnění 'expertJustification' podrobně vysvětli laickým jazykem, PROČ jsi změnil teploty, časy, postupy nebo poměry na základě zmíněných 5 pilířů (zejména food science a kuchařské chemie).
- ODSTRANĚNÍ KONZERVANTŮ: V ŽÁDNÉM RECEPTU (ZEJMÉNA V POLÉVKÁCH COŽ JSOU POLIEVKY) NESMÍ BÝT POUŽITY ŽÁDNÉ KONZERVAČNÍ LÁTKY, KONZERVANTY ANI UMĚLÁ DOCHUCOVADLA. Používej výhradně čerstvé přírodní suroviny.
`;

    // Add manual text notes
    let userPrompt = "Zde je můj původní recept k vylepšení:\n";
    if (rawText) {
      userPrompt += `--- TEXT RECEPTU ---\n${rawText}\n`;
    }

    if (fileData) {
      // Inline document or image part for Gemini multimodal understanding
      const cleanBase64 = fileData.replace(/^data:.*,/, ""); // strip the data uri header if present
      parts.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: cleanBase64,
        },
      });
      userPrompt += "\nUživatel také přiložil soubor (obrázek/dokument) s receptem. Prosím, extrahuj z něj recept a zkombinuj ho s textovými poznámkami výše. NEPOUŽÍVEJ žádné konzervační látky ani umělé přísady v receptu.";
    }

    parts.push({ text: userPrompt });

    // Call the model gemini-3.5-flash for basic text + multimodal tasks with retry mechanism
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { 
              type: Type.STRING, 
              description: "Název vylepšeného receptu (např. 'Pikantní pečená křídla s medem')" 
            },
            summary: { 
              type: Type.STRING, 
              description: "Strohá specifikace v 1-2 českých větách vystihující podstatu vylepšení." 
            },
            ingredients: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Přesný seznam surovin s metrickými jednotkami. Nesmí obsahovat konzervační látky ani konzervanty." 
            },
            instructions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Postup přípravy krok za krokem v postupných čitelných odstavcích" 
            },
            applianceTips: { 
              type: Type.STRING, 
              description: "Konkrétní tip pro moderní kuchyňské pomocníky (Air Fryer, Thermomix, Remosku, pomalý hrnec atd.)" 
            },
            expertJustification: { 
              type: Type.STRING, 
              description: "Jasné a srozumitelné odůvodnění z pohledu chemie jídla a kuchařských chyb, proč je tento upravený postup lepší" 
            },
            applianceType: { 
              type: Type.STRING, 
              description: "Název spotřebiče, který je doporučen pro optimalizaci (např. 'Horkovzdušná fritéza', 'Thermomix / Kuchyňský robot', 'Pomalý hrnec', 'Domácí pekárna', 'Multifunkční hrnec', 'Klasická trouba')" 
            },
            cookingTime: { 
              type: Type.STRING, 
              description: "Celková doba přípravy vaření (např. '45 min')" 
            },
            difficulty: { 
              type: Type.STRING, 
              description: "Náročnost receptu. Musí být přesně jedna z hodnot: 'Snadné', 'Střední', 'Složité'" 
            },
            category: {
              type: Type.STRING,
              description: "Kategorie jídla. Vyber přesně jednu z hodnot: 'Pečivo', 'Maso', 'Polévky', 'Sladká jídla a moučníky', 'Ostatní'."
            }
          },
          required: [
            "title", 
            "summary", 
            "ingredients", 
            "instructions", 
            "applianceTips", 
            "expertJustification", 
            "applianceType", 
            "cookingTime", 
            "difficulty",
            "category"
          ]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Model nevrátil žádný text.");
    }

    const enhancedRecipe = JSON.parse(outputText.trim());
    enhancedRecipe.id = `gen-${Date.now()}`;
    
    // Return the response
    res.json({ recipe: enhancedRecipe });

  } catch (error: any) {
    console.error("Recipe generation error:", error);
    res.status(500).json({ 
      error: error?.message || "Došlo k vnitřní chybě při komunikaci s AI.",
      details: error.stack
    });
  }
});

// 3. API Endpoint to edit/modify an existing recipe based on user instructions
app.post("/api/edit-recipe", async (req, res) => {
  try {
    const { recipe, modificationPrompt, adminPassword } = req.body;

    if (!checkAuth(adminPassword)) {
      return res.status(401).json({ error: "Přístup odepřen. K úpravě receptu se musíte přihlásit platným administrátorským kódem nebo kulinářským API klíčem." });
    }

    if (!recipe || !modificationPrompt) {
      return res.status(400).json({ error: "Chybí stávající recept nebo pokyny pro úpravu." });
    }

    const ai = getAi();
    
    const systemInstruction = `
Jsi odborný asistent pro vaření "AI Kuchařka", pokročilý kulinářský syntezátor a technologický gastronom.
Tvým úkolem je upravit stávající recept na základě konkrétních pokynů a modifikací od uživatele.

Při úpravě receptu MUSÍŠ zachovat stávající strukturu, ale modifikovat obsah tak, aby odpovídal pokynům. Opět kombinuj pět zdrojových pilířů:
1. Akademická literatura (Food science): optimalizace denaturace proteinů, želatinizace škrobů a zachování nutričních hodnot s ohledem na provedené změny.
2. Odborně posouzené zdroje (Masterclass): kulinářská zručnost mistrů zjednodušená do jasných kroků.
3. Online registry receptů: analýza tisíců poměrů surovin a koření.
4. Diskuzní kulinářská fóra: odhalení nejčastějších chyb a jejich prevence.
5. Inženýrství moderních spotřebičů: úprava teplot, časů, nebo změna doporučeného spotřebiče, pokud to uživatel požaduje.

ZÁSADNÍ PRAVIDLA:
- Zkracuj názvy receptů (title) na naprosté kulinářské minimum a jádro věci. Nepoužívej zbytečné přívlastky. Např. piš 'Kváskový chléb' místo 'domácí kváskový chléb s žitnou moukou'.
- Shrnutí receptu (summary) musí být velmi krátké, věcné a přehledné (cca 1-2 věty). Omez nepotřebné kulinářské klišé.
- Všechny texty v odpovědi MUSÍ být napsány bezchybně v ČESKÉM JAZYCE (čeština).
- Tón musí zůstat odborný, přátelský, povzbuzující a srozumitelný.
- Suroviny upřesni na přesné metrické jednotky vhodné pro domácnost.
- Krok za krokem postup (instructions) rozepiš do velmi podrobných, detailních a popsaných vět. Popiš přesné kulinářské nebo mechanické úkony s kuchyňským náčiním.
- DO KAŽDÉHO JEDNOTLIVÉHO KROKU (v poli 'instructions') MUSÍŠ EXPLICITNĚ ZAPSAT PŘESNÉ VÁHY NEBO MNOŽSTVÍ VŠECH SUROVIN, KTERÉ SE V DANÉM KROKU PŘIDÁVAJÍ NEBO ZPRACOVÁVAJÍ! (Např. místo 'přidejte mouku, máslo a cukr' musíš napsat 'do mísy přidejte 250 g hladké mouky, 120 g změklého másla a 50 g moučkového cukru'). Toto je kritické, aby měl kuchař váhy přímo před sebou v aktuálním kroku!
- Časovače jako samostatné odpočítávače u kroků zruš, vůbec na nich netrvej, důležité jsou detailní popisy děje a kulinářské kroky.
- Tipy pro moderní kuchyni musí konkrétně popsat využití spotřebiče pro tento recept.
- V odůvodnění 'expertJustification' popiš, jaké změny jsi udělal a proč jsou tyto úpravy lepší a chemicky/kuchařsky vyvážené.
- ODSTRANĚNÍ KONZERVANTŮ: V ŽÁDNÉM RECEPTU (ZEJMÉNA V POLÉVKÁCH) NESMÍ BÝT POUŽITY ŽÁDNÉ KONZERVAČNÍ LÁTKY, KONZERVANTY ANI UMĚLÁ DOCHUCOVADLA. Používej výhradně čerstvé přírodní suroviny.
`;

    const userPrompt = `
Zde je stávající recept:
${JSON.stringify(recipe, null, 2)}

A zde jsou požadavky na úpravu od uživatele:
"${modificationPrompt}"

Vytvoř kompletně aktualizovaný recept se všemi poli. Ujisti se, že pokud se jedná o polévku, neobsahuje žádné konzervační látky ani konzervanty.

Kompletní aktualizovaný recept:
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Název upraveného receptu" },
            summary: { type: Type.STRING, description: "Strohá specifikace v 1-2 českých větách vystihující podstatu úpravy." },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Přesný seznam surovin s metrickými jednotkami. Nesmí obsahovat konzervační látky." },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Postup přípravy krok za krokem" },
            applianceTips: { type: Type.STRING, description: "Konkrétní tip pro moderní kuchyňské pomocníky" },
            expertJustification: { type: Type.STRING, description: "Jasné a srozumitelné odůvodnění provedených změn" },
            applianceType: { type: Type.STRING, description: "Název spotřebiče pro optimalizaci" },
            cookingTime: { type: Type.STRING, description: "Celková doba přípravy" },
            difficulty: { type: Type.STRING, description: "Náročnost receptu ('Snadné', 'Střední', 'Složité')" },
            category: { type: Type.STRING, description: "Kategorie jídla. Vyber přesně jednu z hodnot: 'Pečivo', 'Maso', 'Polévky', 'Sladká jídla a moučníky', 'Ostatní'." }
          },
          required: [
            "title", 
            "summary", 
            "ingredients", 
            "instructions", 
            "applianceTips", 
            "expertJustification", 
            "applianceType", 
            "cookingTime", 
            "difficulty",
            "category"
          ]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Model nevrátil žádný text.");
    }

    const edited = JSON.parse(outputText.trim());
    edited.id = recipe.id || `gen-${Date.now()}`;
    
    res.json({ recipe: edited });

  } catch (error: any) {
    console.error("Recipe edit error:", error);
    res.status(500).json({ 
      error: error?.message || "Došlo k vnitřní chybě při úpravě receptu pomocí AI.",
      details: error.stack
    });
  }
});

// 4. API Endpoint to audit/play through a recipe and propose a modification
app.post(["/api/audit-recipe", "/api/check-recipe"], async (req, res) => {
  try {
    const { recipe, adminPassword } = req.body;

    if (!checkAuth(adminPassword)) {
      return res.status(401).json({ error: "Přístup odepřen. Ke kontrole receptu se musíte přihlásit platným administrátorským kódem nebo kulinářským API klíčem." });
    }

    if (!recipe) {
      return res.status(400).json({ error: "Chybí recept pro kontrolu." });
    }

    const ai = getAi();
    
    const systemInstruction = `
Jsi odborný kulinářský simulátor, auditní systém a analyzátor receptů "AI Kuchařka".
Tvým úkolem je podrobit předložený recept kompletní kulinářské simulaci ("přehrát ho" od začátku do konce), odhalit slabá místa (fyzika, chemie jídla, poměry, časy, teploty) a navrhnout jedno konkrétní významné zlepšení.

Následně vrátíš strukturovanou odpověď:
1. 'simulationSteps': Krok za krokem popiš průběh tvé kulinářské simulace (4-5 kroků). Popiš chemické a kulinářské detaily toho, co se v každém kroku simulace dělo a co jsi zjistil (např. 'Simulace hnětení: Zjistili jsme, že lepek se tvořil pomalu kvůli nízké hydrataci...', 'Simulace pečení: Maillardova reakce neproběhla rovnoměrně...').
2. 'proposedChange': Stručný (1-2 věty) popis navrhované změny a vylepšení.
3. 'modifiedRecipe': Kompletní strukturovaný objekt receptu se všemi poli, kde je tato změna plně zapracována.

Při úpravě receptu a simulaci dbej na tyto pilíře:
- Food science (chemie a fyzika jídla).
- Odstranění jakýchkoliv konzervačních látek (vše musí být čerstvé a přírodní).
- Srozumitelnost pro domácnosti.
- Zkrácení názvu na jasné gastronomické jádro bez marketingového balastu.
Všechny texty musí být v bezchybné ČEŠTINĚ.
`;

    const userPrompt = `
Zde je recept, který máš nasimulovat (přehrát) a zkontrolovat:
${JSON.stringify(recipe, null, 2)}

Spusť virtuální kulinářskou simulaci vaření, zapiš její kroky, navrhni jedno konkrétní zlepšení a vygeneruj upravený vylepšený recept.
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            simulationSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4-5 kroků simulovaného průběhu vaření a analýzy (česky)"
            },
            proposedChange: {
              type: Type.STRING,
              description: "Jasný a stručný popis navrhované změny (1-2 věty, česky)"
            },
            modifiedRecipe: {
              type: Type.OBJECT,
              description: "Kompletní upravený recept jako objekt",
              properties: {
                title: { type: Type.STRING, description: "Název upraveného receptu" },
                summary: { type: Type.STRING, description: "Velmi krátké shrnutí upraveného receptu v 1-2 českých větách" },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suroviny s metrickými jednotkami, bez konzervantů" },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Postup přípravy" },
                applianceTips: { type: Type.STRING, description: "Tip pro moderní kuchyňské pomocníky" },
                expertJustification: { type: Type.STRING, description: "Kondenzované odůvodnění změny" },
                applianceType: { type: Type.STRING, description: "Doporučený spotřebič" },
                cookingTime: { type: Type.STRING, description: "Doba přípravy doložená simulací" },
                difficulty: { type: Type.STRING, description: "Náročnost receptu ('Snadné', 'Střední', 'Složité')" },
                category: { type: Type.STRING, description: "Kategorie jídla." }
              },
              required: [
                "title", 
                "summary", 
                "ingredients", 
                "instructions", 
                "applianceTips", 
                "expertJustification", 
                "applianceType", 
                "cookingTime", 
                "difficulty",
                "category"
              ]
            }
          },
          required: ["simulationSteps", "proposedChange", "modifiedRecipe"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Simulátor nevrátil žádný text.");
    }

    const auditResult = JSON.parse(outputText.trim());
    if (auditResult.modifiedRecipe) {
      auditResult.modifiedRecipe.id = recipe.id;
    }
    
    res.json(auditResult);

  } catch (error: any) {
    console.error("Recipe audit error:", error);
    res.status(500).json({ 
      error: error?.message || "Došlo k vnitřní chybě při simulaci a kontrole receptu.",
      details: error.stack
    });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Kuchařka Express server running on port ${PORT}`);
  });
}

// Export app instance so it can be used by serverless platforms (like Vercel) or other loaders
export default app;

if (!process.env.VERCEL) {
  startServer();
}
