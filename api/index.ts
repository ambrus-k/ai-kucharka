import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers Setup
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle CORS OPTIONS preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";
  const parsedUrl = new URL(url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // 1. Endpoint: /api/verify-admin
  if (pathname === "/api/verify-admin" || pathname === "/verify-admin") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metoda nepovolena. Použijte POST." });
    }

    // Support ADMIN_PASSWORD check if configured on Vercel
    const envAdminPassword = process.env.ADMIN_PASSWORD;
    const { adminPassword } = req.body || {};

    if (envAdminPassword && envAdminPassword.trim() !== "") {
      if (!adminPassword || adminPassword.trim() !== envAdminPassword.trim()) {
        return res.status(401).json({ error: "Neplatný kulinářský API klíč." });
      }
    }

    return res.status(200).json({ success: true, status: "success" });
  }

  // 2. Integration with GitHub API via environment variables
  const token = process.env.GITHUB_TOKEN || "";
  const owner = process.env.GITHUB_USERNAME || "karelaa";
  const repo = process.env.GITHUB_REPO || "ai-kucharka-data";
  const path = "db.json";

  if (!token) {
    return res.status(500).json({
      error: "Chybí GITHUB_TOKEN v proměnných prostředí. Nastavte ho ve Vercel Dashboardu."
    });
  }

  const octokit = new Octokit({ auth: token });

  // 3. GET Request: Read db.json from GitHub and parse/return its content
  if (req.method === "GET") {
    try {
      const fileResponse = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: "main"
      });

      if (!Array.isArray(fileResponse.data) && "content" in fileResponse.data) {
        const content = Buffer.from(fileResponse.data.content, "base64").toString("utf-8");
        try {
          const json = JSON.parse(content);
          return res.status(200).json(json);
        } catch (parseErr) {
          return res.status(500).json({ error: "Chyba při parsování souboru db.json z GitHubu." });
        }
      } else {
        return res.status(400).json({ error: "Soubor db.json má neplatný formát v repozitáři." });
      }
    } catch (error: any) {
      if (error.status === 404) {
        // Return default empty structure if file does not exist yet
        return res.status(200).json({ recipes: [] });
      }
      return res.status(500).json({
        error: `Chyba při komunikaci s GitHub API: ${error.message || error}`
      });
    }
  }

  // 4. POST/PUT Request: Update db.json on GitHub
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const bodyData = req.body;
      if (!bodyData) {
        return res.status(400).json({ error: "Chybí tělo požadavku s daty." });
      }

      // Convert data to JSON string
      const content = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData, null, 2);
      const contentBytes = Buffer.from(content, "utf-8");
      const contentBase64 = contentBytes.toString("base64");

      // Retrieve existing sha if file exists
      let sha: string | undefined;
      try {
        const existingResponse = await octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: "main"
        });
        if (!Array.isArray(existingResponse.data) && "sha" in existingResponse.data) {
          sha = existingResponse.data.sha;
        }
      } catch (err: any) {
        if (err.status !== 404) {
          throw err;
        }
      }

      // Overwrite/Create file in GitHub repository
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: "Aktualizace kuchařky db.json z Vercel Serverless API [auto-sync]",
        content: contentBase64,
        sha,
        branch: "main"
      });

      return res.status(200).json({
        success: true,
        status: "success",
        message: "Kuchařka db.json byla úspěšně nahrána a uložena na GitHub!"
      });
    } catch (error: any) {
      return res.status(500).json({
        error: `Chyba při zápisu do GitHub repozitáře: ${error.message || error}`
      });
    }
  }

  return res.status(404).json({ error: "Endpoint nebo metoda nebyly nalezeny." });
}
