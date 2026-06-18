import { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(451).json({ error: "Metoda nepovolena. Použijte POST." });
  }

  try {
    const { recipe, adminPassword } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    const envAdminPassword = process.env.ADMIN_PASSWORD;
    const password = (adminPassword || "").trim();

    const isAuthorized = (envAdminPassword && password === envAdminPassword.trim()) || 
                         (apiKey && password === apiKey.trim());

    if (!isAuthorized) {
      return res.status(403).json({ error: "Neautorizovaný přístup. AI funkce jako administrátor jsou zamčeny." });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Chybí klíč GEMINI_API_KEY v prostředí." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `
Jsi odborný kulinářský simulátor, auditní systém a analyzátor receptů "AI Kuchařka".
Tvým úkolem je podrobit předložený recept kompletní kulinářské simulaci ("přehrát ho" od začátku do konce), odhalit slabá místa (fyzika, chemie jídla, poměry, časy, teploty) a navrhnout jedno konkrétní významné zlepšení.

Následně vrátíš strukturovanou odpověď:
1. 'evaluation': Profesionální kulinářská analýza a hodnocení receptu (česky).
2. 'simulationSteps': Krok za krokem popiš průběh tvé kulinářské simulace (4-5 kroků). Popiš chemické a kulinářské detaily toho, co se v každém kroku simulace dělo a co jsi zjistil (např. 'Simulace hnětení: Zjistili jsme, že lepek se tvořil pomalu...', 'Simulace pečení: Maillardova reakce neproběhla rovnoměrně...').
3. 'proposedChange': Stručný (1-2 věty) popis navrhované změny a vylepšení.
4. 'modifiedRecipe': Kompletní strukturovaný objekt receptu se všemi poli, kde je tato změna plně zapracována.

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

Spusť virtuální kulinářskou simulaci vaření, zapiš její kroky, vygeneruj profesionální hodnocení, navrhni jedno konkrétní zlepšení a vygeneruj upravený vylepšený recept.
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
            evaluation: {
              type: Type.STRING,
              description: "Stručné profesionální kulinářské hodnocení a analýza receptu (česky)"
            },
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
          required: ["evaluation", "simulationSteps", "proposedChange", "modifiedRecipe"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Model nevrátil žádnou odpověď.");
    }

    const auditResult = JSON.parse(outputText.trim());
    if (auditResult.modifiedRecipe) {
      auditResult.modifiedRecipe.id = recipe.id;
    }

    res.status(200).json(auditResult);

  } catch (error: any) {
    console.error("Vercel backend error (check-recipe):", error);
    res.status(500).json({
      error: error?.message || "Internal server error during recipe check.",
    });
  }
}
