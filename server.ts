import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Konfigurace pro přístup k externímu datovému repozitáři na GitHubu
const GITHUB_TOKEN = process.env.GITHUB_DATA_TOKEN;
const REPO_OWNER = "karelaa-4082s"; // Váš GitHub owner/organizace podle Vercel URL
const REPO_NAME = "ai-kucharka-data";
const FILE_PATH = "recepty.json"; // Název JSON souboru ve vašem datovém repozitáři

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
  const originalModel = options.model || "gemini-3.5-flash";
  const modelFallbackSequence = [originalModel];
  if (!modelFallbackSequence.includes("gemini-flash-latest")) {
    modelFallbackSequence.push("gemini-flash-latest");
  }
  if (!modelFallbackSequence.includes("gemini-3.1-flash-lite")) {
    modelFallbackSequence.push("gemini-3.1-flash-lite");
  }

  let lastError: any = null;
  for (const currentModel of modelFallbackSequence) {
    let attempt = 0;
    while (attempt < 2) {
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

  if (envAdminPassword && password === envAdminPassword) {
    return true;
  }
  if (apiKey && password === apiKey) {
    return true;
  }
  return false;
}

// 1. API Endpoint for Health checks
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date().toISOString() });
});

// NOVÝ ENDPOINT: Načtení receptů z externího GitHub repozitáře ai-kucharka-data
app.get("/api/recipes", async (req, res) => {
  try {
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ 
        error: "Konfigurační chyba", 
        details: "V prostředí Vercel chybí nastavení proměnné GITHUB_DATA_TOKEN." 
      });
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3.raw",
        "User-Agent": "AI-Kucharika-App"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API odpovědělo kódem ${response.status}: ${response.statusText}`);
    }

    const recipesData = await response.json();
    return res.json(recipesData);
  } catch (error: any) {
    console.error("Chyba při načítání receptů z GitHubu:", error);
    return res.status(500).json({ 
      error: "Nepodařilo se načíst dynamická data z GitHub repozitáře.", 
      details: error.message 
    });
  }
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
- Shrnutí receptu (summary) must be very krátké, věcné a přehledné (cca 1-2 věty), žádné plané vycpávky ani přemíra marketingu. Nepiš zde o věcech jako 'speciální autolýza' nebo vznosné popisy, - Suroviny upřesni na přesné metrické jednotky vhodné pro domácnost.
- Krok za krokem postup (instructions) rozepiš do velmi podrobných, detailních a popsaných vět. Popiš přesné kulinářské nebo mechanické úkony s kuchyňským náčiním.
- DO KAŽDÉHO JEDNOTLIVÉHO KROKU (v poli 'instructions') MUSÍŠ EXPLICITNĚ ZAPSAT PŘESNÉ VÁHY NEBO MNOŽSTVÍ VŠECH SUROVIN, KTERÉ SE V DANÉM KROKU PŘIDÁVAJÍ NEBO ZPRACOVÁVAJÍ! (Např. místo 'přidejte mouku, máslo a cukr' musíš napsat 'do mísy přidejte 250 g hladké mouky, 120 g změklého másla a 50 g moučkového cukru'). Toto je kritické, aby měl kuchař váhy přímo před sebou v aktuálním kroku!
- Časovače jako samostatné odpočítávače u kroků zruš, vůbec na nich netrvej, důležité jsou detailní popisy děje a kulinářské kroky.
- Tipy pro moderní kuchyni musí konkrétně popsat využití Air Fryeru (horkovzdušné fritézy), kuchyňských robotů (Thermomix), pomalých hrnců, domácích pekáren nebo podobných přístrojů pro tento recept.
- V odůvodnění 'expertJustification' podrobně vysvětli laickým jazykem, PROČ jsi změnil teploty, časy, postupy nebo poměry na základě zmíněných 5 pilířů (zejména food science a kuchařské chemie).
- ODSTRANĚNÍ KONZERVANTŮ: V ŽÁDNÉM RECEPTU (ZEJMÉNA V POLÉVKÁCH COŽ JSOU POLIEVKY) NESMÍ BÝT POUŽITY ŽÁDNÉ KONZERVAČNÍ LÁTKY, KONZERVANTY ANI UMĚLÁ DOCHUCOVADLA. Používej výhradně čerstvé přírodní suroviny.
`;

    let userPrompt = "Zde je můj původní recept k vylepšení:\n";
    if (rawText) {
      userPrompt += `--- TEXT RECEPTU ---\n${rawText}\n`;
    }

    if (fileData) {
      const cleanBase64 = fileData.replace(/^data:.*,/, "");
      parts.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: cleanBase64,
        },
      });
      userPrompt += "\nUživatel také přiložil soubor (obrázek/dokument) s receptem. Prosím, extrahuj z něj recept a zkombinuj ho s textovými poznámkami výše. NEPOUŽÍVEJ žádné konzervační látky ani umělé přísady v receptu.";
    }

    parts.push({ text: userPrompt });

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Název vylepšeného receptu" },
            summary: { type: Type.STRING, description: "Strohá specifikace v 1-2 českých větách." },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Přesný seznam surovin s metrickými jednotkami." },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Postup přípravy krok za krokem." },
            applianceTips: { type: Type.STRING, description: "Konkrétní tip pro moderní kuchyňské pomocníky." },
            expertJustification: { type: Type.STRING, description: "Jasné a srozumitelné odůvodnění." },
            applianceType: { type: Type.STRING, description: "Název spotřebiče, který je doporučen." },
            cookingTime: { type: Type.STRING, description: "Celková doba přípravy vaření." },
            difficulty: { type: Type.STRING, description: "Náročnost receptu ('Snadné', 'Střední', 'Složité')." },
            category: { type: Type.STRING, description: "Kategorie jídla ('Pečivo', 'Maso', 'Polévky', 'Sladká jídla a moučníky', 'Ostatní')." }
          },
          required: [
            "title", "summary", "ingredients", "instructions", "applianceTips", 
            "expertJustification", "applianceType", "cookingTime", "difficulty", "category"
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
1. Akademická literatura (Food science)
2. Odborně posouzené zdroje (Masterclass)
3. Online registry receptů
4. Diskuzní kulinářská fóra
5. Inženýrství moderních spotřebičů

ZÁSADNÍ PRAVIDLA:
- Zkracuj názvy receptů (title) na naprosté kulinářské minimum.
- Shrnutí receptu (summary) musí být velmi krátké, věcné a přehledné (cca 1-2 věty).
- Všechny texty v odpovědi MUSÍ být napsány bezchybně v ČESKÉM JAZYCE.
- Suroviny upřesni na přesné metrické jednotky.
- DO KAŽDÉHO JEDNOTLIVÉHO KROKU (v poli 'instructions') MUSÍŠ EXPLICITNĚ ZAPSAT PŘESNÉ VÁHY NEBO MNOŽSTVÍ VŠECH SUROVIN!
- ODSTRANĚNÍ KONZERVANTŮ: V ŽÁDNÉM RECEPTU NESMÍ BÝT POUŽITY ŽÁDNÉ KONZERVAČNÍ LÁTKY ANI UMĚLÁ DOCHUCOVADLA.
`;

    const userPrompt = `
Zde je stávající recept:
${JSON.stringify(recipe, null, 2)}

A zde jsou požadavky na úpravu od uživatele:
"${modificationPrompt}"

Vytvoř kompletně aktualizovaný recept se všemi poli. Ujisti se, že pokud se jedná o polévku, neobsahuje žádné konzervační látky ani konzervanty.
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
            summary: { type: Type.STRING, description: "Strohá specifikace v 1-2 českých větách." },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Přesný seznam surovin bez konzervantů." },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Postup přípravy krok za krokem" },
            applianceTips: { type: Type.STRING, description: "Konkrétní tip pro moderní kuchyňské pomocníky" },
            expertJustification: { type: Type.STRING, description: "Jasné a srozumitelné odůvodnění" },
            applianceType: { type: Type.STRING, description: "Název spotřebiče pro optimalizaci" },
            cookingTime: { type: Type.STRING, description: "Celková doba přípravy" },
            difficulty: { type: Type.STRING, description: "Náročnost receptu ('Snadné', 'Střední', 'Složité')" },
            category: { type: Type.STRING, description: "Kategorie jídla ('Pečivo', 'Maso', 'Polévky', 'Sladká jídla a moučníky', 'Ostatní')." }
          },
          required: [
            "title", "summary", "ingredients", "instructions", "applianceTips", 
            "expertJustification", "applianceType", "cookingTime", "difficulty", "category"
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

Následně vrátíš strukturovanou odpověď obsahující simulationSteps, proposedChange a modifiedRecipe.
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
              description: "Jasný a stručný popis navrhované změny."
            },
            modifiedRecipe: {
              type: Type.OBJECT,
              description: "Kompletní upravený recept jako objekt",
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                applianceTips: { type: Type.STRING },
                expertJustification: { type: Type.STRING },
                applianceType: { type: Type.STRING },
                cookingTime: { type: Type.STRING },
                difficulty: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: [
                "title", "summary", "ingredients", "instructions", "applianceTips", 
                "expertJustification", "applianceType", "cookingTime", "difficulty", "category"
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

// Export app instance so it can be used by serverless platforms (like Vercel)
export default app;

if (!process.env.VERCEL) {
  startServer();
}
