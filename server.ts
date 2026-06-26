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
const REPO_OWNER = "karelaa-4082"; // OPRAVENO: Vaše správné GitHub uživatelské jméno
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
- Časovače jako samostatné odpočítávače u kroků zruš, vůbec na nich netrvej, důležité jsou detailní popisy děje a kulinář
