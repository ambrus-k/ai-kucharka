import { Octokit } from "@octokit/rest";

// Inicializace GitHub klienta pomocí proměnných prostředí na Vercelu
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const owner = process.env.GITHUB_USERNAME;
const repo = process.env.GITHUB_REPO || "ai-kucharka-data";
const path = "db.json";

export default async function handler(req, res) {
  // Povolení CORS pro frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Pouhý test funkčnosti API pro administrátora (/api/verify-admin)
  if (req.url.includes('verify-admin')) {
    return res.status(200).json({ status: "success", message: "Authenticated via Vercel" });
  }

  try {
    // 1. ČTENÍ DAT (GET) - Stáhne db.json z GitHubu
    if (req.method === 'GET') {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return res.status(200).json(JSON.parse(content));
      } catch (err) {
        if (err.status === 404) {
          // Pokud db.json neexistuje, vrátíme prázdnou strukturu kuchařky
          return res.status(200).json({ recipes: [] });
        }
        throw err;
      }
    }

    // 2. ZÁPIS DAT (POST) - Uloží nová data do db.json na GitHub
    if (req.method === 'POST') {
      let sha;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        sha = data.sha; // Potřebujeme SHA souboru pro aktualizaci
      } catch (err) {
        // Soubor ještě neexistuje, SHA zůstane undefined (vytvoří se nový)
      }

      const contentStr = JSON.stringify(req.body, null, 2);
      const contentBase64 = Buffer.from(contentStr).toString('base64');

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: 'Aktualizace receptů z AI Kuchařky',
        content: contentBase64,
        sha
      });

      return res.status(200).json({ status: "success", message: "Data saved to GitHub" });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
