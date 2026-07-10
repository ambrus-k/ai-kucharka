# Návod: Jak propojit AI Kuchařku s GitHubem na Vercelu

Tento návod vysvětluje, proč dříve připojení k vašemu vlastnímu repozitáři **`ai-kucharka-data`** po nasazení na Vercel selhávalo, jak jsme tento problém trvale opravili v kódu a jak můžete provést případnou další konfiguraci.

---

## 🔍 Kde byl problém?

1. **Bezstavovost Vercel Serverless funkcí:**
   Vercel spouští serverový kód jako tzv. *serverless lambdy*. Když jste v nastavení aplikace klikli na „Uložit nastavení GitHubu“, server uložil konfiguraci do souboru `github-config.json` na svůj lokální disk. Tento disk je však **pouze dočasný a po chvíli neaktivity se smaže**. Jakmile se serverless funkce uspala nebo restartovala, vaše nastavení se ztratilo a aplikace se vrátila k výchozímu repozitáři `ai-kucharka`.
   
2. **Chybějící hlavičky v požadavcích:**
   Prohlížeč sice měl vaše nastavení uložené lokálně v paměti (`localStorage`), ale při stahování receptů přes `/api/recipes` neposílal tyto údaje serveru v hlavičkách. Server na Vercelu proto neměl jak zjistit, že si přejete načíst data ze svého specifického repozitáře `ai-kucharka-data`.

---

## 🛠️ Jak jsme to opravili v kódu?

1. **Změna výchozího repozitáře:**
   Změnili jsme natvrdo zakódovaný fallback v celém kódu (jak na frontendu v `src/App.tsx`, tak na backendu v `server.ts`) z původního `ai-kucharka` na váš nový datový repozitář **`ai-kucharka-data`**. Nyní aplikace i bez jakéhokoliv nastavení automaticky míří na váš správný repozitář!

2. **Bezstavový přenos konfigurace (Stateless Sync):**
   Upravili jsme frontend tak, aby při každém načítání receptů (GET `/api/recipes`) i ukládání změn (POST `/api/recipes`) odesílal vaše aktuální přihlašovací údaje z `localStorage` přímo v HTTP hlavičkách (`x-github-username`, `x-github-repo`, `x-github-token`, `x-github-branch`). Backend na Vercelu tyto hlavičky okamžitě zpracuje. Díky tomu je připojení 100% stabilní a nezávislé na dočasném disku Vercelu!

---

## 📋 Návod: Jak to zprovoznit na vašem Vercelu (Krok za krokem)

Máte k dispozici dvě metody, jak mít nastavení plně pod kontrolou.

### Metoda A: Automatická (Doporučená & nejjednodušší)
Jelikož jsme aktualizovali výchozí hodnoty přímo v kódu, stačí udělat následující:
1. **Nahrajte (Pushněte) tyto nové změny** do svého GitHub repozitáře s kódem.
2. Vercel automaticky spustí nový build a nasadí aplikaci online.
3. Po otevření stránky se kuchařka **ihned a automaticky** připojí k vašemu repozitáři `ambrus-k/ai-kucharka-data` a stáhne recepty.

---

### Metoda B: Profesionální nastavení přes Vercel Environment Variables
Chcete-li mít jistotu, že vaše citlivé údaje (např. GitHub Personal Access Token) jsou v bezpečí a spolehlivě nastavené na straně serveru pro všechny uživatele, nakonfigurujte proměnné prostředí přímo ve Vercel administraci:

1. Přihlaste se do svého účtu na **[Vercel](https://vercel.com/)**.
2. Otevřete projekt své AI Kuchařky.
3. Přejděte do záložky **Settings** (Nastavení) -> **Environment Variables** (Proměnné prostředí).
4. Přidejte následující proměnné:

| Název proměnné (Key) | Hodnota (Value) | Popis |
| :--- | :--- | :--- |
| **`GITHUB_USERNAME`** | `ambrus-k` | Vaše uživatelské jméno na GitHubu. |
| **`GITHUB_REPO`** | `ai-kucharka-data` | Název datového repozitáře s recepty. |
| **`GITHUB_BRANCH`** | `main` | Název větve (zpravidla `main`). |
| **`GITHUB_TOKEN`** | `ghp_VasOsobniGitHubTokenZacinajiciNaGhp` | Váš GitHub Personal Access Token (PAT). |
| **`ADMIN_PASSWORD`** | *(vaše administrátorské heslo)* | Heslo, kterým se přihlašujete do administrace kuchařky. |
| **`GEMINI_API_KEY`** | *(váš Gemini API klíč)* | API klíč pro fungování AI asistentů a generování receptů. |

5. Klikněte na **Save** (Uložit).
6. Přejděte do záložky **Deployments** (Nasazení), klikněte na tři tečky u posledního nasazení a zvolte **Redeploy** (Znovu nasadit) s povolenou volbou *Use existing Build Cache*, aby se nové proměnné uplatnily.

---

## ⚡ Kontrola připojení přímo v aplikaci
V administraci aplikace (kliknutím na ikonu zámku/profilu v pravém horním rohu a přihlášením se) najdete novou záložku **GitHub Připojení**.
Zde můžete:
- Vidět aktuální stav propojení s GitHubem.
- Otestovat připojení pomocí tlačítka **Otestovat spojení**. Zobrazí se vám detailní diagnostika (zda repozitář existuje, zda funguje token a zda byla nalezena složka `recipes/` s recepty).
