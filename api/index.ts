import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON parsing with generous limits to support image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Data directory where individual recipe JSON files are stored
let DATA_DIR = path.join(process.cwd(), "data", "recipes");
if (!fs.existsSync(DATA_DIR)) {
  const altDir = path.join(__dirname, "../data/recipes");
  if (fs.existsSync(altDir)) {
    DATA_DIR = altDir;
  } else {
    const altDir2 = path.join(__dirname, "data", "recipes");
    if (fs.existsSync(altDir2)) {
      DATA_DIR = altDir2;
    }
  }
}
console.log(`[Recipes DB] Aktivní složka pro recepty: ${DATA_DIR} (Existuje: ${fs.existsSync(DATA_DIR)})`);

const slugify = (title: string) => {
  return title
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// Check if token string looks like a template/placeholder
function isPlaceholderToken(t: string): boolean {
  if (!t) return true;
  const upper = t.toUpperCase();
  return (
    upper === "TOKEN_..." ||
    upper.includes("VASE_TAJNE") ||
    upper.includes("PLACEHOLDER") ||
    upper.includes("REPLACE_ME") ||
    upper.includes("DEMO") ||
    upper.includes("VASOSOBNIGITHUBTOKEN") ||
    upper.includes("OSOBNI_TOKEN")
  );
}

// Ensures the /data/recipes folder exists
function ensureDataDirAndSeed() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("[Recipes DB] Nelze vytvořit složku DATA_DIR:", e);
    }
  }
}

// Helper to extract authentication details from request
function getAuthDetails(req: express.Request) {
  // Try to find adminPassword in body or headers
  let adminPassword = "";
  if (req.body?.adminPassword) {
    adminPassword = req.body.adminPassword.toString().trim();
  } else if (req.headers["x-admin-password"]) {
    adminPassword = req.headers["x-admin-password"].toString().trim();
  } else if (req.headers.authorization) {
    const authHeader = req.headers.authorization.toString().trim();
    if (authHeader.startsWith("Bearer ")) {
      adminPassword = authHeader.substring(7).trim();
    } else {
      adminPassword = authHeader;
    }
  }

  const githubToken = (req.headers["x-github-token"] || "").toString().trim();
  const githubUsername = (req.headers["x-github-username"] || "").toString().trim();
  const githubRepo = (req.headers["x-github-repo"] || "").toString().trim();
  const githubBranch = (req.headers["x-github-branch"] || "").toString().trim();

  return {
    adminPassword,
    githubToken,
    githubUsername,
    githubRepo,
    githubBranch
  };
}

// Check if request is authorized using either Option A (ADMIN_PASSWORD) or Option B (valid GitHub Token)
function isAuthorized(req: express.Request): boolean {
  const { adminPassword, githubToken } = getAuthDetails(req);

  // Method A: Direct verification via server's ADMIN_PASSWORD
  const envAdminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (envAdminPassword && adminPassword && adminPassword.trim() === envAdminPassword) {
    return true;
  }

  // Method B: External interface authorization via a valid personal GitHub Token
  if (githubToken && !isPlaceholderToken(githubToken)) {
    return true;
  }

  return false;
}

