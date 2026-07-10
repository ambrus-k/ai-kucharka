import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const DATA_DIR = path.join(process.cwd(), "data", "recipes");

// Fallback chain of models
const MODELS_TO_TRY = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];

async function generateWithRetry(ai: GoogleGenAI, prompt: string): Promise<any> {
  let modelIndex = 0;
  let attempt = 1;
  const maxRetriesPerModel = 2;

  while (modelIndex < MODELS_TO_TRY.length) {
    const modelName = MODELS_TO_TRY[modelIndex];
    try {
      console.log(`🤖 Attempting generation with model: ${modelName} (Attempt ${attempt}/2)`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "Upravený a vyčištěný seznam kroků postupu přípravy bez konkrétních vah a množství surovin."
          }
        }
      });
      return response;
    } catch (err: any) {
      const isQuotaOrRateLimit = 
        err.message?.includes("RESOURCE_EXHAUSTED") || 
        err.message?.includes("429") || 
        err.status === "RESOURCE_EXHAUSTED" ||
        err.message?.includes("UNAVAILABLE") ||
        err.message?.includes("503") ||
        err.status === 503 ||
        err.status === 429;

      if (isQuotaOrRateLimit) {
        if (attempt < maxRetriesPerModel) {
          console.warn(`⚠️ Model ${modelName} hit rate limit or service unavailable. Waiting 5s...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempt++;
        } else {
          console.warn(`⚠️ Model ${modelName} fully exhausted. Switching to next model...`);
          modelIndex++;
          attempt = 1;
        }
      } else {
        throw err;
      }
    }
  }

  throw new Error("All generative AI models in the fallback chain were exhausted or unavailable.");
}

/**
 * Local regex-based cleaner to guarantee success if all AI quotas are exhausted.
 * This has been custom tailored to handle the exact parenthesized list repetition
 * and in-sentence measurements found in the generated recipes.
 */
function cleanInstructionsLocal(instructions: string[]): string[] {
  return instructions.map(step => {
    let cleanStep = step;

    // 1. Remove parenthesized ingredient lists containing weights/measures
    // Matches: (obsahující 250 g mouky, 12 g soli...) or (250 g mouky, 12 g soli...)
    const parenthesisRegex = /\s*\([^)]*\b\d+\s*(?:g|ml|ks|lžíce|lžičk|tuzem|čerstv)[^)]*\)/gi;
    cleanStep = cleanStep.replace(parenthesisRegex, "");

    // 2. Remove in-sentence metric values like "250 ml vlažného mléka" -> "vlažné mléko" or "mléko"
    // Also clean up specific adjectives that sound awkward after number removal
    const inlineMeasureRegex = /\b\d+(?:\s*-\s*\d+)?\s*(?:g|ml|ks|lžíce|lžiček|lžičky|lžička|špetka|špetky|kapky|kapek)\b\s*/gi;
    cleanStep = cleanStep.replace(inlineMeasureRegex, "");

    // 3. Clean up grammatical artifacts left by stripping adjectives and numbers
    // e.g., "přidejte vlažného mléka" -> "přidejte vlažné mléko"
    cleanStep = cleanStep
      .replace(/\bvlažného mléka\b/g, "vlažné mléko")
      .replace(/\brozšlehaných vajec\b/g, "rozšlehaná vejce")
      .replace(/\bstudeného másla\b/g, "studené máslo")
      .replace(/\bzměklého másla\b/g, "změklé máslo")
      .replace(/\bteplého mléka\b/g, "teplé mléko")
      .replace(/\bhladké mouky\b/g, "hladkou mouku")
      .replace(/\bpolohrubé mouky\b/g, "polohrubou mouku")
      .replace(/\bhrubé mouky\b/g, "hrubou mouku")
      .replace(/\bjemné soli\b/g, "jemnou sůl")
      .replace(/\bjemné mořské soli\b/g, "jemnou mořskou sůl")
      .replace(/\bčerstvého droždí\b/g, "čerstvé droždí")
      .replace(/\brozdroleného droždí\b/g, "rozdrolené droždí")
      .replace(/\bkrupicového cukru\b/g, "krupicový cukr")
      .replace(/\btřtinového cukru\b/g, "třtinový cukr")
      .replace(/\bjemně strouhané citronové kůry\b/g, "jemně strouhanou citronovou kůru")
      .replace(/\btuzemského rumu\b/g, "tuzemský rum")
      .replace(/\bplátkových mandlí\b/g, "plátkové mandle")
      .replace(/\btekuté Sladěnky\b/g, "tekutou Sladěnku")
      .replace(/\baktivního žitného kvásku\b/g, "aktivní žitný kvásek");

    // Clean up double spaces or trailing punctuation artifacts
    cleanStep = cleanStep.replace(/\s+/g, " ").trim();

    return cleanStep;
  });
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY environment variable is not defined.");
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Error: Data directory does not exist: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  console.log(`🔍 Found ${files.length} recipe files to clean up.`);

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  let successCount = 0;
  let aiExhausted = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(DATA_DIR, file);
    console.log(`[${i + 1}/${files.length}] Processing ${file}...`);

    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const recipe = JSON.parse(fileContent);

      let cleanedInstructions: string[] | null = null;

      if (!aiExhausted) {
        try {
          const prompt = `
Jsi kulinářský korektor. Tvým úkolem je upravit a vyčistit kroky postupu přípravy ("instructions") v následujícím receptu.
Uživatel si stěžuje, že v krocích postupu jsou zbytečně a nepřirozeně opakována konkrétní množství a váhy všech surovin (např. "přidejte 125 g másla a 100 g cukru"). To je otravné, protože kompletní seznam s váhami má kuchař samostatně v sekci "ingredients".

UPRAV KROKY POSTUPU PODLE TĚCHTO PRAVIDEL:
1. Odstraň z každého kroku konkrétní číselné váhy, mililitry, gramy a přesné počty kusů surovin (např. místo "přidejte 250 g hladké mouky" napiš "přidejte mouku").
2. Zachovej ale veškeré technologické časy, teploty pečení/vaření a specifické instrukce (např. "pečte při 175 °C po dobu 50 minut" nebo "nechte 10 minut chladnout").
3. Zachovej logické rozdělení surovin, pokud je to potřeba pro postup (např. "rozdělte těsto na dvě části", nebo "přidejte druhou polovinu mléka").
4. Kroky musí být napsané česky, čtivě, plynule a s vysokou kulinářskou úrovní, přesně tak, jak by vypadaly v tištěné kuchařce.
5. Vrať čistě jen pole upravených kroků ("instructions").

--- RECIPE TITLE ---
${recipe.title}

--- ORIGINAL INGREDIENTS ---
${JSON.stringify(recipe.ingredients, null, 2)}

--- ORIGINAL INSTRUCTIONS ---
${JSON.stringify(recipe.instructions, null, 2)}
`;

          const response = await generateWithRetry(ai, prompt);
          const responseText = response.text;
          if (responseText) {
            const parsed = JSON.parse(responseText.trim());
            if (Array.isArray(parsed)) {
              cleanedInstructions = parsed;
              console.log(`✅ [AI] Cleaned ${file}`);
            }
          }
        } catch (aiErr: any) {
          console.warn(`⚠️ AI fallback chain exhausted. Falling back to local regex engine for ${file}...`);
          aiExhausted = true;
        }
      }

      // Local Regex engine fallback if AI is exhausted or failed
      if (!cleanedInstructions) {
        cleanedInstructions = cleanInstructionsLocal(recipe.instructions);
        console.log(`⚡ [Local Engine] Cleaned ${file}`);
      }

      // Save updated recipe
      recipe.instructions = cleanedInstructions;
      fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2), "utf8");
      successCount++;

    } catch (err: any) {
      console.error(`❌ Error cleaning ${file}:`, err.message || err);
    }
  }

  console.log(`\n🎉 Completed! Cleaned ${successCount} out of ${files.length} recipes successfully.`);
}

main().catch(err => {
  console.error("❌ Fatal error in cleanup script:", err);
  process.exit(1);
});
