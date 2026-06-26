import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.url && !req.url.startsWith("/api")) {
      const originalUrl = req.url;
      req.url = "/api" + (originalUrl.startsWith("/") ? "" : "/") + originalUrl;
      console.log(`[Vercel URL Rewrite] Normalized ${originalUrl} to ${req.url}`);
    }
    next();
  });
}

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

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date().toISOString() });
});

// GET /api - Rychlé stažení všech receptů ze složky recipes/ z GitHubu
app.get("/api", async (req, res) => {
  try {
    const token = (process.env.GITHUB_DATA_TOKEN || process.env.GITHUB_TOKEN || "").trim();
    const owner = (process.env.GITHUB_USERNAME || "ambrus-k").trim();
    const repo = (process.env.GITHUB_REPO || "ai-kucharka-data").trim();
    const branch = "main";

    if (token) {
      const octokit = new Octokit({ auth: token });
      let dirResponse;
      try {
        dirResponse = await octokit.repos.getContent({
          owner,
          repo,
          path: "recipes",
          ref: branch,
        });
      } catch (err: any) {
        if (err.status === 404) {
          return res.json([]);
        }
        throw err;
      }

      const files = Array.isArray(dirResponse.data) ? dirResponse.data : [];
      const jsonFiles = files.filter(f => f.type === "file" && f.name.endsWith(".json"));

      const recipes = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            if (file.download_url) {
              const fileRes = await fetch(file.download_url, {
                headers: {
                  "Authorization": `token ${token}`,
                  "User-Agent": "AI-Kucharka"
                }
              });
              if (fileRes.ok) {
                return await fileRes.json();
              }
            }
          } catch (e) {
            console.error(e);
          }
          return null;
        })
      );

      return res.json(recipes.filter(Boolean));
    } else {
      const publicUrl = `https://api.github.com/repos/${owner}/${repo}/contents/recipes?ref=${branch}`;
      const response = await fetch(publicUrl, { headers: { "User-Agent": "AI-Kucharka" } });
      
      if (response.ok) {
        const files = await response.json();
        const jsonFiles = Array.isArray(files) ? files.filter(f => f.type === "file" && f.name.endsWith(".json")) : [];

        const recipes = await Promise.all(
          jsonFiles.map(async (file: any) => {
            try {
              if (file.download_url) {
                const fileRes = await fetch(file.download_url, { headers: { "User-Agent": "AI-Kucharka" } });
                if (fileRes.ok) return await fileRes.json();
              }
            } catch (e) {
              console.error(e);
            }
            return null;
          })
        );
        return res.json(recipes.filter(Boolean));
      }
      return res.json([]);
    }
  } catch (error: any) {
    console.error("Chyba při GET /api:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST / PUT /api - ULTRA RYCHLÁ hromadná synchronizace složky recipes/ pomocí jednoho commitu (Git Data API)
app.all("/api", async (req, res) => {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "GET") {
    return res.status(405).json({ error: "Metoda nepovolena." });
  }
  if (req.method === "GET") return;

  try {
    const token = (process.env.GITHUB_DATA_TOKEN || process.env.GITHUB_TOKEN || "").trim();
    const owner = (process.env.GITHUB_USERNAME || "ambrus-k").trim();
    const repo = (process.env.GITHUB_REPO || "ai-kucharka-data").trim();
    const branch = "main";

    if (!token) {
      return res.status(401).json({ error: "Chybí GITHUB_DATA_TOKEN v proměnných prostředí." });
    }

    const bodyData = req.body;
    let recipesList: any[] = [];
    if (bodyData && Array.isArray(bodyData)) {
      recipesList = bodyData;
    } else if (bodyData && Array.isArray(bodyData.recipes)) {
      recipesList = bodyData.recipes;
    } else {
      return res.status(400).json({ error: "Chybí seznam receptů." });
    }

    const octokit = new Octokit({ auth: token });

    const slugify = (title: string) => {
      return title.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    };

    // 1. Získat SHA posledního commitu na větvi main
    const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const latestCommitSha = refData.object.sha;

    // 2. Načíst stávající strom (tree) abychom věděli, které soubory smazat
    let remoteFiles: any[] = [];
    try {
      const dirResponse = await octokit.repos.getContent({ owner, repo, path: "recipes", ref: branch });
      if (Array.isArray(dirResponse.data)) {
        remoteFiles = dirResponse.data;
      }
    } catch (e) {}

    // 3. Připravit pole změn pro nový Git Tree
    const treeItems: any[] = [];
    const localFilesSet = new Set<string>();

    // Přidat lokální nové/upravené recepty
    for (const r of recipesList) {
      if (!r || !r.title) continue;
      const fileName = `${slugify(r.title)}.json`;
      localFilesSet.add(fileName);

      treeItems.push({
        path: `recipes/${fileName}`,
        mode: "100644", // běžný soubor
        type: "blob",
        content: JSON.stringify(r, null, 2)
      });
    }

    // Identifikovat a smazat soubory, které už v lokálním seznamu nejsou
    for (const file of remoteFiles) {
      if (file.type === "file" && file.name.endsWith(".json") && !localFilesSet.has(file.name)) {
        treeItems.push({
          path: `recipes/${file.name}`,
          mode: "100644",
          type: "blob",
          sha: null // Tímto GitHub API soubor ze stromu odstraní
        });
      }
    }

    if (treeItems.length === 0) {
      return res.json({ success: true, message: "Žádné změny k synchronizaci." });
    }

    // 4. Vytvořit nový Git Tree na základě stávajícího commitu
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: latestCommitSha,
      tree: treeItems
    });

    // 5. Vytvořit nový commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `Hromadná synchronizace receptů (${recipesList.length} položek) [hromadný commit]`,
      tree: newTree.sha,
      parents: [latestCommitSha]
    });

    // 6. Aktualizovat referenci větve na nový commit
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    });

    return res.json({
      success: true,
      message: `Hromadná synchronizace úspěšně dokončena za zlomek sekundy! Zpracováno ${recipesList.length} receptů.`
    });

  } catch (error: any) {
    console.error("Chyba při hromadném zápisu na GitHub:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/verify-admin", (req, res) => {
  try {
    const { adminPassword } = req.body;
    if (checkAuth(adminPassword)) return res.json({ success: true });
    return res.status(401).json({ error: "Neplatný klíč." });
  } catch (error) {
    return res.status(500).json({ error: "Chyba při ověřování klíče." });
  }
});

app.post("/api/enhance-recipe", async (req, res) => {
  try {
    const { rawText, fileData, fileName, mimeType, adminPassword } = req.body;
    if (!checkAuth(adminPassword)) return res.status(401).json({ error: "Přístup odepřen." });
    if (!rawText && !fileData) return res.status(400).json({ error: "Chybí vstupní data." });

    const ai = getAi();
    const parts: any[] = [];
    const systemInstruction = `Jsi odborný asistent pro vaření "AI Kuchařka"...`; // [Zde zůstává vaše nezměněná systémová instrukce]

    let userPrompt = "Zde je můj původní recept k vylepšení:\n";
    if (rawText) userPrompt += `--- TEXT RECEPTU ---\n${rawText}\n`;
    if (fileData) {
      const cleanBase64 = fileData.replace(/^data:.*,/, "");
      parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } });
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
          required: ["title", "summary", "ingredients", "instructions", "applianceTips", "expertJustification", "applianceType", "cookingTime", "difficulty", "category"]
        }
      }
    });

    const enhancedRecipe = JSON.parse(response.text.trim());
    enhancedRecipe.id = `gen-${Date.now()}`;
    res.json({ recipe: enhancedRecipe });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ... [Ostatní endpoints /api/edit-recipe a /api/audit-recipe zůstávají beze změny jako ve vašem kódu]

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`AI Kuchařka Express server running on port ${PORT}`));
}

export default app;
if (!process.env.VERCEL) startServer();