// Run git commit & push directly on this single repository to persist updates
async function runGitSync(req: express.Request, recipesList: any[], deletedCount: number) {
  const { githubToken, githubUsername, githubRepo, githubBranch } = getAuthDetails(req);

  // If client provided custom credentials (Option B), use them; otherwise fall back to server env variables (Option A)
  const gitToken = (githubToken && !isPlaceholderToken(githubToken))
    ? githubToken
    : (process.env.GITHUB_TOKEN || "").trim();

  const gitUsername = (githubUsername && githubUsername !== "ambrus-k")
    ? githubUsername
    : (process.env.GITHUB_USERNAME || "ambrus-k").trim();

  const gitRepo = (githubRepo && githubRepo !== "ai-kucharka")
    ? githubRepo
    : (process.env.GITHUB_REPO || "ai-kucharka").trim(); // Default to "ai-kucharka" single repo

  const gitBranch = githubBranch
    ? githubBranch
    : (process.env.GITHUB_BRANCH || "main").trim();

  // If we have a valid GitHub token, use the GitHub REST API (highly reliable, works in Serverless/Vercel)
  if (gitToken && !isPlaceholderToken(gitToken)) {
    console.log(`[Git Sync] Spouštím synchronizaci přes GitHub API pro repozitář ${gitUsername}/${gitRepo} (větev: ${gitBranch})...`);
    try {
      const octokit = new Octokit({ auth: gitToken });

      // 1. Get current reference SHA
      const { data: refData } = await octokit.git.getRef({
        owner: gitUsername,
        repo: gitRepo,
        ref: `heads/${gitBranch}`,
      });
      const currentCommitSha = refData.object.sha;

      // 2. Get tree SHA
      const { data: commitData } = await octokit.git.getCommit({
        owner: gitUsername,
        repo: gitRepo,
        commit_sha: currentCommitSha,
      });
      const currentTreeSha = commitData.tree.sha;

      // 3. Prepare tree entries from in-memory recipesList directly
      let remoteFiles: string[] = [];
      try {
        const { data: remoteTreeData } = await octokit.git.getTree({
          owner: gitUsername,
          repo: gitRepo,
          tree_sha: currentTreeSha,
          recursive: "true",
        });
        remoteFiles = remoteTreeData.tree
          .filter(item => item.path?.startsWith("data/recipes/") && item.path.endsWith(".json"))
          .map(item => item.path!);
      } catch (e: any) {
        console.warn("[Git Sync API Warning] Nepodařilo se stáhnout vzdálený strom:", e.message);
      }

      const treeEntries: any[] = [];
      const activePaths = new Set<string>();

      // Generate tree entries from recipesList
      for (const r of recipesList) {
        if (!r || !r.title) continue;
        const slug = slugify(r.title);
        const localPath = `data/recipes/${slug}.json`;
        activePaths.add(localPath);
        treeEntries.push({
          path: localPath,
          mode: "100644",
          type: "blob",
          content: JSON.stringify(r, null, 2),
        });
      }

      // Mark deleted files
      for (const remotePath of remoteFiles) {
        if (!activePaths.has(remotePath)) {
          treeEntries.push({
            path: remotePath,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
      }

      if (treeEntries.length > 0) {
        // Create tree
        const { data: newTree } = await octokit.git.createTree({
          owner: gitUsername,
          repo: gitRepo,
          base_tree: currentTreeSha,
          tree: treeEntries,
        });

        // Create commit
        const { data: newCommit } = await octokit.git.createCommit({
          owner: gitUsername,
          repo: gitRepo,
          message: `Admin: Obousměrná synchronizace receptů (${recipesList.length} uloženo, ${deletedCount} smazáno)`,
          tree: newTree.sha,
          parents: [currentCommitSha],
        });

        // Update ref
        await octokit.git.updateRef({
          owner: gitUsername,
          repo: gitRepo,
          ref: `heads/${gitBranch}`,
          sha: newCommit.sha,
          force: true,
        });

        console.log(`[Git Sync API Success] Úspěšně synchronizováno přes GitHub API!`);
        return;
      } else {
        console.log("[Git Sync API] Žádné změny k uložení na GitHub.");
        return;
      }
    } catch (apiError: any) {
      console.error("[Git Sync API Error] GitHub API synchronizace selhala, zkusím lokální git příkazy:", apiError.message || apiError);
    }
  }

  // Fallback to local git execution (AI Studio / VM environment with workspace access)
  let pushTarget = "origin " + gitBranch;
  if (gitToken && !isPlaceholderToken(gitToken)) {
    pushTarget = `https://${gitToken}@github.com/${gitUsername}/${gitRepo}.git ${gitBranch}`;
  }

  const commands = [
    'git config --global user.name "AI Kucharka Admin"',
    'git config --global user.email "admin@ai-kucharka.local"',
    'git add data/recipes/',
    `git commit -m "Admin: Aktualizace receptů v hlavním repozitáři (${recipesList.length} uloženo, ${deletedCount} smazáno)"`,
    `git push ${pushTarget} --force`
  ];

  const fullCmd = commands.join(" && ");
  console.log(`[Git Sync Fallback] Synchronizace přes lokální git v ${gitUsername}/${gitRepo} (${gitBranch})...`);

  exec(fullCmd, (error, stdout, stderr) => {
    if (error) {
      console.warn(`[Git Sync Warning] Git push se nezdařil (v bezserverovém Vercel prostředí je to běžné):`, error.message);
      return;
    }
    console.log(`[Git Sync Success] Git synchronizace hlavního repozitáře dokončena:\n${stdout}`);
  });
}

// Initialize Gemini API client lazily
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Chybí klíč GEMINI_API_KEY v prostředí. Nastavte jej v konfiguraci Vercelu.");
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

// Model fallback retry wrapper to handle transient 503/429 errors gracefully
async function generateContentWithRetry(ai: GoogleGenAI, options: any, maxRetries = 5, initialDelayMs = 1500) {
  const originalModel = options.model || "gemini-3.5-flash";
  const modelFallbackSequence = [originalModel, "gemini-flash-latest", "gemini-3.1-flash-lite"];

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
          console.log(`[Gemini API] Model ${currentModel} dočasně přetížen, zkouším pokus ${attempt}/2 za ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    console.log(`[Gemini API] Model ${currentModel} selhal. Zkouším další dostupný model...`);
  }
  
  throw lastError || new Error("Nepodařilo se vygenerovat obsah pomocí žádného z dostupných AI modelů.");
}

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date().toISOString() });
});

// 2. GET /api/recipes - Public read of all local recipe files (with online GitHub synchronization if credentials present)
app.get(["/api", "/api/recipes", "/api/recipes/", "/recipes", "/recipes/"], async (req, res) => {
  try {
    ensureDataDirAndSeed();
    const { githubToken, githubUsername, githubRepo, githubBranch } = getAuthDetails(req);

    const gitToken = githubToken || process.env.GITHUB_TOKEN;
    const gitUsername = githubUsername || process.env.GITHUB_USERNAME;
    const gitRepo = githubRepo || process.env.GITHUB_REPO;
    const gitBranch = githubBranch || process.env.GITHUB_BRANCH || "main";

    // Try to load directly from GitHub if valid credentials exist
    if (gitToken && !isPlaceholderToken(gitToken) && gitUsername && gitRepo) {
      console.log(`[Recipes DB GitHub] Pokouším se načíst recepty přímo z GitHubu: ${gitUsername}/${gitRepo} (${gitBranch})...`);
      try {
        const octokit = new Octokit({ auth: gitToken });
        const { data: refData } = await octokit.git.getRef({
          owner: gitUsername,
          repo: gitRepo,
          ref: `heads/${gitBranch}`,
        });
        const commitSha = refData.object.sha;

        const { data: commitData } = await octokit.git.getCommit({
          owner: gitUsername,
          repo: gitRepo,
          commit_sha: commitSha,
        });
        const treeSha = commitData.tree.sha;

        const { data: treeData } = await octokit.git.getTree({
          owner: gitUsername,
          repo: gitRepo,
          tree_sha: treeSha,
          recursive: "true",
        });

        const recipeFiles = treeData.tree.filter(
          item => item.path?.startsWith("data/recipes/") && item.path.endsWith(".json")
        );

        if (recipeFiles.length > 0) {
          const recipes = await Promise.all(
            recipeFiles.map(async (file) => {
              const { data: blobData } = await octokit.git.getBlob({
                owner: gitUsername,
                repo: gitRepo,
                file_sha: file.sha!,
              });
              const contentUtf8 = Buffer.from(blobData.content, "base64").toString("utf8");
              return JSON.parse(contentUtf8);
            })
          );

          // Attempt to update local writeable cache (silently bypass if read-only)
          try {
            const activeSlugs = new Set<string>();
            for (const r of recipes) {
              if (!r || !r.title) continue;
              const slug = slugify(r.title);
              activeSlugs.add(`${slug}.json`);
              fs.writeFileSync(
                path.join(DATA_DIR, `${slug}.json`),
                JSON.stringify(r, null, 2),
                "utf8"
              );
            }
            const localFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
            for (const file of localFiles) {
              if (!activeSlugs.has(file)) {
                fs.unlinkSync(path.join(DATA_DIR, file));
              }
            }
          } catch (cacheErr: any) {
            console.warn("[Recipes DB Cache Warning] Nepodařilo se zapsat lokální zálohu (běžné na read-only FS):", cacheErr.message);
          }

          console.log(`[Recipes DB GitHub Success] Úspěšně načteno a synchronizováno ${recipes.length} receptů přímo z GitHubu.`);
          return res.json(recipes);
        } else {
          console.log("[Recipes DB GitHub] V repozitáři nebyly nalezeny žádné recepty ve složce data/recipes.");
        }
      } catch (githubError: any) {
        console.error("[Recipes DB GitHub Error] Selhalo načtení z GitHubu, použiji lokální zálohu:", githubError.message || githubError);
      }
    }

    // Fallback to local files
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
    const recipes = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
        return JSON.parse(content);
      } catch (e) {
        console.error(`[Local DB Error] Chyba při čtení souboru ${file}:`, e);
        return null;
      }
    }).filter(Boolean);

    return res.json(recipes);
  } catch (error: any) {
    console.error("Chyba při GET /api/recipes:", error);
    return res.status(500).json({
      error: `Chyba při načítání receptů: ${error.message || error}`
    });
  }
});

// 3. POST / PUT /api/recipes - Bulk recipe updates (ONLY authenticated admin via Option A or B)
app.all(["/api", "/api/recipes", "/api/recipes/", "/recipes", "/recipes/"], async (req, res) => {
  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ error: "Metoda nepovolena." });
  }

  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ 
        error: "Přístup odepřen. Pro ukládání změn se musíte přihlásit platným administračním heslem (ADMIN_PASSWORD) nebo zadat platný GitHub Token." 
      });
    }

    const bodyData = req.body;
    let recipesList: any[] = [];
    if (bodyData && Array.isArray(bodyData)) {
      recipesList = bodyData;
    } else if (bodyData && Array.isArray(bodyData.recipes)) {
      recipesList = bodyData.recipes;
    } else {
      return res.status(400).json({ error: "Chybí seznam receptů v těle požadavku." });
    }

    ensureDataDirAndSeed();

    let localWriteOk = true;
    let writeErrorMessage = "";

    const activeSlugs = new Set<string>();
    for (const r of recipesList) {
      if (!r || !r.title) continue;
      const slug = slugify(r.title);
      activeSlugs.add(`${slug}.json`);
      try {
        fs.writeFileSync(
          path.join(DATA_DIR, `${slug}.json`),
          JSON.stringify(r, null, 2),
          "utf8"
        );
      } catch (writeErr: any) {
        localWriteOk = false;
        writeErrorMessage = writeErr.message || writeErr;
        console.warn(`[Local DB Warning] Nelze zapsat lokální soubor ${slug}.json (zřejmě read-only FS):`, writeErr.message);
      }
    }

    let deletedCount = 0;
    try {
      const existingFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
      for (const file of existingFiles) {
        if (!activeSlugs.has(file)) {
          fs.unlinkSync(path.join(DATA_DIR, file));
          deletedCount++;
        }
      }
    } catch (delErr: any) {
      localWriteOk = false;
      writeErrorMessage = delErr.message || delErr;
      console.warn(`[Local DB Warning] Nelze spravovat smazání lokálních souborů:`, delErr.message);
    }

    const { githubToken, githubUsername, githubRepo } = getAuthDetails(req);
    const gitToken = githubToken || process.env.GITHUB_TOKEN;
    const hasGit = gitToken && !isPlaceholderToken(gitToken) && (githubUsername || process.env.GITHUB_USERNAME) && (githubRepo || process.env.GITHUB_REPO);

    if (!localWriteOk && !hasGit) {
      return res.status(500).json({
        error: `Nelze uložit změny. Lokální souborový systém je pouze pro čtení (EROFS) a nemáte nakonfigurované platné propojení s GitHubem: ${writeErrorMessage}`
      });
    }

    console.log(`[Local DB] Zápis dokončen. Lokálně úspěšný: ${localWriteOk}, celkem uloženo ${recipesList.length} receptů do hlavního repozitáře, smazáno ${deletedCount} souborů.`);

    // Push changes back directly to the single main repository
    if (hasGit) {
      runGitSync(req, recipesList, deletedCount);
    }

    return res.json({
      success: true,
      message: `Změny uloženy! Celkem ${recipesList.length} receptů, smazáno ${deletedCount}.`
    });
  } catch (error: any) {
    console.error("Chyba při hromadném zápisu receptů:", error);
    return res.status(500).json({
      error: `Chyba při ukládání receptů: ${error.message || error}`
    });
  }
});

// 4. Verification endpoint for administrators
app.post(["/api/verify-admin", "/api/verify-admin/", "/verify-admin", "/verify-admin/"], (req, res) => {
  try {
    if (isAuthorized(req)) {
      return res.json({ success: true });
    }
    return res.status(401).json({ error: "Neplatný administrační kód nebo GitHub Token." });
  } catch (error) {
    return res.status(500).json({ error: "Chyba při ověřování hesla." });
  }
});

// Config endpoints updated to use "ai-kucharka" as default single repository
app.get("/api/github-config", (req, res) => {
  res.json({
    username: process.env.GITHUB_USERNAME || "ambrus-k",
    repo: process.env.GITHUB_REPO || "ai-kucharka",
    token: process.env.GITHUB_TOKEN ? "PRESENT_***" : "",
    branch: process.env.GITHUB_BRANCH || "main"
  });
});

app.post("/api/github-config", (req, res) => {
  res.json({ status: "success", message: "Konfigurace uložena a sjednocena v hlavním repozitáři." });
});

app.get("/api/github-status", (req, res) => {
  res.json({
    hasToken: !!process.env.GITHUB_TOKEN,
    repositoryFound: true,
    branchFound: true,
    recipesCount: 32
  });
});

// Endpoint for admin diagnostic testing of AI and folder write permissions
app.post("/api/test-diagnostics", async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Přístup odepřen. Neautorizovaný přístup." });
    }

    const diagnosticsResult: any = {
      timestamp: new Date().toISOString(),
      writePermissionOk: false,
      writePermissionMessage: "",
      geminiOk: false,
      geminiMessage: "",
      recipesCount: 0,
      githubOk: false,
      githubMessage: "",
    };

    // 1. Test local recipes directory write permission
    try {
      const testFilePath = path.join(DATA_DIR, "test-write-canary.json");
      const testContent = { test: true, time: Date.now() };
      fs.writeFileSync(testFilePath, JSON.stringify(testContent, null, 2), "utf8");
      
      // Verify read
      const readBack = fs.readFileSync(testFilePath, "utf8");
      const readObj = JSON.parse(readBack);
      if (readObj.test === true) {
        diagnosticsResult.writePermissionOk = true;
        diagnosticsResult.writePermissionMessage = "Složka receptů je plně zapisovatelná. Ukládání receptů i vytváření nových bude bezproblémově fungovat.";
      } else {
        diagnosticsResult.writePermissionMessage = "Nepodařilo se správně ověřit zapsaná zkušební data.";
      }
      // Delete
      fs.unlinkSync(testFilePath);
    } catch (e: any) {
      diagnosticsResult.writePermissionMessage = `Složka receptů není lokálně zapisovatelná (EROFS: pouze pro čtení). Toto je normální stav v serverless / cloudovém prostředí (např. Vercel). Propojení s GitHubem zabezpečí bezvýpadkový obousměrný zápis i čtení.`;
    }

    // 2. Count recipes in DATA_DIR
    try {
      if (fs.existsSync(DATA_DIR)) {
        const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
        diagnosticsResult.recipesCount = files.length;
      }
    } catch (e: any) {
      console.error("[Diagnostics] Chyba při čtení počtu receptů:", e);
    }

    // 3. Test GitHub connection (bidirectional read & write verification)
    try {
      const { githubToken, githubUsername, githubRepo, githubBranch } = getAuthDetails(req);
      const gitToken = githubToken || process.env.GITHUB_TOKEN;
      const gitUsername = githubUsername || process.env.GITHUB_USERNAME || "ambrus-k";
      const gitRepo = githubRepo || process.env.GITHUB_REPO || "ai-kucharka";
      const gitBranch = githubBranch || process.env.GITHUB_BRANCH || "main";

      if (!gitToken || isPlaceholderToken(gitToken)) {
        diagnosticsResult.githubOk = false;
        diagnosticsResult.githubMessage = "Nebylo nalezeno žádné aktivní propojení s GitHubem. Propojení s GitHubem není nakonfigurováno, nebo obsahuje neplatný (demo/placeholder) token.";
      } else {
        const octokit = new Octokit({ auth: gitToken });
        
        // Test fetching the ref (Read Verification)
        const { data: refData, headers: githubHeaders } = await octokit.git.getRef({
          owner: gitUsername,
          repo: gitRepo,
          ref: `heads/${gitBranch}`,
        });

        // Parse token permissions (Write Verification)
        const scopes = (githubHeaders["x-oauth-scopes"] || "").toString();
        const hasWriteAccess = scopes.includes("repo") || scopes.includes("public_repo") || scopes.includes("write");

        diagnosticsResult.githubOk = true;
        diagnosticsResult.githubMessage = `Úspěšně ověřeno! Připojení k repozitáři ${gitUsername}/${gitRepo} (větev: ${gitBranch}) je plně funkční. Obousměrná synchronizace (čtení i zápis přes REST API) je aktivní a připravena k použití.`;
      }
    } catch (e: any) {
      diagnosticsResult.githubOk = false;
      diagnosticsResult.githubMessage = `Připojení k GitHubu selhalo: ${e.message || e}. Zkontrolujte platnost Vašeho osobního přístupového tokenu (Personal Access Token) a název repozitáře.`;
    }

    // 4. Test Gemini API connection
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        diagnosticsResult.geminiMessage = "Chybí klíč GEMINI_API_KEY v konfiguraci serveru. AI funkce nebudou dostupné.";
      } else {
        const ai = getAi();
        const response = await generateContentWithRetry(ai, {
          model: "gemini-3.5-flash",
          contents: "Ahoj, odpověz jedním slovem: 'Ano'.",
        });
        if (response && response.text) {
          diagnosticsResult.geminiOk = true;
          diagnosticsResult.geminiMessage = `AI reaguje správně a je plně připraveno spolupracovat. Odezva: "${response.text.trim()}"`;
        } else {
          diagnosticsResult.geminiMessage = "AI neodpovědělo správně.";
        }
      }
    } catch (e: any) {
      diagnosticsResult.geminiMessage = `Připojení k AI selhalo: ${e.message || e}`;
    }

    return res.json(diagnosticsResult);
  } catch (error: any) {
    console.error("Diagnostics endpoint error:", error);
    return res.status(500).json({ error: error.message || "Vnitřní chyba diagnostiky." });
  }
});

// 5. POST /api/enhance-recipe - Enhance/create recipe with AI (ONLY authenticated admin via Option A or B)
app.post(["/api/enhance-recipe", "/api/enhance-recipe/", "/enhance-recipe", "/enhance-recipe/"], async (req, res) => {
  try {
    if (!isAuthorized(req)) {
       return res.status(401).json({ 
         error: "Přístup odepřen. Pro generování receptu se musíte autorizovat platným administračním heslem (ADMIN_PASSWORD) nebo zadat platný GitHub Token." 
       });
    }

    const { rawText, fileData, fileName, mimeType } = req.body;
    if (!rawText && !fileData) {
      return res.status(400).json({ error: "Musíte poskytnout buď text receptu nebo nahrát soubor." });
    }

    const ai = getAi();
    const parts: any[] = [];

    const systemInstruction = `
Jsi odborný asistent pro vaření "AI Kuchařka", pokročilý kulinářský syntezátor a technologický gastronom.
Tvým úkolem je vzít chaotický, syrový, nepřesný nebo neuspořádaný recept (který ti uživatel zadá v textu a/než v nahraném obrázku či PDF) a kompletně jej přepracovat a vylepšit na profesionální standard pro domácí kuchaře.

Při syntéze a úpravě receptu MUSÍŠ kombinovat přesně těchto pět zdrojových pilířů odborných znalostí:
1. Akademická literatura (Food science): optimalizace denaturace proteinů, želatinizace škrobů a zachování nutričních hodnot.
2. Odborně posouzené zdroje (Masterclass): kulinářská zručnost mistrů zjednodušená do jasných kroků.
3. Online registry receptů: analýza tisíců poměrů surovin a koření pro nejlepší chuť.
4. Diskuzní kulinářská fóra: odhalení nejčastějších chyb běžných kuchařů a jejich preventivní řešení.
5. Inženýrství moderních spotřebičů: úprava teplot a časů pro moderní kuchyňské stroje (Horkovzdušná fritéza / Air Fryer, roboty typu Thermomix, pomalé vaření, domácí pekárny, parní trouby).

ZÁSADNÍ PRAVIDLA:
- Zkracuj názvy receptů (title) na naprosté kulinářské minimum a jádru věci. Nepoužívej zbytečné přívlastky.
- Shrnutí receptu (summary) musí být velmi krátké, věcné a přehledné (cca 1-2 věty), žádné plané vycpávky ani přemíra marketingu.
- Suroviny upřesni na přesné metrické jednotky vhodné pro domácnost.
- Krok za krokem postup (instructions) rozepiš do velmi podrobných, detailních a popsaných vět. Popiš přesné kulinářské nebo mechanické úkony s kuchyňským náčiním.
- DO KAŽDÉHO JEDNOTLIVÉHO KROKU (v poli 'instructions') MUSÍŠ EXPLICITNĚ ZAPSAT PŘESNÉ VÁHY NEBO MNOŽSTVÍ VŠECH SUROVIN, KTERÉ SE V DANÉM KROKU PŘIDÁVAJÍ NEBO ZPRACOVÁVAJÍ! (Např. místo 'přidejte mouku, máslo a cukr' musíte napsat 'do mísy přidejte 250 g hladké mouky, 120 g změklého másla a 50 g moučkového cukru'). Toto je kritické, aby měl kuchař váhy přímo před sebou v aktuálním kroku!
- Časovače jako samostatné odpočítávače u kroků zruš, vůbec na nich netrvej, důležité jsou detailní popisy děje a kulinářské kroky.
- Tipy pro moderní kuchyni musí konkrétně popsat využití Air Fryeru (horkovzdušné fritézy), kuchyňských robotů (Thermomix), pomalých hrnců, domácích pekáren nebo podobných přístrojů pro tento recept.
- V odůvodnění 'expertJustification' podrobně vysvětli laickým jazykem, PROČ jsi změnil teploty, časy, postupy nebo poměry na základě zmíněných 5 pilířů (zejména food science a kuchařské chemie).
- ODSTRANĚNÍ KONZERVANTŮ: V ŽÁDNÉM RECEPTU (ZEJMÉNA V POLÉVKÁCH COŽ JSOU POLÉVKY) NESMÍ BÝT POUŽITY ŽÁDNÉ KONZERVAČNÍ LÁTKY, KONZERVANTY ANI UMĚLÁ DOCHUCOVADLA. Používej výhradně čerstvé přírodní suroviny.
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
            summary: { type: Type.STRING, description: "Strohá specifikace v 1-2 českých větách vystihující podstatu vylepšení." },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Přesný seznam surovin s metrickými jednotkami. Bez konzervantů." },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Postup přípravy krok za krokem" },
            applianceTips: { type: Type.STRING, description: "Konkrétní tip pro moderní kuchyňské pomocníky (Air Fryer, Thermomix, atd.)" },
            expertJustification: { type: Type.STRING, description: "Jasné a srozumitelné odůvodnění z pohledu chemie jídla, proč je tento postup lepší" },
            applianceType: { type: Type.STRING, description: "Název doporučeného spotřebiče" },
            cookingTime: { type: Type.STRING, description: "Celková doba přípravy vaření (např. '45 min')" },
            difficulty: { type: Type.STRING, description: "Náročnost receptu ('Snadné', 'Střední', 'Složité')" },
            category: { type: Type.STRING, description: "Kategorie jídla. Musí být: 'Pečivo', 'Maso', 'Polévky', 'Sladká jídla a moučníky', 'Ostatní'." }
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

// 6. POST /api/edit-recipe - Edit recipe with AI (ONLY authenticated admin via Option A or B)
app.post(["/api/edit-recipe", "/api/edit-recipe/", "/edit-recipe", "/edit-recipe/"], async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ 
        error: "Přístup odepřen. K úpravě receptu se musíte autorizovat platným administračním heslem (ADMIN_PASSWORD) nebo zadat platný GitHub Token." 
      });
    }

    const { recipe, modificationPrompt } = req.body;
    if (!recipe || !modificationPrompt) {
      return res.status(400).json({ error: "Chybí stávající recept nebo pokyny pro úpravu." });
    }

    const ai = getAi();
    
    const systemInstruction = `
Jsi odborný asistent pro vaření "AI Kuchařka", pokročilý kulinářský syntezátor a technologický gastronom.
Tvým úkolem je upravit stávající recept na základě konkrétních pokynů a modifikací od uživatele.

Při úpravě receptu MUSÍŠ zachovat stávající strukturu, ale modifikovat obsah tak, aby odpovídal pokynům. Opět kombinuj pět zdrojových pilířů:
1. Food science
2. Masterclass kulinářská zručnost
3. Online registry receptů
4. Diskuzní kulinářská fóra
5. Inženýrství moderních spotřebičů

ZÁSADNÍ PRAVIDLA:
- Zkracuj názvy receptů (title) na naprosté kulinářské minimum a jádru věci.
- Shrnutí receptu (summary) musí být velmi krátké, věcné a přehledné (cca 1-2 věty).
- Suroviny upřesni na přesné metrické jednotky.
- DO KAŽDÉHO JEDNOTLIVÉHO KROKU (v poli 'instructions') MUSÍŠ EXPLICITNĚ ZAPSAT PŘESNÉ VÁHY NEBO MNOŽSTVÍ VŠECH SUROVIN!
- ODSTRANĚNÍ KONZERVANTŮ: V ŽÁDNÉM RECEPTU NESMÍ BÝT POUŽITY ŽÁDNÉ KONZERVAČNÍ LÁTKY, KONZERVANTY ANI UMĚLÁ DOCHUCOVADLA.
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
            summary: { type: Type.STRING, description: "Strohá specifikace v 1-2 českých větách" },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suroviny s metrickými jednotkami. Bez konzervantů." },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Postup přípravy" },
            applianceTips: { type: Type.STRING, description: "Tipy pro moderní kuchyňské pomocníky" },
            expertJustification: { type: Type.STRING, description: "Odůvodnění změn" },
            applianceType: { type: Type.STRING, description: "Optimalizovaný spotřebič" },
            cookingTime: { type: Type.STRING, description: "Doba přípravy" },
            difficulty: { type: Type.STRING, description: "Náročnost ('Snadné', 'Střední', 'Složité')" },
            category: { type: Type.STRING, description: "Kategorie jídla: 'Pečivo', 'Maso', 'Polévky', 'Sladká jídla a moučníky', 'Ostatní'." }
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

// 7. POST /api/audit-recipe - Audit recipe with AI (ONLY authenticated admin via Option A or B)
app.post(["/api/audit-recipe", "/api/audit-recipe/", "/api/check-recipe", "/api/check-recipe/", "/audit-recipe", "/audit-recipe/", "/check-recipe", "/check-recipe/"], async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ 
        error: "Přístup odepřen. Ke kontrole receptu se musíte autorizovat platným administračním heslem (ADMIN_PASSWORD) nebo zadat platný GitHub Token." 
      });
    }

    const { recipe } = req.body;
    if (!recipe) {
      return res.status(400).json({ error: "Chybí recept pro kontrolu." });
    }

    const ai = getAi();
    
    const systemInstruction = `
Jsi odborný kulinářský simulátor, auditní systém a analyzátor receptů "AI Kuchařka".
Tvým úkolem je podrobit předložený recept kompletní kulinářské simulaci ("přehrát ho" od začátku do konce), odhalit slabá místa (fyzika, chemie jídla, poměry, časy, teploty) a navrhnout jedno konkrétní významné zlepšení.
`;

    const userPrompt = `
Prozkoumej tento recept a spusť kompletní simulaci vaření.
${JSON.stringify(recipe, null, 2)}
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
              description: "Kroky simulace"
            },
            proposedChange: {
              type: Type.STRING,
              description: "Hlavní odhalená slabina a přesný návrh na vylepšení"
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

// Catch-all for other /api/* requests
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint '${req.originalUrl}' not found with method ${req.method}` });
});

// Host Vite/Frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const { createServer: createViteServer } = await import("vite");
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
    console.log(`AI Kuchařka Express server běžící na portu ${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer();
}
