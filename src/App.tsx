import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  BookOpen, 
  Sparkles, 
  Plus, 
  FileText, 
  FileImage, 
  Trash2, 
  Printer, 
  Clock, 
  ChefHat, 
  Check, 
  AlertCircle, 
  AlertTriangle,
  Globe, 
  Cpu, 
  Zap, 
  UtensilsCrossed, 
  Search, 
  Upload, 
  X,
  ExternalLink,
  History,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Key,
  LogIn,
  Copy,
  Download,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Settings,
  RefreshCw,
  Database,
  Scale
} from "lucide-react";
import { Recipe } from "./types";
import { DEFAULT_RECIPES as LOCAL_FALLBACK } from "./defaultRecipes";

// Check if running inside Google AI Studio environment
export const isStudioEnv = (() => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host.includes("run.app") ||
    host.includes("google") ||
    host.includes("localhost") ||
    host.includes("127.0.0.1")
  );
})();

// Dynamic Remote Database URL selection to enable Github export zero-code changes
const REMOTE_DB_URL = (() => {
  // 1. Look for VITE_REMOTE_DB_URL environment variable (injected during deployment build)
  const envUrl = (import.meta as any).env?.VITE_REMOTE_DB_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim();
  }
  
  // 2. Look for personal GitHub username override in localStorage for sharing
  const storedGithubName = localStorage.getItem("ai_kucharka_github_username");
  if (storedGithubName && storedGithubName.trim() !== "") {
    const repo = localStorage.getItem("ai_kucharka_github_repo") || "ai-kucharka";
    const branch = localStorage.getItem("ai_kucharka_github_branch") || "main";
    const path = localStorage.getItem("ai_kucharka_github_path") || "recipes.json";
    return `https://raw.githubusercontent.com/${storedGithubName.trim()}/${repo.trim()}/${branch.trim()}/${path.trim()}`;
  }

  // 3. Fallback when NOT in Studio (the live Vercel version): always load from main repo
  if (!isStudioEnv) {
    return "https://raw.githubusercontent.com/ambrus-k/ai-kucharka/main/recipes.json";
  }

  // 4. Default template in Studio
  return "https://raw.githubusercontent.com/ambrus-k/ai-kucharka/main/recipes.json";
})();


export interface ParsedIngredient {
  original: string;
  hasNumber: boolean;
  parsedNumber: number | null;
  prefix: string;
  numberString: string;
  suffix: string;
}

export function parseCzechNumber(str: string): number | null {
  const cleaned = str.trim().replace(/\s+/g, "");
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/");
    const num = parseFloat(parts[0].replace(",", "."));
    const den = parseFloat(parts[1].replace(",", "."));
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  const val = parseFloat(cleaned.replace(",", "."));
  return isNaN(val) ? null : val;
}

export function formatCzechNumber(val: number): string {
  if (Number.isInteger(val)) {
    return val.toString();
  }
  const precision = val < 10 ? 100 : 10;
  const rounded = Math.round(val * precision) / precision;
  return rounded.toString().replace(".", ",");
}

export function parseIngredientString(ing: string): ParsedIngredient {
  const result: ParsedIngredient = {
    original: ing,
    hasNumber: false,
    parsedNumber: null,
    prefix: "",
    numberString: "",
    suffix: ing
  };

  // Match any number patterns like decimals, fractions, or plain integers anywhere in the string
  const regex = /(\d+\s*\/\s*\d+|\d+(?:\s*[\.,]\s*\d+)?)/g;
  let match;

  while ((match = regex.exec(ing)) !== null) {
    const numStr = match[1];
    const startIndex = match.index;

    // Check if what follows is a percent sign (e.g. "33%") to avoid scaling fat/sugar percentage
    const rest = ing.substring(startIndex + numStr.length);
    if (rest.trim().startsWith("%")) {
      continue;
    }

    const parsed = parseCzechNumber(numStr);
    if (parsed !== null && !isNaN(parsed)) {
      result.hasNumber = true;
      result.parsedNumber = parsed;
      result.prefix = ing.substring(0, startIndex);
      result.numberString = numStr;
      result.suffix = ing.substring(startIndex + numStr.length);
      break; // Match the first non-percentage number
    }
  }

  return result;
}

export function scaleIngredient(ingParsed: ParsedIngredient, factor: number): string {
  if (!ingParsed.hasNumber || ingParsed.parsedNumber === null) {
    return ingParsed.original;
  }
  const newValue = ingParsed.parsedNumber * factor;
  const newValueStr = formatCzechNumber(newValue);
  return `${ingParsed.prefix}${newValueStr}${ingParsed.suffix}`;
}


export function getRecipeCategory(recipe: Recipe): string {
  if (recipe.category) {
    return recipe.category;
  }
  
  const title = (recipe.title || "").toLowerCase();
  
  if (title.includes("chléb") || title.includes("chlieb") || title.includes("housk") || title.includes("rohlík") || title.includes("pečivo") || title.includes("briošk") || title.includes("koláč") || title.includes("moučník") || title.includes("buchta") || title.includes("sladk") || title.includes("knedlí")) {
    return "Pečivo";
  }
  if (title.includes("polévka") || title.includes("polievka") || title.includes("vývar") || title.includes("bramboračka") || title.includes("kulajda")) {
    return "Polévky";
  }
  if (title.includes("maso") || title.includes("vepřov") || title.includes("hověz") || title.includes("kuřec") || title.includes("bůček") || title.includes("buček") || title.includes("kachn") || title.includes("řízek") || title.includes("plátek") || title.includes("sekan") || title.includes("karban") || title.includes("steak") || title.includes("křídl") || title.includes("svíčková") || title.includes("svickova")) {
    return "Maso";
  }
  
  return "Ostatní";
}

export function removePreservativesFromSoup(recipe: Recipe): Recipe {
  const isSoup = recipe.category === "Polévky" || 
                 getRecipeCategory(recipe) === "Polévky" || 
                 recipe.title.toLowerCase().includes("polé") || 
                 recipe.title.toLowerCase().includes("polí") ||
                 recipe.title.toLowerCase().includes("vývar");
  
  if (!isSoup) return recipe;

  const preservativePatterns = [
    /konzervant/i,
    /konzervač/i,
    /stabilizátor/i,
    /umělé přísady/i,
    /umělá trvanlivost/i,
    /glutamát/i,
    /chemick/i,
    /přídatná látka/i
  ];

  const cleanedIngredients = (recipe.ingredients || []).filter(ing => {
    const matchesPreservative = preservativePatterns.some(pattern => pattern.test(ing));
    return !matchesPreservative;
  }).map(ing => {
    let cleaned = ing;
    cleaned = cleaned.replace(/\s*\(s konzervanty\)/gi, "");
    cleaned = cleaned.replace(/\s*\(s obsahem konzervantů\)/gi, "");
    cleaned = cleaned.replace(/\s*\(obsahuje konzervanty\)/gi, "");
    cleaned = cleaned.replace(/\s*bez konzervantů/gi, " (čerstvé, bez konzervantů)");
    return cleaned;
  });

  return {
    ...recipe,
    ingredients: cleanedIngredients
  };
}

export function parseStepDuration(text: string): number | null {
  // Pattern matching numbers followed by czech units for minutes, hours, or seconds
  const regex = /(\d+(?:[.,]\d+)?)\s*(minut|minuty|minuta|min|s|sekund|sekundy|sekunda|vteřin|vteřiny|vteřina|hodin|hodiny|hodina|h|hod)\b/gi;
  let match;
  let totalSeconds = 0;
  let found = false;
  
  while ((match = regex.exec(text)) !== null) {
    const rawNum = match[1].replace(",", ".");
    const value = parseFloat(rawNum);
    if (isNaN(value)) continue;
    
    const unit = match[2].toLowerCase();
    
    if (unit.startsWith("h") || unit.startsWith("hod")) {
      totalSeconds += value * 3600;
      found = true;
    } else if (unit.startsWith("m")) {
      totalSeconds += value * 60;
      found = true;
    } else if (unit.startsWith("s") || unit.startsWith("v")) {
      totalSeconds += value;
      found = true;
    }
  }
  
  return found ? Math.round(totalSeconds) : null;
}

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  const mStr = String(m).padStart(2, "0");
  const sStr = String(s).padStart(2, "0");
  
  if (h > 0) {
    const hStr = String(h).padStart(2, "0");
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

export function playBeep(): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.35); // beep for 0.35 seconds
  } catch (e) {
    console.warn("AudioContext beep failed", e);
  }
}

export function getStepIngredients(stepText: string, ingredients: string[], factor: number) {
  if (!ingredients) return [];
  const cleanStep = stepText.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Diacritics
    .replace(/[^a-z0-9\s]/g, " ");

  return ingredients.map((ing) => {
    const parsed = parseIngredientString(ing);
    const displayIng = scaleIngredient(parsed, factor);
    
    // Clean ingredient name from words like numbers, units, brackets
    const cleanIngName = ing.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[0-9\-\/]/g, "") // remove numbers
      .replace(/\b(g|kg|ml|l|ks|baleni|lzi|lzic|lzice|pl|kl|smichat|pridat|na|do|hrnek|hrnky|hrnku)\b/g, "") // remove common units
      .replace(/[^a-z\s]/g, " ")
      .trim();

    const words = cleanIngName.split(/\s+/).filter(w => w.length > 2); // only significant stems

    let isMatched = false;
    if (words.length === 0) {
      // fallback to basic matching if no long words parsed
      const fallbackCheck = ing.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "").substring(0, 5);
      if (fallbackCheck.length >= 3 && cleanStep.includes(fallbackCheck)) {
        isMatched = true;
      }
    } else {
      // Match if some significant words or their stems appear in the instruction text
      isMatched = words.some(w => {
        if (cleanStep.includes(w)) return true;
        // Check Czech genitive endings or simple root endings (e.g., máslo -> másl, mouka -> mouk, vejce -> vejc, cukr -> cukr)
        const stem = w.substring(0, w.length - 1);
        if (stem.length >= 3 && cleanStep.includes(stem)) return true;
        return false;
      });
    }

    return {
      original: ing,
      display: displayIng,
      isMatched
    };
  });
}

export default function App() {
  // State for recipe database
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [scaleIngredientIndex, setScaleIngredientIndex] = useState<number>(0);
  const [scaleInputValue, setScaleInputValue] = useState<string>("");
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // Automatically reset the recipe scale factor back to 1 when switching to another recipe as requested
  useEffect(() => {
    setScaleFactor(1);
    setScaleIngredientIndex(0);
    setIsCalculatorOpen(false);
    setEditingIngredientIndex(null);
    setEditingValue("");
  }, [selectedRecipe?.id]);

  // Keep the scaling input value in sync when the scale factor, selected recipe or active ingredient changes
  useEffect(() => {
    if (selectedRecipe) {
      const scalable = selectedRecipe.ingredients
        .map((ing, originalIndex) => ({ originalIndex, parsed: parseIngredientString(ing) }))
        .filter(item => item.parsed.hasNumber && item.parsed.parsedNumber !== null);
      
      const active = scalable.find(item => item.originalIndex === scaleIngredientIndex) || scalable[0];
      if (active && active.parsed.parsedNumber !== null) {
        setScaleInputValue(formatCzechNumber(active.parsed.parsedNumber! * scaleFactor));
      } else {
        setScaleInputValue("");
      }
    } else {
      setScaleInputValue("");
    }
  }, [scaleFactor, scaleIngredientIndex, selectedRecipe?.id]);

  // States for hidden admin mode
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  // States for Hands-free / Cooking Mode with Wake Lock
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [currentHandsFreeStep, setCurrentHandsFreeStep] = useState(0);
  const [showAllIngredientsInStep, setShowAllIngredientsInStep] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);

  // States for countdown timers in Cooking Mode per instruction index
  const [timers, setTimers] = useState<Record<number, {
    secondsLeft: number;
    isRunning: boolean;
    totalSeconds: number;
    beeped?: boolean;
  }>>({});

  // States for search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedAlphabet, setCollapsedAlphabet] = useState<Record<string, boolean>>({});
  const [sidebarViewMode, setSidebarViewMode] = useState<"druh" | "abeceda">("druh");

  // States for input portal
  const [rawText, setRawText] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Client interactive checklist states
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [checkedInstructions, setCheckedInstructions] = useState<Record<number, boolean>>({});

  // States for simplified text export
  const [showExportView, setShowExportView] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // States for recipe audit/checking
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditSteps, setAuditSteps] = useState<string[] | null>(null);
  const [proposedChange, setProposedChange] = useState<string | null>(null);
  const [auditModifiedRecipe, setAuditModifiedRecipe] = useState<Recipe | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);

  // States for Admin Login & Server-side recipes database
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"admin" | "github">("admin");
  const [githubUser, setGithubUser] = useState(() => localStorage.getItem("ai_kucharka_github_username") || "ambrus-k");
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem("ai_kucharka_github_repo") || "ai-kucharka");
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem("ai_kucharka_github_token") || "");
  const [githubBranch, setGithubBranch] = useState(() => localStorage.getItem("ai_kucharka_github_branch") || "main");
  const [githubPath, setGithubPath] = useState(() => localStorage.getItem("ai_kucharka_github_path") || "recipes.json");
  const [serverlessApiError, setServerlessApiError] = useState<string | null>(null);
  const [serverlessApiSuccess, setServerlessApiSuccess] = useState<boolean>(false);

  // Connection testing states
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [githubStatusResult, setGithubStatusResult] = useState<any | null>(null);
  const [isSavingGithubConfig, setIsSavingGithubConfig] = useState(false);
  const [saveGithubConfigSuccess, setSaveGithubConfigSuccess] = useState<string | null>(null);

  // Load GitHub config from server when modal is opened
  useEffect(() => {
    if (showLoginModal) {
      const fetchGithubConfig = async () => {
        try {
          const res = await fetch("/api/github-config");
          if (res.ok) {
            const data = await res.json();
            if (data.username) setGithubUser(data.username);
            if (data.repo) setGithubRepo(data.repo);
            if (data.token) setGithubToken(data.token);
            if (data.branch) setGithubBranch(data.branch);
          }
        } catch (err) {
          console.error("Nepodařilo se načíst GitHub konfiguraci ze serveru:", err);
        }
      };
      fetchGithubConfig();
    }
  }, [showLoginModal]);

  const handleTestGithubConnection = async (userVal: string, repoVal: string, branchVal: string, tokenVal: string) => {
    setIsTestingConnection(true);
    setGithubStatusResult(null);
    try {
      const headers: Record<string, string> = {
        "x-github-username": userVal,
        "x-github-repo": repoVal,
        "x-github-branch": branchVal,
      };
      if (tokenVal) {
        headers["x-github-token"] = tokenVal;
      }
      const res = await fetch("/api/github-status", { headers });
      if (res.ok) {
        const data = await res.json();
        setGithubStatusResult(data);
      } else {
        const errText = await res.text();
        setGithubStatusResult({
          connected: false,
          errorMessage: `Server vrátil chybu: ${errText || res.statusText}`,
        });
      }
    } catch (err: any) {
      setGithubStatusResult({
        connected: false,
        errorMessage: `Nelze se spojit se serverem: ${err?.message || err}`,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveGithubConfig = async (userVal: string, repoVal: string, branchVal: string, tokenVal: string) => {
    setIsSavingGithubConfig(true);
    setSaveGithubConfigSuccess(null);
    try {
      const res = await fetch("/api/github-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userVal,
          repo: repoVal,
          branch: branchVal,
          token: tokenVal,
        }),
      });
      if (res.ok) {
        setSaveGithubConfigSuccess("Konfigurace byla úspěšně uložena na server!");
        localStorage.setItem("ai_kucharka_github_username", userVal);
        localStorage.setItem("ai_kucharka_github_repo", repoVal);
        localStorage.setItem("ai_kucharka_github_branch", branchVal);
        localStorage.setItem("ai_kucharka_github_token", tokenVal);
        
        // Reload after success to pull new recipes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setGithubStatusResult({
          connected: false,
          errorMessage: `Chyba ukládání: ${data.error || "Neznámá chyba"}`,
        });
      }
    } catch (err: any) {
      setGithubStatusResult({
        connected: false,
        errorMessage: `Chyba připojení při ukládání: ${err?.message || err}`,
      });
    } finally {
      setIsSavingGithubConfig(false);
    }
  };

  const handleAuditRecipe = async () => {
    if (!selectedRecipe) return;

    setIsAuditing(true);
    setAuditError(null);
    setAuditSteps(null);
    setProposedChange(null);
    setAuditModifiedRecipe(null);
    setActiveStepIndex(-1);

    try {
      const response = await fetch("/api/check-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: selectedRecipe,
          adminPassword,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Při kontrole receptu se vyskytla chyba.");
      }

      const data = await response.json();
      if (!data.simulationSteps || !data.proposedChange || !data.modifiedRecipe) {
        throw new Error("Server nevrátil platná data pro kontrolu receptu.");
      }

      setAuditSteps(data.simulationSteps);
      setProposedChange(data.proposedChange);
      setAuditModifiedRecipe(data.modifiedRecipe);

      // Animate displaying steps one by one
      for (let i = 0; i < data.simulationSteps.length; i++) {
        setActiveStepIndex(i);
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 0 : 700));
      }

    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || "Nepodařilo se spojit se serverem pro kontrolu.");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAcceptAuditChange = () => {
    if (!selectedRecipe || !auditModifiedRecipe) return;
    
    const stampedRecipe = { ...auditModifiedRecipe, updatedAt: new Date().toISOString() };
    // Replace recipe with the modified one
    const updatedRecipesList = recipes.map(r => r.id === selectedRecipe.id ? stampedRecipe : r);
    saveRecipesToStorage(updatedRecipesList, stampedRecipe);
    setSelectedRecipe(stampedRecipe);
    
    // Clear audit panel state after accepting
    setAuditSteps(null);
    setProposedChange(null);
    setAuditModifiedRecipe(null);
    setActiveStepIndex(-1);
  };

  const handleRejectAuditChange = () => {
    // Clear state
    setAuditSteps(null);
    setProposedChange(null);
    setAuditModifiedRecipe(null);
    setActiveStepIndex(-1);
  };

  // Hands-free cooking mode methods
  const startHandsFree = async () => {
    setIsHandsFree(true);
    setCurrentHandsFreeStep(0);
    setWakeLockError(null);
    setTimers({}); // Reset timers for this cooking session
    
    if ('wakeLock' in navigator) {
      setWakeLockSupported(true);
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        console.log("Cooking mode: Screen Wake Lock acquired!");
      } catch (err: any) {
        console.warn("Wake Lock request failed (disallowed or iframe context):", err);
        const errMsg = err.message || "";
        if (errMsg.includes("permissions policy") || errMsg.includes("disallowed")) {
          setWakeLockError("Blokováno v režimu náhledu (iframe). Spusťte v samostatné záložce pro plnou funkčnost.");
        } else {
          setWakeLockError(errMsg || "Nepodařilo se aktivovat Wake Lock");
        }
      }
    } else {
      setWakeLockSupported(false);
    }
  };

  const stopHandsFree = async () => {
    setIsHandsFree(false);
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        console.log("Cooking mode: Screen Wake Lock released!");
      } catch (err) {
        console.warn("Wake Lock release failed:", err);
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (isHandsFree && wakeLock !== null && document.visibilityState === 'visible') {
        if ('wakeLock' in navigator) {
          try {
            const lock = await (navigator as any).wakeLock.request('screen');
            setWakeLock(lock);
          } catch (err) {
            console.warn("Re-requesting wake lock failed:", err);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isHandsFree, wakeLock]);

  // Real-time ticking for all running timers
  useEffect(() => {
    let intervalId: any;
    if (isHandsFree) {
      intervalId = setInterval(() => {
        setTimers(prev => {
          let changed = false;
          const next = { ...prev };
          
          Object.keys(next).forEach(key => {
            const stepIndex = Number(key);
            const t = next[stepIndex];
            if (t && t.isRunning && t.secondsLeft > 0) {
              const newSecs = t.secondsLeft - 1;
              const completed = newSecs === 0;
              
              next[stepIndex] = {
                ...t,
                secondsLeft: newSecs,
                isRunning: !completed, // Stop automatically when reaching 0
                beeped: completed ? true : t.beeped
              };
              changed = true;
              
              if (completed) {
                // Play double beep notification
                playBeep();
                setTimeout(playBeep, 400);
              }
            }
          });
          
          return changed ? next : prev;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isHandsFree]);

  // Handle active step automatic step duration parsing
  useEffect(() => {
    if (isHandsFree && selectedRecipe) {
      const text = selectedRecipe.instructions[currentHandsFreeStep] || "";
      if (timers[currentHandsFreeStep] === undefined) {
        const parsedSecs = parseStepDuration(text);
        setTimers(prev => ({
          ...prev,
          [currentHandsFreeStep]: {
            secondsLeft: parsedSecs || 0,
            isRunning: false,
            totalSeconds: parsedSecs || 0,
            beeped: false
          }
        }));
      }
    }
  }, [currentHandsFreeStep, isHandsFree, selectedRecipe]);

  const toggleTimer = (stepIndex: number) => {
    setTimers(prev => {
      const next = { ...prev };
      const t = next[stepIndex] || { secondsLeft: 0, isRunning: false, totalSeconds: 0, beeped: false };
      if (t.secondsLeft === 0 && !t.isRunning) return prev; // Cannot start 0-second timer
      
      next[stepIndex] = {
        ...t,
        isRunning: !t.isRunning,
        beeped: t.secondsLeft > 0 ? false : t.beeped
      };
      return next;
    });
  };

  const adjustTimer = (stepIndex: number, amountSeconds: number) => {
    setTimers(prev => {
      const next = { ...prev };
      const t = next[stepIndex] || { secondsLeft: 0, isRunning: false, totalSeconds: 0, beeped: false };
      
      const newSecs = Math.max(0, t.secondsLeft + amountSeconds);
      const newTotal = newSecs === 0 ? 0 : Math.max(newSecs, t.totalSeconds);
      
      next[stepIndex] = {
        ...t,
        secondsLeft: newSecs,
        totalSeconds: newTotal,
        beeped: false
      };
      return next;
    });
  };

  const resetTimer = (stepIndex: number) => {
    setTimers(prev => {
      const next = { ...prev };
      const t = next[stepIndex] || { secondsLeft: 0, isRunning: false, totalSeconds: 0, beeped: false };
      
      next[stepIndex] = {
        ...t,
        secondsLeft: t.totalSeconds,
        isRunning: false,
        beeped: false
      };
      return next;
    });
  };

  const nextHandsFreeStep = () => {
    if (!selectedRecipe) return;
    if (currentHandsFreeStep < selectedRecipe.instructions.length - 1) {
      setCurrentHandsFreeStep(prev => prev + 1);
    }
  };

  const prevHandsFreeStep = () => {
    if (currentHandsFreeStep > 0) {
      setCurrentHandsFreeStep(prev => prev - 1);
    }
  };

  // States for Editing recipe
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editIngredientsText, setEditIngredientsText] = useState("");
  const [editInstructionsText, setEditInstructionsText] = useState("");
  const [editApplianceTips, setEditApplianceTips] = useState("");
  const [editExpertJustification, setEditExpertJustification] = useState("");
  const [editApplianceType, setEditApplianceType] = useState("");
  const [editCookingTime, setEditCookingTime] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("Střední");
  const [editCategory, setEditCategory] = useState("Ostatní");
  
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLogs, setEditLogs] = useState<string[]>([]);

  const startEditingRecipe = () => {
    if (!selectedRecipe) return;
    setEditTitle(selectedRecipe.title || "");
    setEditSummary(selectedRecipe.summary || "");
    setEditIngredientsText(selectedRecipe.ingredients ? selectedRecipe.ingredients.join("\n") : "");
    setEditInstructionsText(selectedRecipe.instructions ? selectedRecipe.instructions.join("\n") : "");
    setEditApplianceTips(selectedRecipe.applianceTips || "");
    setEditExpertJustification(selectedRecipe.expertJustification || "");
    setEditApplianceType(selectedRecipe.applianceType || "");
    setEditCookingTime(selectedRecipe.cookingTime || "");
    setEditDifficulty(selectedRecipe.difficulty || "Střední");
    setEditCategory(selectedRecipe.category || getRecipeCategory(selectedRecipe));
    setEditPrompt("");
    setEditError(null);
    setEditLogs([]);
    setIsEditing(true);
  };

  const handleSaveEditedRecipe = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRecipe) return;

    const updatedRecipe: Recipe = {
      ...selectedRecipe,
      title: editTitle,
      summary: editSummary,
      ingredients: editIngredientsText.split("\n").map(i => i.trim()).filter(Boolean),
      instructions: editInstructionsText.split("\n").map(i => i.trim()).filter(Boolean),
      applianceTips: editApplianceTips,
      expertJustification: editExpertJustification,
      applianceType: editApplianceType,
      cookingTime: editCookingTime,
      difficulty: editDifficulty as "Snadné" | "Střední" | "Složité",
      category: editCategory,
      updatedAt: new Date().toISOString()
    };

    const updatedRecipesList = recipes.map(r => r.id === selectedRecipe.id ? updatedRecipe : r);
    saveRecipesToStorage(updatedRecipesList, updatedRecipe);
    setSelectedRecipe(updatedRecipe);
    setIsEditing(false);
  };

  const handleAiEditRecipe = async () => {
    if (!selectedRecipe || !editPrompt.trim()) {
      setEditError("Prosím, zadejte pokyny pro upravení receptu AI.");
      return;
    }

    setIsEditLoading(true);
    setEditError(null);
    setEditLogs([]); // Clean previous logs

    const nowStr = () => {
      const d = new Date();
      return d.toTimeString().split(' ')[0];
    };

    setEditLogs([`[${nowStr()}] [INFO] Iniciace systému úprav...`]);

    const logStepsTemplates = [
      `[PROCESS] Parsování vašich pokynů: "${editPrompt}"`,
      "[PROCESS] Spojení s kulinářským AI jádrem (Pilíř 1, 2, 3, 4 & 5)...",
      "[PROCESS] Vyhodnocování chemických vazeb a gastronomických vztahů surovin...",
      "[PROCESS] Validace nepřítomnosti konzervačních a umělých přísad...",
      "[PROCESS] Optimalizace tepelného profilu a teploty moderních spotřebičů...",
      "[PROCESS] Syntéza upraveného popisu, surovin a nového postupu v češtině...",
      "[PROCESS] Generování odborného kuchařského zdůvodnění expertJustification..."
    ];

    let currentStep = 0;
    const intervalId = setInterval(() => {
      if (currentStep < logStepsTemplates.length) {
        const item = logStepsTemplates[currentStep];
        const parts = item.split(" ");
        const level = parts[0].replace("[", "").replace("]", "");
        const msg = parts.slice(1).join(" ");
        
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        setEditLogs(prev => [...prev, `[${timeStr}] [${level}] ${msg}`]);
        currentStep++;
      }
    }, 700);

    try {
      const response = await fetch("/api/edit-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: selectedRecipe,
          modificationPrompt: editPrompt,
          adminPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Při úpravě receptu AI se vyskytla chyba.");
      }

      const data = await response.json();
      if (!data.recipe) {
        throw new Error("Server nevrátil platný upravený recept.");
      }

      const editedRecipe: Recipe = data.recipe;
      
      // Dump remaining steps if response returned quicker
      clearInterval(intervalId);
      const remainingLogs: string[] = [];
      for (let i = currentStep; i < logStepsTemplates.length; i++) {
        const item = logStepsTemplates[i];
        const parts = item.split(" ");
        const level = parts[0].replace("[", "").replace("]", "");
        const msg = parts.slice(1).join(" ");
        const timeStr2 = new Date().toTimeString().split(' ')[0];
        remainingLogs.push(`[${timeStr2}] [${level}] ${msg}`);
      }
      
      if (remainingLogs.length > 0) {
        setEditLogs(prev => [...prev, ...remainingLogs]);
      }

      setEditTitle(editedRecipe.title || "");
      setEditSummary(editedRecipe.summary || "");
      setEditIngredientsText(editedRecipe.ingredients ? editedRecipe.ingredients.join("\n") : "");
      setEditInstructionsText(editedRecipe.instructions ? editedRecipe.instructions.join("\n") : "");
      setEditApplianceTips(editedRecipe.applianceTips || "");
      setEditExpertJustification(editedRecipe.expertJustification || "");
      setEditApplianceType(editedRecipe.applianceType || "");
      setEditCookingTime(editedRecipe.cookingTime || "");
      setEditDifficulty(editedRecipe.difficulty || "Střední");
      setEditCategory(editedRecipe.category || getRecipeCategory(editedRecipe));
      setEditPrompt(""); // Clear prompt after success

      const timeStrSuccess = new Date().toTimeString().split(' ')[0];
      setEditLogs(prev => [...prev, `[${timeStrSuccess}] [SUCCESS] Recept byl úspěšně zrekonstruován a načten do formuláře!`]);
    } catch (err: any) {
      clearInterval(intervalId);
      console.error(err);
      const timeStrErr = new Date().toTimeString().split(' ')[0];
      setEditLogs(prev => [...prev, `[${timeStrErr}] [WARN] Selhání při úpravě: ${err.message || "Neznámá chyba"}`]);
      setEditError(err.message || "Nepodařilo se spojit se serverem pro AI úpravu.");
    } finally {
      setIsEditLoading(false);
    }
  };

  // Loading generation state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin password login and server-side verification states
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginWithPassword = async (passwordToVerify: string) => {
    if (!passwordToVerify.trim()) {
      setLoginError("Zadejte prosím platný kulinářský API klíč.");
      return false;
    }
    
    setIsLoginLoading(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: passwordToVerify }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Neplatný kulinářský API klíč.");
      }
      
      localStorage.setItem("admin_password_token", passwordToVerify);
      setAdminPassword(passwordToVerify);
      setIsAdmin(true);
      setLoginError(null);
      return true;
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || "Nepodařilo se ověřit klíč.");
      setIsAdmin(false);
      return false;
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleConfigureGithub = () => {
    setShowLoginModal(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateRecipeText = () => {
    if (!selectedRecipe) return "";
    
    const separator = "=".repeat(60);
    
    return `${separator}
RECEPT: ${selectedRecipe.title.toUpperCase()}
${separator}

Kategorie: ${selectedRecipe.category || getRecipeCategory(selectedRecipe)}
Doba přípravy: ${selectedRecipe.cookingTime || "Není specifikováno"}
Náročnost: ${selectedRecipe.difficulty || "Střední"}
Doporučený spotřebič: ${selectedRecipe.applianceType || "Standardní spotřebič"}

--- SHRNUTÍ RECEPTU ---
${selectedRecipe.summary || "Bez popisu."}

--- SEZNAM INGREDIENCÍ ---
${selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 
  ? selectedRecipe.ingredients.map(ing => `• ${ing}`).join("\n") 
  : "Žádné ingredience nejsou zapsány."}

--- POSTUP PŘÍPRAVY ---
${selectedRecipe.instructions && selectedRecipe.instructions.length > 0 
  ? selectedRecipe.instructions.map((step, idx) => `${idx + 1}. ${step}`).join("\n\n") 
  : "Žádný postup přípravy není zapsán."}

--- TIP PRO MODERNÍ SPOTŘEBIČ (${selectedRecipe.applianceType}) ---
${selectedRecipe.applianceTips || "Bez tipů pro spotřebič."}

--- VĚDECKÉ GASTRONOMICKÉ ZDŮVODNĚNÍ ---
${selectedRecipe.expertJustification || "Bez doplňujícího vědeckého odůvodnění."}

${separator}
Stabilita, přesnost a kulinářské inženýrství • AI KUCHAŘKA
Vygenerováno dne: ${new Date().toLocaleDateString("cs-CZ")}
${separator}`;
  };

  const downloadRecipePDF = async () => {
    if (!selectedRecipe) return;

    // Grab the beautifully rendered recipe container element present in the document
    const element = document.querySelector(".printable-recipe-sheet");
    if (!element) {
      setPrintNotice("Náhled receptu nebyl nalezen v dokumentu.");
      setTimeout(() => setPrintNotice(null), 5000);
      return;
    }

    setPrintNotice("Příprava PDF dokumentu ke stažení...");

    let iframe: HTMLIFrameElement | null = null;

    try {
      const title = selectedRecipe.title;
      const cleanFilename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-recept.pdf`;

      // 1. Create an isolated iframe to completely bypass main page style sheets containing "oklch"
      iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "820px";
      iframe.style.height = "2500px"; // Provide a generous initial height
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      const iframeWin = iframe.contentWindow as any;
      if (!iframeDoc || !iframeWin) {
        throw new Error("Nepodařilo se vytvořit tiskový kontext.");
      }

      // Clone original element’s HTML mockup
      const clonedHtml = element.innerHTML;

      // 2. Clean CSS styles defining look & feel of the PDF *without* any "oklch"
      const safeStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        body {
          margin: 0;
          padding: 20px;
          background-color: #FFFFFF;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          color: #2C2C2C;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .printable-recipe-sheet {
          background-color: #FCF9F2;
          color: #2C2C2C;
          border: 1px solid #E3DDCF;
          border-radius: 16px;
          padding: 30px;
          max-width: 760px;
          margin: 0 auto;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .border-b {
          border-bottom: 1px solid #D8D2C2;
        }

        .border-t {
          border-top: 1px solid #D8D2C2;
        }

        .pb-6 {
          padding-bottom: 24px;
        }

        .pb-1 {
          padding-bottom: 4px;
        }

        .pt-4 {
          padding-top: 16px;
        }

        .py-4 {
          padding-top: 16px;
          padding-bottom: 16px;
        }

        .space-y-3 {
          margin-top: 12px;
        }

        .space-y-3 > * + * {
          margin-top: 12px;
        }

        .space-y-4 > * + * {
          margin-top: 16px;
        }

        .space-y-2 > * + * {
          margin-top: 8px;
        }

        .space-y-6 > * + * {
          margin-top: 24px;
        }

        .flex {
          display: flex;
        }

        .flex-col {
          flex-direction: column;
        }

        .gap-2 {
          gap: 8px;
        }

        .gap-3 {
          gap: 12px;
        }

        .justify-between {
          justify-content: space-between;
        }

        .items-center {
          align-items: center;
        }

        .font-mono {
          font-family: monospace;
        }

        .font-serif {
          font-family: 'Playfair Display', Georgia, serif;
        }

        .font-bold {
          font-weight: 700;
        }

        .font-extrabold {
          font-weight: 800;
        }

        .font-black {
          font-weight: 900;
        }

        .uppercase {
          text-transform: uppercase;
        }

        .tracking-widest {
          letter-spacing: 0.1em;
        }

        .tracking-tight {
          letter-spacing: -0.025em;
        }

        .text-\\[10px\\] {
          font-size: 10px;
        }

        .text-xs {
          font-size: 11px;
        }

        .text-sm {
          font-size: 13px;
        }

        .text-base {
          font-size: 15px;
        }

        .text-lg {
          font-size: 18px;
        }

        .text-3xl {
          font-size: 28px;
        }

        .text-4xl {
          font-size: 34px;
        }

        .text-\\[\\#888172\\] {
          color: #888172;
        }

        .text-\\[\\#1B4332\\] {
          color: #1B4332;
        }

        .text-\\[\\#46463D\\] {
          color: #46463D;
        }

        .text-\\[\\#3A3A34\\] {
          color: #3A3A34;
        }

        .text-\\[\\#D97706\\] {
          color: #D97706;
        }

        .text-emerald-800 {
          color: #065F46;
        }

        .block {
          display: block;
        }

        .mt-0.5 {
          margin-top: 2px;
        }

        .grid {
          display: grid;
        }

        .grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .gap-4 {
          gap: 16px;
        }

        .italic {
          font-style: italic;
        }

        .list-disc {
          list-style-type: disc;
        }

        .pl-5 {
          padding-left: 20px;
        }

        .shrink-0 {
          flex-shrink: 0;
        }

        /* Sub-responsive grid handling inside clean container */
        @media (min-width: 500px) {
          .grid-cols-2 {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .flex-col {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
      `;

      // 3. Build safe HTML inside the iframe
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>${safeStyles}</style>
          </head>
          <body>
            <div id="pdf-root" class="printable-recipe-sheet">
              ${clonedHtml}
            </div>
          </body>
        </html>
      `);
      iframeDoc.close();

      // Ensure the newly written document has processed styles and completed render layout
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pdfRootElement = iframeDoc.getElementById("pdf-root");
      if (!pdfRootElement) {
        throw new Error("Chyba při přípravě struktury tisku uvnitř iframe.");
      }

      // 4. Install html2pdf inside the iframe to avoid main document namespace collision and oklch parsing
      const html2pdf = await new Promise<any>((resolve, reject) => {
        if (iframeWin.html2pdf) {
          resolve(iframeWin.html2pdf);
          return;
        }

        const script = iframeDoc.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.crossOrigin = "anonymous";
        script.onload = () => {
          if (iframeWin.html2pdf) {
            resolve(iframeWin.html2pdf);
          } else {
            reject(new Error("Nezdařilo se svázat html2pdf s vnitřním oknem tiskového kontextu."));
          }
        };
        script.onerror = () => reject(new Error("Nepodařilo se stáhnout tiskovou knihovnu uvnitř iframe."));
        iframeDoc.body.appendChild(script);
      });

      // Avoid "Invalid margin array" by converting array structure into iframeWin array realms
      const safeMargin = iframeWin.JSON.parse("[0.4, 0.4, 0.4, 0.4]");

      // Adjust height of the iframe so html2pdf layout is entirely visible
      const scrollHeight = Math.max(
        iframeDoc.body?.scrollHeight || 0,
        iframeDoc.documentElement?.scrollHeight || 0,
        pdfRootElement.scrollHeight || 0,
        1500
      );
      iframe.style.height = `${scrollHeight + 150}px`;

      // Configure beautiful options for high-quality standard-size PDFs
      const opt = {
        margin:       safeMargin,
        filename:     cleanFilename,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: "#FCF9F2"
        },
        jsPDF:        { unit: "in", format: "letter", orientation: "portrait" }
      };

      // 5. Generate and download PDF inside parent context as a Blob structure
      const blob = await html2pdf().set(opt).from(pdfRootElement).output("blob");

      // 6. Trigger native user-centric download in the parent browser tab
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.id = "pdf-download-link";
      link.href = blobUrl;
      link.download = cleanFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setPrintNotice("PDF soubor s receptem byl úspěšně stažen!");
      setTimeout(() => setPrintNotice(null), 5000);

    } catch (err: any) {
      console.error("PDF generation failed:", err);
      setPrintNotice(`Chyba při přípravě PDF: ${err.message || err}`);
      setTimeout(() => setPrintNotice(null), 6000);
    } finally {
      if (iframe) {
        document.body.removeChild(iframe);
      }
    }
  };

  const triggerNativePrint = () => {
    if (!selectedRecipe) return;

    // Grab the beautifully rendered recipe container element present in the document
    const element = document.querySelector(".printable-recipe-sheet");
    if (!element) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const title = selectedRecipe.title;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title} - Tisk</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                background-color: #FFFFFF;
                color: #2D3748;
                margin: 0;
                padding: 40px;
                line-height: 1.6;
              }
              button {
                display: none !important;
              }
              .printable-recipe-sheet {
                max-width: 820px;
                margin: 0 auto;
                background: #FFFFFF;
              }
              /* Keep margins very clean */
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          </head>
          <body>
            <div class="printable-recipe-sheet">
              ${element.innerHTML}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      // Fallback if popup is blocked
      window.print();
    }
  };

  const unused_code_wrapper = () => {
    if (!selectedRecipe) return;

    const title = selectedRecipe.title;
    const category = selectedRecipe.category || getRecipeCategory(selectedRecipe);
    const cookingTime = selectedRecipe.cookingTime || "Není specifikováno";
    const difficulty = selectedRecipe.difficulty || "Střední";
    const applianceType = selectedRecipe.applianceType || "Standardní spotřebič";
    const summary = selectedRecipe.summary || "Bez popisu.";
    const applianceTips = selectedRecipe.applianceTips || "Bez speciálních inženýrských tipů.";
    const expertJustification = selectedRecipe.expertJustification || "Bez doplňujících vědeckých odůvodnění chuti a struktury.";

    // Render ingredients as checklist list items
    const ingredientsHtml = selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 
      ? selectedRecipe.ingredients.map(ing => `
        <li class="ingredient-item">
          <span class="checkbox-box"></span>
          <span>${ing}</span>
        </li>
      `).join("")
      : `<li class="ingredient-item">Žádné ingredience nejsou zapsány.</li>`;

    // Render instructions list
    const instructionsHtml = selectedRecipe.instructions && selectedRecipe.instructions.length > 0
      ? selectedRecipe.instructions.map((step, idx) => `
        <div class="step-card">
          <div class="step-number">${idx + 1}</div>
          <div class="step-text">${step}</div>
        </div>
      `).join("")
      : `<p>Žádný postup přípravy není zapsán.</p>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <title>${title} - AI Kuchařka</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background-color: #FAF8F5;
      color: #2E2E2A;
      margin: 0;
      padding: 40px 20px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    
    .print-dialog-wrapper {
      max-width: 820px;
      margin: 0 auto 30px auto;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 16px;
      padding: 16px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 15px rgba(217, 119, 6, 0.05);
      text-align: center;
    }
    
    .print-dialog-text {
      font-size: 14px;
      color: #B45309;
      font-weight: 600;
    }
    
    .print-dialog-text strong {
      color: #78350F;
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background-color: #D97706;
      color: #FFFFFF;
      font-weight: 800;
      border: none;
      padding: 12px 28px;
      font-size: 14px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(217, 119, 6, 0.2);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .btn-print:hover {
      background-color: #C26405;
      transform: translateY(-1px);
    }
    
    .btn-print:active {
      transform: translateY(0);
    }

    .recipe-sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1.5px solid #E8E5DC;
      border-radius: 24px;
      padding: 50px;
      box-shadow: 0 10px 40px rgba(44, 44, 40, 0.04);
      position: relative;
    }

    .sheet-header {
      border-bottom: 2px solid #E8E5DC;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }

    .meta-brand {
      font-size: 11px;
      font-weight: 800;
      color: #888172;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .recipe-title {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      color: #1B4332;
      margin: 0;
      font-weight: 800;
      line-height: 1.15;
    }

    .recipe-category {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      color: #D97706;
      background-color: #FFFBEB;
      padding: 4px 12px;
      border-radius: 20px;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .parameters-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      padding: 20px 0;
      border-top: 1px solid #E8E5DC;
      border-bottom: 1px solid #E8E5DC;
      margin-bottom: 35px;
    }

    @media (max-width: 640px) {
      .parameters-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    }

    .param-item {
      display: flex;
      flex-direction: column;
    }

    .param-label {
      font-size: 10px;
      font-weight: 800;
      color: #888172;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }

    .param-value {
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      font-weight: 800;
      color: #1B4332;
    }

    .section-title {
      font-family: 'Playfair Display', serif;
      font-size: 22px;
      color: #1B4332;
      border-bottom: 2px solid #E8E8E1;
      padding-bottom: 8px;
      margin-top: 35px;
      margin-bottom: 20px;
      font-weight: 700;
      page-break-after: avoid;
    }

    .summary-text {
      font-family: 'Playfair Display', serif;
      font-size: 17px;
      font-style: italic;
      color: #4A4A45;
      line-height: 1.6;
      margin-bottom: 30px;
    }

    .ingredients-list {
      padding-left: 0;
      margin: 0;
    }

    .ingredient-item {
      padding: 8px 0;
      border-bottom: 1px solid #F3F1EC;
      list-style: none;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 15px;
      page-break-inside: avoid;
    }

    .checkbox-box {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #1B4332;
      border-radius: 4px;
      margin-top: 3px;
      flex-shrink: 0;
    }

    .step-card {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 22px;
      page-break-inside: avoid;
    }

    .step-number {
      background-color: #1B4332;
      color: #FFFFFF;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .step-text {
      font-size: 15px;
      color: #3A3A34;
      line-height: 1.6;
      padding-top: 3px;
    }

    .expert-block {
      background-color: #FDFCEF;
      border: 1px solid #ECE7D9;
      border-radius: 16px;
      padding: 24px;
      margin-top: 20px;
      color: #3A3A34;
      font-size: 14.5px;
      page-break-inside: avoid;
    }

    .expert-block h4 {
      margin-top: 0;
      margin-bottom: 8px;
      color: #D97706;
      font-family: 'Playfair Display', serif;
      font-size: 15px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .footer-stamp {
      margin-top: 50px;
      border-top: 1px solid #E8E5DC;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 700;
      color: #888172;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    @media print {
      body {
        background-color: #FFFFFF;
        padding: 0;
      }
      .recipe-sheet {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="no-print print-dialog-wrapper">
    <div class="print-dialog-text">
       📄 <strong>Tiskový lístek s receptem připraven!</strong> Okno pro uložení do <strong>PDF</strong> se otevře automaticky. Pokud ne, klikněte na tlačítko níže.
    </div>
    <button class="btn-print" onclick="window.print()">
      <span>🖨️ Spustit tisk / Uložit jako PDF</span>
    </button>
  </div>

  <div class="recipe-sheet">
    <div class="recipe-sheet-wrapper">
      <div class="sheet-header">
        <div class="meta-brand">AI KUCHAŘKA • 5 PILÍŘOVÁ SYNTÉZA VĚDY A GASTRONOMIE</div>
        <h1 class="recipe-title">${title}</h1>
        <span class="recipe-category">${category}</span>
      </div>

      <div class="parameters-grid">
        <div class="param-item">
          <span class="param-label">Doba přípravy</span>
          <span class="param-value">${cookingTime}</span>
        </div>
        <div class="param-item">
          <span class="param-label">Náročnost</span>
          <span class="param-value">${difficulty}</span>
        </div>
        <div class="param-item">
          <span class="param-label">Spotřebič</span>
          <span class="param-value">${applianceType}</span>
        </div>
        <div class="param-item">
          <span class="param-label">Vědecká kvalita</span>
          <span class="param-value" style="color: #10B981;">100% Chef-Tech ✓</span>
        </div>
      </div>

      <div class="summary-text">
        ${summary}
      </div>

      <h2 class="section-title">Seznam ingrediencí</h2>
      <ul class="ingredients-list">
        ${ingredientsHtml}
      </ul>

      <h2 class="section-title">Postup přípravy kuchařské chemie</h2>
      <div style="margin-bottom: 30px;">
        ${instructionsHtml}
      </div>

      <div class="expert-block">
        <h4>💡 Chytrá technologie & Tip pro ${applianceType}</h4>
        <div style="line-height:1.55;">${applianceTips}</div>
      </div>

      <div class="expert-block" style="background-color: #EBF7F2; border-color: #D3EFEB;">
        <h4 style="color: #026C52;">🔬 Kulinářská chemie & Vědecká syntéza</h4>
        <div style="line-height:1.55; color: #164E41;">${expertJustification}</div>
      </div>

      <div class="footer-stamp">
        <span>AI Kuchařka • Stabilita, chuť a gastronomické inženýrství</span>
        <span>Generováno dne: ${new Date().toLocaleDateString("cs-CZ")}</span>
      </div>
    </div>
  </div>

  <script>
    // Automatically trigger the browser's printing dialog after load
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    // Download the self-printing template
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-recept.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Provide premium UI feedback
    setPrintNotice("Tiskový lístek byl stažen! Pro tisk / uložení do PDF stačí otevřít stažený soubor.");
    setTimeout(() => {
      setPrintNotice(null);
    }, 7000);
  };

  // Safe compiler checklist for local wrapped function reference
  if (false as any) {
    unused_code_wrapper();
  }

  // Loading steps animation texts
  const loadingSteps = [
    "Analyzuji potravinové a chemické vlastnosti ingrediencí (Pilíř 1: Věda)...",
    "Přejímám tajné postupy z michelinských kuchařských akademií (Pilíř 2: Mistrovská technika)...",
    "Porovnávám optimální poměry koření ze světových online databází (Pilíř 3: Statistiky chuti)...",
    "Skenuji fóra pro odhalení nejčastějších chyb domácích kuchařů (Pilíř 4: Prevence nezdarů)...",
    "Přepočítávám správné časy, teploty a výkony pro moderní spotřebiče (Pilíř 5: Inženýrství)...",
    "Sestavuji přehlednou kuchařku s odborným odůvodněním..."
  ];

  // Load admin state and recipes (dynamic remote URL with local storage fallbacks)
  useEffect(() => {
    // Load admin state from localStorage
    const savedAdminToken = localStorage.getItem("admin_password_token");
    if (savedAdminToken) {
      setIsAdmin(true);
      setAdminPassword(savedAdminToken);
    }

    const loadRecipes = async () => {
      let loadedList: Recipe[] | null = null;

      // 1. Prioritize loading from Serverless API /api/recipes (using custom GitHub headers if available)
      try {
        const headers: Record<string, string> = {};
        const storedUser = localStorage.getItem("ai_kucharka_github_username") || "ambrus-k";
        const storedRepo = localStorage.getItem("ai_kucharka_github_repo") || "ai-kucharka";
        const storedBranch = localStorage.getItem("ai_kucharka_github_branch") || "main";
        const storedToken = localStorage.getItem("ai_kucharka_github_token") || "";

        if (storedUser) headers["x-github-username"] = storedUser;
        if (storedRepo) headers["x-github-repo"] = storedRepo;
        if (storedBranch) headers["x-github-branch"] = storedBranch;
        if (storedToken) headers["x-github-token"] = storedToken;

        const serverlessResponse = await fetch("/api/recipes", { headers });
        if (serverlessResponse.ok) {
          const data = await serverlessResponse.json();
          const list = Array.isArray(data) ? data : (data.recipes || []);
          setServerlessApiSuccess(true);
          setServerlessApiError(null);
          if (list && list.length > 0) {
            loadedList = list;
            console.log("Úspěšně načteny aktuální recepty ze Serverless API /api/recipes");
          } else {
            console.log("Serverless API /api/recipes vrátil prázdný seznam receptů.");
          }
        } else {
          const errData = await serverlessResponse.json().catch(() => ({}));
          const errMsg = errData.error || `Server vrátil status kód: ${serverlessResponse.status}`;
          setServerlessApiError(errMsg);
          console.error("Serverless API error:", errMsg);
        }
      } catch (error: any) {
        setServerlessApiError(error?.message || "Nelze se připojit k Serverless API.");
        console.log("Nepodařilo se stáhnout data přes /api/recipes, zkusíme další zdroje...", error);
      }

      // 2. Fallback to localStorage (only if online retrieval failed due to network / error)
      if (loadedList === null) {
        const stored = localStorage.getItem("ai_kucharka_recipes");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedList = parsed;
              console.log("Načteny uložené recepty z lokálního úložiště prohlížeče (offline režim).");
            }
          } catch (e) {
            console.error("Chyba při čtení receptů z lokálního úložiště", e);
          }
        }
      }

      // 3. Fallback to local default recipes
      if (loadedList === null) {
        loadedList = LOCAL_FALLBACK;
        console.log("Použity výchozí vestavěné recepty.");
      }

      // Save and set
      const cleaned = loadedList.map(removePreservativesFromSoup);
      setRecipes(cleaned);
      setSelectedRecipe(prev => {
        if (prev) {
          const matching = cleaned.find(r => r.id === prev.id);
          if (matching) return matching;
        }
        return cleaned[0] || null;
      });
      localStorage.setItem("ai_kucharka_recipes", JSON.stringify(cleaned));
      localStorage.setItem("ai_kucharka_initialized", "true");
    };

    loadRecipes();
  }, []);

  // Save recipes to localStorage whenever they change
  const saveRecipesToStorage = async (newRecipes: Recipe[], targetRecipe?: Recipe, isDelete = false) => {
    const cleaned = newRecipes.map(removePreservativesFromSoup);
    setRecipes(cleaned);
    localStorage.setItem("ai_kucharka_recipes", JSON.stringify(cleaned));

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      const storedUser = localStorage.getItem("ai_kucharka_github_username") || "ambrus-k";
      const storedRepo = localStorage.getItem("ai_kucharka_github_repo") || "ai-kucharka";
      const storedBranch = localStorage.getItem("ai_kucharka_github_branch") || "main";
      const storedToken = localStorage.getItem("ai_kucharka_github_token") || "";

      if (storedUser) headers["x-github-username"] = storedUser;
      if (storedRepo) headers["x-github-repo"] = storedRepo;
      if (storedBranch) headers["x-github-branch"] = storedBranch;
      if (storedToken) headers["x-github-token"] = storedToken;

      const response = await fetch("/api/recipes", {
        method: "POST",
        headers,
        body: JSON.stringify({ recipes: cleaned, adminPassword })
      });
      if (response.ok) {
        console.log("Změny kuchařky byly automaticky uloženy online!");
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn(`Chyba ukládání online (Status: ${response.status}):`, errData.error || "");
      }
    } catch (e) {
      console.error("Nepodařilo se odeslat uložení online:", e);
    }
  };

  // Reset checkboxes when selected recipe changes
  useEffect(() => {
    setCheckedIngredients({});
    setCheckedInstructions({});
    setIsEditing(false);
    setShowExportView(false);
    setCopiedText(false);
  }, [selectedRecipe]);

  // Loading timer simulation
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < loadingSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // File parsing converting to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage("Soubor je příliš velký (limit je 12 MB). Zvolte prosím menší soubor.");
      return;
    }

    setFileName(file.name);
    setMimeType(file.type);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFileData(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Nepodařilo se přečíst nahraný soubor.");
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setFileData(null);
    setFileName(null);
    setMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Enhance recipe action via Express backend
  const handleEnhanceRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim() && !fileData) {
      setErrorMessage("Prosím, vložte text receptu nebo nahrajte obrázek/soubor.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/enhance-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText,
          fileData,
          fileName,
          mimeType,
          adminPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Při vylepšování receptu se vyskytla chyba.");
      }

      const data = await response.json();
      if (!data.recipe) {
        throw new Error("Server nevrátil platný recept.");
      }

      // Add to recipes list & select it
      const newRecipe: Recipe = {
        ...data.recipe,
        updatedAt: new Date().toISOString()
      };
      const updatedRecipes = [newRecipe, ...recipes];
      saveRecipesToStorage(updatedRecipes, newRecipe);
      setSelectedRecipe(newRecipe);

      // Clean inputs
      setRawText("");
      removeFile();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Nepodařilo se spojit se serverem AI Kuchařky.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecipe = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecipeToDelete(id);
  };

  const confirmDeleteRecipe = () => {
    if (recipeToDelete) {
      const targetDel = recipes.find(r => r.id === recipeToDelete);
      const updated = recipes.filter(r => r.id !== recipeToDelete);
      saveRecipesToStorage(updated, targetDel, true);
      if (selectedRecipe?.id === recipeToDelete) {
        setSelectedRecipe(updated[0] || null);
      }
      setRecipeToDelete(null);
    }
  };

  const handleExportBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recipes, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "kucharka_zaloha_receptu.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error("Failed to export backup", e);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(item => item && typeof item === 'object' && typeof item.title === 'string');
          if (valid.length > 0) {
            const confirmImport = confirm(`Opravdu chcete importovat ${valid.length} receptů? Tato akce nahradí váš současný seznam receptů.`);
            if (confirmImport) {
              saveRecipesToStorage(valid);
              setSelectedRecipe(valid[0] || null);
            }
          } else {
            alert("Vybraný soubor neobsahuje platné recepty.");
          }
        } else {
          alert("Neplatný formát souboru se zálohou.");
        }
      } catch (err) {
        alert("Nepodařilo se přečíst soubor se zálohou. Ujistěte se, že jde o správný JSON soubor.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Filter and search computation
  const filteredRecipes = recipes.filter(recipe => {
    // Kolonku hledat (Title or Summary)
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          recipe.summary.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const toggleIngredient = (ing: string) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [ing]: !prev[ing]
    }));
  };

  const toggleInstruction = (index: number) => {
    setCheckedInstructions(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-[#2C2C2C] font-sans flex flex-col antialiased">
      {/* FLOATING PRINT / PDF STATUS NOTICE */}
      <AnimatePresence>
        {printNotice && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            style={{ zIndex: 99999 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-emerald-900 text-white border border-emerald-800/80 rounded-2xl shadow-xl p-4 flex items-start gap-3 pointer-events-auto"
          >
            <div className="bg-emerald-800 text-white p-2 rounded-xl shrink-0">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-emerald-300">Tisk & PDF spuštěno</h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                {printNotice}
              </p>
            </div>
            <button
              onClick={() => setPrintNotice(null)}
              className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-emerald-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HANDS-FREE COOKING MODE OVERLAY */}
      <AnimatePresence>
        {isHandsFree && selectedRecipe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden select-none"
          >
            {/* Header section */}
            <div className="bg-slate-900 border-b border-slate-800 py-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-600 text-white p-2 rounded-xl">
                  <ChefHat className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="font-serif italic font-bold text-lg md:text-xl text-amber-500">
                    {selectedRecipe.title}
                  </h2>
                  <p className="text-[10px] uppercase text-slate-400 tracking-wider font-semibold">
                    Režim vaření (Hands-free)
                  </p>
                </div>
              </div>

              {/* Wake Lock Status Indicator */}
              <div className="hidden md:flex items-center gap-4 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 relative">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {wakeLockSupported && wakeLock && !wakeLockError ? (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 absolute" />
                      <span className="text-emerald-400 ml-1">✓ Displej nezhasne (Aktivní)</span>
                    </>
                  ) : wakeLockError ? (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-amber-400">Displej se může vypnout (Preview omezení)</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-450" />
                      <span className="text-amber-400">Automatické zhasínání displeje nelze zablokovat</span>
                    </>
                  )}
                </div>
                {wakeLockError && (
                  <span className="text-[10px] text-amber-300 border-l border-slate-800 pl-3 max-w-[320px] truncate" title={wakeLockError}>
                    {wakeLockError}
                  </span>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={stopHandsFree}
                className="bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 p-2.5 rounded-xl transition-all border border-slate-700 hover:border-red-900 cursor-pointer"
                title="Zavřít režim vaření"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile-only Wake Lock Status bar */}
            <div className="md:hidden bg-slate-900/60 border-b border-slate-800/40 px-6 py-2 flex items-center justify-center gap-2 text-center text-[11px] font-semibold">
              {wakeLockSupported && wakeLock && !wakeLockError ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400">Předcházím zhasnutí displeje (Aktivní)</span>
                </>
              ) : wakeLockError ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-amber-400">Dočasně vypnuto (Blokováno v náhledu iframe)</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-amber-400">Displej se může automaticky vypnout</span>
                </>
              )}
            </div>

            {/* Instruction content card */}
            <div className="flex-1 overflow-y-auto px-6 py-8 md:p-12 flex flex-col justify-center items-center">
              <div className="max-w-4xl w-full space-y-6 md:space-y-8 flex flex-col items-center">
                
                {/* Step Indicator */}
                <div className="text-center space-y-1">
                  <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-amber-500">
                    KROK {currentHandsFreeStep + 1} Z {selectedRecipe.instructions.length}
                  </span>
                  
                  {/* Visual Steps Dots */}
                  <div className="flex items-center gap-1.5 mt-3 justify-center">
                    {selectedRecipe.instructions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentHandsFreeStep(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === currentHandsFreeStep 
                            ? "w-8 bg-amber-500" 
                            : !!checkedInstructions[idx] 
                              ? "w-2 bg-emerald-500" 
                              : "w-2 bg-slate-800 hover:bg-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Subtitle / Tip fallback */}
                <div className="w-full bg-slate-900/40 border border-slate-850 rounded-2xl p-6 shadow-inner text-center">
                  <motion.p
                    key={currentHandsFreeStep}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl md:text-3xl lg:text-4xl font-serif text-slate-100 font-medium leading-relaxed md:leading-relaxed tracking-wide"
                  >
                    {selectedRecipe.instructions[currentHandsFreeStep]}
                  </motion.p>
                </div>

                {/* Real-time Step Ingredients and Weights Checklist */}
                {(() => {
                  const allIngs = getStepIngredients(
                    selectedRecipe.instructions[currentHandsFreeStep] || "",
                    selectedRecipe.ingredients || [],
                    scaleFactor
                  );
                  const matchedIngs = allIngs.filter(i => i.isMatched);

                  return (
                    <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4 animate-fade-in" id="step-ingredients-box">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <Scale className="h-5 w-5 text-amber-500 shrink-0" />
                          <div>
                            <h3 className="font-bold text-sm text-slate-200">Suroviny a váhy pro tento krok</h3>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Metrické váhy jsou automaticky přepočítané</p>
                          </div>
                        </div>
                        {scaleFactor !== 1 && (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0">
                            Koeficient: {scaleFactor}x
                          </span>
                        )}
                      </div>

                      {matchedIngs.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {matchedIngs.map((ing, i) => {
                            const isChecked = !!checkedIngredients[ing.original];
                            return (
                              <div
                                key={i}
                                onClick={() => toggleIngredient(ing.original)}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                  isChecked
                                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                                    : "bg-slate-950/40 border-slate-850 text-slate-350 hover:bg-slate-950/60 hover:border-slate-800"
                                }`}
                              >
                                <div className={`mt-0.5 h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  isChecked
                                    ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                    : "border-slate-700"
                                }`}>
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className={`text-sm leading-tight ${isChecked ? "line-through text-slate-500 font-medium" : "font-semibold"}`}>
                                  {ing.display}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-5 bg-slate-950/20 rounded-xl border border-dashed border-slate-800/60">
                          <p className="text-xs text-slate-400 font-medium font-serif italic">
                            V popisu tohoto kroku nebyly nalezeny žádné konkrétní suroviny.
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Všechny suroviny a jejich váhy si můžete zobrazit rozkliknutím seznamu níže.
                          </p>
                        </div>
                      )}

                      {/* Collapsible section for all ingredients in the recipe */}
                      <div className="pt-2 border-t border-slate-800/40">
                        <button
                          onClick={() => setShowAllIngredientsInStep(prev => !prev)}
                          className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 py-1.5 transition-all focus:outline-none cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span>{showAllIngredientsInStep ? "Skrýt" : "Zobrazit"} kompletní suroviny receptu</span>
                            <span className="bg-slate-800 text-[10px] text-slate-350 px-1.5 py-0.5 rounded font-mono">
                              {selectedRecipe.ingredients ? selectedRecipe.ingredients.length : 0}
                            </span>
                          </span>
                          <span className={`transform transition-transform duration-200 ${showAllIngredientsInStep ? "rotate-180" : ""}`}>
                            ▼
                          </span>
                        </button>
                        
                        {showAllIngredientsInStep && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 animate-fade-in">
                            {allIngs.map((ing, i) => {
                              const isChecked = !!checkedIngredients[ing.original];
                              return (
                                <div
                                  key={i}
                                  onClick={() => toggleIngredient(ing.original)}
                                  className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                                    isChecked
                                      ? "bg-emerald-950/10 border-emerald-500/20 text-emerald-400/90"
                                      : ing.isMatched
                                      ? "bg-[#D97706]/5 border-[#D97706]/20 text-amber-200/95 font-semibold"
                                      : "bg-slate-950/35 border-slate-850/80 text-slate-400 hover:bg-slate-950/50"
                                  }`}
                                >
                                  <div className={`mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                    isChecked
                                      ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                      : "border-slate-800"
                                  }`}>
                                    {isChecked && <Check className="h-2 w-2 stroke-[3]" />}
                                  </div>
                                  <span className={`leading-tight flex-1 ${isChecked ? "line-through text-slate-500" : ""}`}>
                                    {ing.display} {ing.isMatched && !isChecked && <span className="text-[9px] uppercase tracking-wider text-amber-500 font-extrabold ml-1">(Tento krok)</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Step Completed Button in Center */}
                <button
                  onClick={() => toggleInstruction(currentHandsFreeStep)}
                  className={`mt-4 flex items-center gap-2.5 px-6 py-3.5 rounded-full border text-sm font-extrabold transition-all cursor-pointer shadow-md ${
                    !!checkedInstructions[currentHandsFreeStep]
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/60"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white"
                  }`}
                >
                  <Check className={`h-4.5 w-4.5 stroke-[2.5] ${!!checkedInstructions[currentHandsFreeStep] ? "text-emerald-400" : "text-slate-500"}`} />
                  <span>
                    {!!checkedInstructions[currentHandsFreeStep] 
                      ? "Splněno" 
                      : "Označit jako hotové"
                    }
                  </span>
                </button>

              </div>
            </div>

            {/* Tactile Bottom Navigation Buttons */}
            <div className="bg-slate-900 border-t border-slate-800 py-4 px-6 flex items-center justify-between">
              
              {/* Prev Button */}
              <button
                onClick={prevHandsFreeStep}
                disabled={currentHandsFreeStep === 0}
                className={`py-3 px-5 rounded-2xl font-bold flex items-center gap-1.5 transition-all text-sm border cursor-pointer ${
                  currentHandsFreeStep === 0
                    ? "bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed"
                    : "bg-slate-850 hover:bg-slate-850/80 text-slate-200 border-slate-750"
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Předchozí krok</span>
              </button>

              {/* Summary progress bar */}
              <div className="text-center flex flex-col items-center justify-center">
                <span className="text-xs font-mono text-slate-400 font-bold">
                  {Math.round(((currentHandsFreeStep + 1)/selectedRecipe.instructions.length) * 100)} % HOTOVO
                </span>
                <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 max-w-[120px]">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${((currentHandsFreeStep + 1)/selectedRecipe.instructions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Next/Finish Button */}
              {currentHandsFreeStep === selectedRecipe.instructions.length - 1 ? (
                <button
                  onClick={stopHandsFree}
                  className="bg-emerald-600 hover:bg-emerald-500 py-3 px-6 rounded-2xl font-extrabold flex items-center gap-1.5 text-sm transition-all shadow-lg hover:shadow-emerald-950/30 text-white cursor-pointer"
                >
                  <Check className="h-5 w-5 stroke-[2.5]" />
                  <span>Dokončit vaření</span>
                </button>
              ) : (
                <button
                  onClick={nextHandsFreeStep}
                  className="bg-amber-600 hover:bg-amber-500 py-3 px-5 rounded-2xl font-bold flex items-center gap-1.5 text-sm transition-all text-white shadow-md cursor-pointer"
                >
                  <span className="hidden sm:inline">Další krok</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="no-print bg-white border-b border-[#E8E8E1] py-4 px-6 sticky top-0 z-40 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#1B4332] text-white p-2 rounded-xl shadow-md">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif italic font-semibold text-2xl text-[#1B4332] flex items-center gap-2">
              AI Kuchařka
              <span className="text-[10px] bg-[#F0F4F1] text-[#2D6A4F] border border-[#2D6A4F]/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                5x Pilířová Syntéza
              </span>
            </h1>
            <p className="text-xs text-[#5C5C50] hidden sm:block font-medium">Vědecky podložená a technologicky vyladěná gastronomie</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => {
                setSelectedRecipe(null);
                setErrorMessage(null);
                setIsEditing(false);
              }}
              className="bg-[#D97706] hover:bg-[#C26405] active:scale-95 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-sm cursor-pointer animate-fade-in"
              title="Nový recept"
            >
              <Plus className="h-4 w-4" />
              <span>Nový recept</span>
            </button>
          )}
        </div>
      </header>

      {/* BODY WORKSPACE */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col md:flex-row gap-0 overflow-hidden relative">
        
        {/* LEFT SIDEBAR: RECIPE LIST */}
        <aside className="no-print w-full md:w-80 lg:w-96 border-r border-[#E8E8E1] bg-white flex flex-col flex-shrink-0">
          
          {/* ADMINISTRÁTORSKÝ STATUS BANNER */}
          {(() => {
            if (isAdmin) {
              return (
                <div className="p-4 bg-emerald-50 border-b border-emerald-200 text-emerald-800 space-y-1.5 no-print animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Režim Administrace</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdmin(false);
                        setAdminPassword("");
                        localStorage.removeItem("admin_password_token");
                      }}
                      className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer"
                    >
                      Odhlásit se
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Máte plný přístup ke správě receptů. Změny se ukládají automaticky online.
                  </p>
                </div>
              );
            } else {
              return (
                <div className="p-4 bg-[#FDFCF7] border-b border-[#E8E8E1] text-[#4A4A40] space-y-2 no-print animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1B4332]">
                      <Info className="h-4 w-4 shrink-0 text-[#2D6A4F] mt-0.5" />
                      <span>Prohlížecí režim</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer"
                    >
                      Přihlásit se
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-95 text-slate-500">
                    Recepty jsou pouze pro čtení. Pro editaci, mazání nebo tvorbu nových se přihlaste jako administrátor.
                  </p>
                </div>
              );
            }
          })()}

          {/* SEARCH & FILTER CONTROLS */}
          <div className="p-4 border-b border-[#E8E8E1] bg-[#FDFCF7]/60 flex flex-col gap-3">
            {/* Kolonka: Hlavní vyhledávání */}
            <div className="space-y-1">
              <label htmlFor="search-main" className="block text-[10px] font-bold text-[#1B4332] uppercase tracking-wider pl-1">
                Hledat v receptech
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#9A9A8C]">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  id="search-main"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Např. svíčková, bůček, guláš..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[#E8E8E1] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] focus:border-[#1B4332] text-[#2C2C2C] placeholder-[#9A9A8C] shadow-xs"
                />
              </div>
            </div>

            {/* SIDEBAR TABS: CATEGORIES VS ALPHABETICAL */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F0] rounded-xl border border-[#E8E8E1] mt-1">
              <button
                type="button"
                onClick={() => setSidebarViewMode("druh")}
                className={`text-xs py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  sidebarViewMode === "druh"
                    ? "bg-[#1B4332] text-white shadow-xs"
                    : "text-[#5C5C50] hover:text-[#1B4332] hover:bg-white/40"
                }`}
              >
                <span>Podle druhu</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarViewMode("abeceda")}
                className={`text-xs py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  sidebarViewMode === "abeceda"
                    ? "bg-[#1B4332] text-white shadow-xs"
                    : "text-[#5C5C50] hover:text-[#1B4332] hover:bg-white/40"
                }`}
              >
                <span>Podle abecedy</span>
              </button>
            </div>
          </div>

          {/* HISTORICAL & DEFAULT RECIPES LIST WITH ALPHABETICAL ACCORDIONS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* AI Generation Link directly in Sidebar */}
            {isAdmin && (
              <button
                onClick={() => {
                  setSelectedRecipe(null);
                  setErrorMessage(null);
                  setIsEditing(false);
                }}
                className="w-full bg-gradient-to-r from-amber-600 to-[#D97706] hover:from-amber-700 hover:to-[#C26405] active:scale-95 text-white font-bold py-3 px-4 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 text-[13px] cursor-pointer mb-2 animate-pulse-subtle"
                title="Přidat recept"
              >
                <Sparkles className="h-4 w-4 text-amber-200 shrink-0" />
                <span>Přidat recept (AI & 5 pilířů ověření)</span>
              </button>
            )}

            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#9A9A8C] font-bold px-1 mb-1">
              <div className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                <span>Recepty ({filteredRecipes.length})</span>
              </div>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="text-[10px] text-[#D97706] hover:underline font-bold"
                >
                  Vymazat filtry
                </button>
              )}
            </div>

            {filteredRecipes.length === 0 ? (
              <div className="text-center py-8 px-4 text-[#9A9A8C] bg-[#FDFCF7] rounded-xl border border-dashed border-[#E8E8E1]">
                <p className="text-sm font-medium">Nebyly nalezeny žádné recepty.</p>
                <button 
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-[#D97706] hover:underline font-semibold"
                >
                  Zrušit filtry
                </button>
              </div>
            ) : (() => {
              if (sidebarViewMode === "druh") {
                // Group recipes by getRecipeCategory
                const grouped: Record<string, Recipe[]> = {};
                filteredRecipes.forEach(recipe => {
                  const cat = getRecipeCategory(recipe);
                  if (!grouped[cat]) {
                    grouped[cat] = [];
                  }
                  grouped[cat].push(recipe);
                });

                // Sort categories
                const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "cs"));

                return (
                  <div className="space-y-3">
                    {categories.map(category => {
                      const recs = grouped[category];
                      const sortedRecs = [...recs].sort((a, b) => a.title.localeCompare(b.title, "cs"));
                      const isCollapsed = collapsedCategories[category] === true;

                      return (
                        <div key={category} className="space-y-1 bg-[#FDFCF7]/40 border border-[#E8E8E1]/40 rounded-xl p-1.5">
                          <button
                            onClick={() => {
                              setCollapsedCategories(prev => ({
                                ...prev,
                                [category]: !prev[category]
                              }));
                            }}
                            className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-[#F5F5F0] rounded-lg transition-colors text-left font-sans font-bold text-xs text-[#1B4332]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-base leading-none shrink-0">
                                {category === "Pečivo" ? "🍞" : category === "Maso" ? "🥩" : category === "Polévky" ? "🥣" : category === "Sladká jídla a moučníky" ? "🍰" : "🍽️"}
                              </span>
                              <span className="truncate">{category}</span>
                              <span className="text-[10px] font-sans text-white font-bold bg-[#2D6A4F] px-1.5 py-0.2 rounded-full shrink-0">
                                {sortedRecs.length}
                              </span>
                            </div>
                            <div className="text-[#9A9A8C]">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </button>

                          {!isCollapsed && (
                            <div className="space-y-1 pt-1 pl-1 pr-1">
                              {sortedRecs.map((recipe) => {
                                const isSelected = selectedRecipe?.id === recipe.id;
                                return (
                                  <div
                                    key={recipe.id}
                                    onClick={() => {
                                      setSelectedRecipe(recipe);
                                      setErrorMessage(null);
                                      window.scrollTo({ top: document.getElementById('main-area')?.offsetTop || 0, behavior: 'smooth' });
                                    }}
                                    className={`group relative py-1.5 px-2.5 rounded-md border transition-all duration-200 cursor-pointer ${
                                      isSelected
                                        ? "bg-[#F0F4F1] border-[#2D6A4F] shadow-sm"
                                        : "bg-white border-[#E8E8E1] hover:bg-[#FDFCF7]"
                                    }`}
                                  >
                                    <div className="flex flex-col justify-center min-h-[1.75rem] pr-6">
                                      <h3 className={`font-semibold text-xs line-clamp-2 transition-colors leading-snug ${
                                        isSelected ? "text-[#1B4332]" : "text-slate-900 group-hover:text-[#1B4332]"
                                      }`}>
                                        {recipe.title}
                                      </h3>
                                    </div>

                                    <button
                                      id={`btn-delete-recipe-chrono-${recipe.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRecipe(recipe.id, e);
                                      }}
                                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer"
                                      title="Smazat recept"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                // Alphabetical Mode
                const grouped: Record<string, Recipe[]> = {};
                filteredRecipes.forEach(recipe => {
                  const firstChar = recipe.title.trim().charAt(0).toUpperCase();
                  const groupKey = firstChar || "#";
                  if (!grouped[groupKey]) {
                    grouped[groupKey] = [];
                  }
                  grouped[groupKey].push(recipe);
                });

                const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "cs"));

                return (
                  <div className="space-y-3">
                    {letters.map(letter => {
                      const recs = grouped[letter];
                      const sortedRecs = [...recs].sort((a, b) => a.title.localeCompare(b.title, "cs"));
                      const isCollapsed = collapsedAlphabet[letter] === true;

                      return (
                        <div key={letter} className="space-y-1 bg-[#FDFCF7]/40 border border-[#E8E8E1]/40 rounded-xl p-1.5">
                          <button
                            onClick={() => {
                              setCollapsedAlphabet(prev => ({
                                ...prev,
                                [letter]: !prev[letter]
                              }));
                            }}
                            className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-[#F5F5F0] rounded-lg transition-colors text-left font-sans font-bold text-xs text-[#1B4332]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 flex items-center justify-center font-extrabold text-[11px] bg-[#1B4332] text-white rounded-md shrink-0">
                                {letter}
                              </span>
                              <span className="truncate">Recepty od "{letter}"</span>
                              <span className="text-[10px] font-sans text-white font-bold bg-[#2D6A4F] px-1.5 py-0.2 rounded-full shrink-0">
                                {sortedRecs.length}
                              </span>
                            </div>
                            <div className="text-[#9A9A8C]">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </button>

                          {!isCollapsed && (
                            <div className="space-y-1 pt-1 pl-1 pr-1">
                              {sortedRecs.map((recipe) => {
                                const isSelected = selectedRecipe?.id === recipe.id;
                                return (
                                  <div
                                    key={recipe.id}
                                    onClick={() => {
                                      setSelectedRecipe(recipe);
                                      setErrorMessage(null);
                                      window.scrollTo({ top: document.getElementById('main-area')?.offsetTop || 0, behavior: 'smooth' });
                                    }}
                                    className={`group relative py-1.5 px-2.5 rounded-md border transition-all duration-200 cursor-pointer ${
                                      isSelected
                                        ? "bg-[#F0F4F1] border-[#2D6A4F] shadow-sm"
                                        : "bg-white border-[#E8E8E1] hover:bg-[#FDFCF7]"
                                    }`}
                                  >
                                    <div className="flex flex-col justify-center min-h-[1.75rem] pr-6">
                                      <h3 className={`font-semibold text-xs line-clamp-2 transition-colors leading-snug ${
                                        isSelected ? "text-[#1B4332]" : "text-slate-900 group-hover:text-[#1B4332]"
                                      }`}>
                                        {recipe.title}
                                      </h3>
                                    </div>

                                    <button
                                      id={`btn-delete-recipe-alpha-${recipe.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRecipe(recipe.id, e);
                                      }}
                                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer"
                                      title="Smazat recept"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }
            })()}
          </div>

          {/* SIDEBAR FOOTER METRICS INFO */}
          <div className="p-4 bg-[#F5F5F0] border-t border-[#E8E8E1] text-xs text-[#5C5C50] flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3 text-[#1B4332]" />
              <span className="font-semibold text-[#1B4332]">Odborná syntéza z 5 zdrojů:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-[#5C5C50]">
              <li>Lékařská chemie & Food Science</li>
              <li>Právo Culinary Masterclass</li>
              <li>Agregátory tisíců receptur</li>
              <li>Bezpečnostní analýza kuchařských chyb</li>
              <li>Inženýrství moderních spotřebičů</li>
            </ul>

            {/* BACKUP & RESTORE OF RECIPES */}
            <div className="mt-2 pt-2 border-t border-[#E8E8E1] flex flex-col gap-1.5">
              <span className="font-semibold text-[10px] text-[#1B4332] uppercase tracking-wider">Záloha a přenos receptů:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-2 py-1 bg-white hover:bg-[#FDFCF7] border border-[#E8E8E1] rounded-md text-[10px] font-bold text-slate-700 hover:text-[#1B4332] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                  title="Stáhnout zálohu všech receptů jako JSON soubor"
                >
                  <Download className="h-2.5 w-2.5 text-emerald-700 font-bold" />
                  <span>Export</span>
                </button>
                <label
                  className="px-2 py-1 bg-white hover:bg-[#FDFCF7] border border-[#E8E8E1] rounded-md text-[10px] font-bold text-slate-700 hover:text-[#1B4332] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs text-center"
                  title="Nahrát zálohu receptů z JSON souboru"
                >
                  <Upload className="h-2.5 w-2.5 text-blue-700 font-bold" />
                  <span>Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE REGION */}
        <main id="main-area" className="flex-1 bg-[#FDFCF7]/50 overflow-y-auto p-4 md:p-6 lg:p-8">
          
          <AnimatePresence mode="wait">
            
            {/* 1. LOADING SCREEN STATE */}
            {isLoading ? (
              <motion.div
                key="loading-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-[#E8E8E1] shadow-md p-8 text-center flex flex-col items-center"
              >
                {/* Simulated spinning mixer / kettle graphic */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-[#F5F5F0] border-t-[#1B4332] animate-spin flex items-center justify-between" />
                  <div className="absolute inset-0 flex items-center justify-center text-[#1B4332]">
                    <ChefHat className="h-8 w-8 animate-pulse" />
                  </div>
                </div>

                <h3 className="font-serif font-bold text-xl text-[#1B4332] mb-2">Vylepšuji a přepočítávám váš recept...</h3>
                <p className="text-sm text-[#5C5C50] max-w-md mx-auto mb-6">
                  Náš gastronomický algoritmus právě vyhodnocuje složení surovin a navrhuje optimální fyzikální parametry tepelné úpravy.
                </p>

                {/* Animated changing chemical cooking step text */}
                <div className="w-full bg-[#F0F4F1] border border-[#2D6A4F]/20 rounded-lg p-4 mb-4 text-[#1B4332] font-semibold text-sm flex items-center gap-3 justify-center min-h-[70px]">
                  <Sparkles className="h-5 w-5 text-[#D97706] animate-bounce flex-shrink-0" />
                  <motion.p
                    key={loadingStep}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {loadingSteps[loadingStep]}
                  </motion.p>
                </div>

                <div className="w-full text-[10px] text-[#9A9A8C] uppercase tracking-widest flex items-center justify-between px-2">
                  <span>Průběh</span>
                  <span>{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)} %</span>
                </div>
                <div className="w-full bg-[#F5F5F0] h-1.5 rounded-full overflow-hidden mt-1">
                  <div 
                    className="bg-[#1B4332] h-full transition-all duration-300"
                    style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                  />
                </div>
              </motion.div>
            ) : selectedRecipe ? (
              
              /* 2. RECIPE DETAIL VIEW */
              <motion.article
                key={`recipe-${selectedRecipe.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                {/* Print and Actions Header toolbar */}
                <div className="no-print flex flex-wrap gap-2 items-center justify-between pb-2">
                  {isAdmin ? (
                    <button
                      onClick={() => {
                        setSelectedRecipe(null);
                        setErrorMessage(null);
                        setIsEditing(false);
                      }}
                      className="text-base text-slate-600 hover:text-amber-700 font-semibold flex items-center gap-1.5 py-1 px-2.5 hover:bg-slate-100/80 rounded-lg transition-all cursor-pointer"
                    >
                      ← Vložit jiný recept / Nový
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    {!isEditing && isAdmin && (
                      <>
                        <button
                          onClick={handleAuditRecipe}
                          disabled={isAuditing}
                          className={`font-bold py-2 px-4 rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-2 text-sm cursor-pointer ${
                            isAuditing
                              ? "bg-amber-100 text-amber-800 border border-amber-200 cursor-not-allowed"
                              : "bg-[#2D6A4F] hover:bg-[#1B4332] text-white"
                          }`}
                        >
                          <Cpu className={`h-4 w-4 ${isAuditing ? "animate-spin" : ""}`} />
                          <span>{isAuditing ? "Simuluji..." : "Kontrola receptu"}</span>
                        </button>
                        <button
                          onClick={startEditingRecipe}
                          className="bg-white border border-[#1B4332] text-[#1B4332] hover:bg-emerald-50 font-bold py-2 px-4 rounded-xl shadow-xs hover:shadow-xs transition-all flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Upravit recept</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={startHandsFree}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <ChefHat className="h-4 w-4" />
                      <span>Režim vaření (Hands-free)</span>
                    </button>

                    <button
                      onClick={() => setShowExportView(true)}
                      className="bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] font-bold py-2 px-4 rounded-xl shadow-xs hover:shadow-xs transition-all flex items-center gap-2 text-sm cursor-pointer"
                      title="Export kuchařského receptu pro tisk, kopírování, TXT nebo PDF archivaci"
                    >
                      <FileText className="h-4 w-4 text-[#D97706]" />
                      <span>export receptu</span>
                    </button>
                    
                    {isAdmin && (
                      <button
                        id={`btn-delete-recipe-detail-${selectedRecipe.id}`}
                        onClick={(e) => handleDeleteRecipe(selectedRecipe.id, e)}
                        className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-100 font-semibold p-2 rounded-xl transition-all cursor-pointer"
                        title="Smazat recept"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  /* 2B. EDIT RECIPE CARD SYSTEM */
                  <div className="bg-white border border-[#E8E8E1] rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
                    
                    {/* Header with Title and Cancel button */}
                    <div className="border-b border-[#E8E8E1] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="font-serif font-bold text-2xl text-[#1B4332]">Upravit recept</h3>
                        <p className="text-xs text-[#5C5C50] mt-1">Můžete změnit hodnoty ručně nebo zadat libovolné pokyny pro automatickou AI transformaci.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="self-start sm:self-center text-xs font-semibold text-[#5C5C50] hover:text-red-500 bg-[#F5F5F0] hover:bg-red-50 border border-[#E8E8E1] hover:border-red-100 py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                      >
                        Zrušit změny
                      </button>
                    </div>

                    {/* AI INTUITIVE MODIFICATION PORTAL */}
                    <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-5 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 text-[#92400E]">
                        <Sparkles className="h-5 w-5 text-[#D97706] animate-pulse" />
                        <h4 className="font-bold text-sm uppercase tracking-wider">AI Rychlé úpravy receptu (Svěřte to asistentce)</h4>
                      </div>
                      <p className="text-xs text-[#B45309] leading-relaxed font-medium">
                        Napište, o jaké změny máte zájem. Můžete nechat AI přepočítat jídlo na vegetariánské/bezlepkové, přidat asijský šmrnc, snížit kalorie, upravit pálivost, či optimalizovat postupy pro jiný spotřebič.
                      </p>
                      
                      <div className="flex gap-2 flex-col sm:flex-row mt-2">
                        <input 
                          type="text"
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="Příklad: 'udělej to pikantnější, vyměň koriandr za petrželku a uprav recept pro horkovzdušnou fritézu'"
                          className="flex-1 text-sm p-3 border border-[#E8E8E1] rounded-lg bg-white placeholder-[#9A9A8C] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#D97706]"
                          disabled={isEditLoading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (editPrompt.trim()) handleAiEditRecipe();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAiEditRecipe}
                          disabled={isEditLoading || !editPrompt.trim()}
                          className="bg-[#D97706] hover:bg-[#C26405] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-lg text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                        >
                          {isEditLoading ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Upravuji...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              <span>Upravit pomocí AI</span>
                            </>
                          )}
                        </button>
                      </div>
                      {editError && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {editError}
                        </p>
                      )}

                      {editLogs.length > 0 && (
                        <div className="mt-3 bg-[#1E1E1C] border border-[#2D2D2A] rounded-xl p-3.5 font-mono text-[11px] leading-relaxed text-[#DCD1BA] shadow-inner max-h-56 overflow-y-auto space-y-1">
                          <div className="flex items-center justify-between border-b border-[#3A3A34] pb-1.5 mb-2 text-[10px] text-[#8C8273] uppercase tracking-wider font-bold">
                            <span>📡 Průběh kulinářské analýzy (živý log)</span>
                            {isEditLoading && (
                              <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 select-text">
                            {editLogs.map((log, idx) => {
                              let colorClass = "text-[#DCD1BA]";
                              if (log.includes("[SUCCESS]")) {
                                colorClass = "text-green-400 font-bold";
                              } else if (log.includes("[WARN]")) {
                                colorClass = "text-rose-400 font-bold";
                              } else if (log.includes("[PROCESS]")) {
                                colorClass = "text-amber-400";
                              } else if (log.includes("[INFO]")) {
                                colorClass = "text-sky-400";
                              }

                              return (
                                <div key={idx} className={`${colorClass} whitespace-pre-wrap`}>
                                  {log}
                                </div>
                              );
                            })}
                          </div>
                          {isEditLoading && (
                            <div className="text-amber-400 text-[10px] animate-pulse flex items-center gap-1.5 pt-0.5">
                              <span>●</span>
                              <span>Příprava dalšího kulinářského kroku...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MANUAL FIELDS */}
                    <form onSubmit={handleSaveEditedRecipe} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Title */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Název receptu</label>
                          <input 
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full text-base p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>

                        {/* Summary */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Shrnutí / Podstata vylepšení</label>
                          <textarea 
                            rows={2}
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>

                        {/* Ingredients */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Suroviny (jedna na řádek s metrickými jednotkami)</label>
                          <textarea 
                            rows={8}
                            value={editIngredientsText}
                            onChange={(e) => setEditIngredientsText(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] font-mono text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] leading-relaxed"
                            placeholder="Např.&#10;500 g kuřecích prsou&#10;2 lžíce medu"
                            required
                          />
                        </div>

                        {/* Instructions */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Návod / Postup (jeden krok na řádek)</label>
                          <textarea 
                            rows={8}
                            value={editInstructionsText}
                            onChange={(e) => setEditInstructionsText(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] leading-relaxed"
                            placeholder="Např.&#10;Marinujte kuřecí maso v připravené směsi.&#10;Pečte v předehřáté fritéze při 180 °C po dobu 15 minut."
                            required
                          />
                        </div>

                        {/* Appliance Type */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Doporučený spotřebič</label>
                          <input 
                            type="text"
                            value={editApplianceType}
                            onChange={(e) => setEditApplianceType(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>

                        {/* Cooking Time */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Doba přípravy</label>
                          <input 
                            type="text"
                            value={editCookingTime}
                            onChange={(e) => setEditCookingTime(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>

                        {/* Difficulty */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Náročnost receptu</label>
                          <select 
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                          >
                            <option value="Snadné">Snadné</option>
                            <option value="Střední">Střední</option>
                            <option value="Složité">Složité</option>
                          </select>
                        </div>

                        {/* Category selection */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Druh receptu (Kategorie)</label>
                          <select 
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                          >
                            <option value="Maso">Maso</option>
                            <option value="Pečivo">Pečivo</option>
                            <option value="Polévky">Polévky</option>
                            <option value="Sladká jídla a moučníky">Sladká jídla a moučníky</option>
                            <option value="Ostatní">Ostatní</option>
                          </select>
                        </div>

                        {/* Appliance Tips */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Tipy pro moderní kuchyni</label>
                          <textarea 
                            rows={3}
                            value={editApplianceTips}
                            onChange={(e) => setEditApplianceTips(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>

                        {/* Expert Justification */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Proč je to takto lepší? (Chemie jídla / Odůvodnění změn)</label>
                          <textarea 
                            rows={3}
                            value={editExpertJustification}
                            onChange={(e) => setEditExpertJustification(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>
                      </div>

                      {/* Action buttons at bottom of form */}
                      <div className="pt-4 border-t border-[#E8E8E1] flex items-center justify-end gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="bg-[#F5F5F0] hover:bg-[#E8E8E1] text-[#2C2C2C] font-semibold py-2.5 px-5 rounded-lg text-sm transition-all cursor-pointer border border-[#E8E8E1]"
                        >
                          Zrušit
                        </button>
                        <button
                          type="submit"
                          className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="h-4 w-4" />
                          <span>Uložit změny v receptu</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : showExportView ? (
                  /* 2C. SIMPLE TEXT FORMAT / EXPORT VIEW */
                  <div className="space-y-6 animate-fade-in print:p-0 print:m-0 print:border-none">
                    {/* Navigation bar (no-print) */}
                    <div className="no-print bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <button
                          onClick={() => setShowExportView(false)}
                          className="text-xs text-[#1B4332] hover:text-[#2D6A4F] font-bold flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg bg-[#F5F5F0] hover:bg-[#E8E8E1] border border-[#E8E8E1] transition-all self-start"
                        >
                          ← Zpět na kulinářský detail
                        </button>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Recept sepsaný v prostém textovém formátu vhodném pro tisk či kopírování.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. TXT Download file button */}
                        <button
                          onClick={() => {
                            const element = document.createElement("a");
                            const file = new Blob([generateRecipeText()], {type: 'text/plain;charset=utf-8'});
                            element.href = URL.createObjectURL(file);
                            element.download = `${selectedRecipe.title.toLowerCase().replace(/\s+/g, "_")}_recept.txt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                          className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Download className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Stáhnout TXT</span>
                        </button>

                        {/* 2. Copy button */}
                        <button
                          onClick={async () => {
                            const txt = generateRecipeText();
                            try {
                              await navigator.clipboard.writeText(txt);
                              setCopiedText(true);
                              setTimeout(() => setCopiedText(false), 2000);
                            } catch (err) {
                              const textarea = document.createElement("textarea");
                              textarea.value = txt;
                              textarea.style.position = "fixed";
                              document.body.appendChild(textarea);
                              textarea.focus();
                              textarea.select();
                              try {
                                document.execCommand("copy");
                                setCopiedText(true);
                                setTimeout(() => setCopiedText(false), 2000);
                              } catch (e) {
                                console.error("Clipboard copy failed", e);
                              }
                              document.body.removeChild(textarea);
                            }
                          }}
                          className={`${copiedText ? "bg-emerald-700 text-white" : "bg-white text-slate-700 hover:bg-slate-50"} border border-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer`}
                        >
                          <Copy className="h-4 w-4 shrink-0" />
                          <span>{copiedText ? "Zkopírováno!" : "Zkopírovat čistý text"}</span>
                        </button>

                        {/* 3. Uložit jako PDF */}
                        <button
                          onClick={downloadRecipePDF}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow-md"
                          title="Stáhnout interaktivní PDF tiskový arch"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span>Uložit jako PDF</span>
                        </button>

                        {/* 4. Tisk */}
                        <button
                          onClick={triggerNativePrint}
                          className="bg-white text-[#1B4332] hover:bg-emerald-50 border border-[#1B4332] font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                          title="Vytisknout recept přímo"
                        >
                          <Printer className="h-4 w-4 shrink-0" />
                          <span>Tisk</span>
                        </button>
                      </div>
                    </div>

                    {/* Paper Sheet Preview Container */}
                    <div className="printable-recipe-sheet bg-[#FCF9F2] border border-[#E3DDCF] rounded-2xl shadow-sm p-6 sm:p-10 text-[#2C2C2C] space-y-6">
                      
                      {/* Monospace Header Typewriter-Like */}
                      <div className="border-b border-[#D8D2C2] pb-6 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="text-[10px] sm:text-xs font-mono tracking-widest text-[#888172] uppercase font-bold">
                            RECEPT Z AI KUCHAŘKY • 5 PILÍŘOVÁ SYNTÉZA
                          </span>
                          <span className="text-[10px] sm:text-xs font-mono text-[#888172]">
                            Kategorie: {selectedRecipe.category || getRecipeCategory(selectedRecipe)}
                          </span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-serif font-black text-[#1B4332] tracking-tight">
                          {selectedRecipe.title}
                        </h2>
                      </div>

                      {/* PARAMETERS SUMMARY GRID */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b border-[#D8D2C2] text-xs sm:text-sm">
                        <div>
                          <span className="block text-[10px] font-mono uppercase text-[#888172] font-bold">Doba přípravy</span>
                          <span className="font-extrabold text-[#1B4332] text-sm sm:text-base font-serif mt-0.5">{selectedRecipe.cookingTime}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono uppercase text-[#888172] font-bold">Náročnost</span>
                          <span className="font-extrabold text-[#1B4332] text-sm sm:text-base font-serif mt-0.5">{selectedRecipe.difficulty}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono uppercase text-[#888172] font-bold">Doporučený spotřebič</span>
                          <span className="font-extrabold text-[#1B4332] text-sm sm:text-base font-serif mt-0.5">{selectedRecipe.applianceType}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono uppercase text-[#888172] font-bold">Vědecky ověřeno</span>
                          <span className="font-extrabold text-emerald-800 text-sm sm:text-base font-serif mt-0.5 flex items-center gap-1">✓ 100% Chef-Tech</span>
                        </div>
                      </div>

                      {/* DESCRIPTION */}
                      <div className="space-y-2">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1">Shrnutí receptu a chuťových vylepšení</h3>
                        <p className="text-base text-[#46463D] leading-relaxed font-serif italic">
                          {selectedRecipe.summary}
                        </p>
                      </div>

                      {/* INGREDIENTS LIST */}
                      <div className="space-y-3">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1">Seznam surovin (přesné poměry)</h3>
                        <ul className="space-y-1.5 text-base font-serif list-disc pl-5">
                          {selectedRecipe.ingredients.map((ing, i) => {
                            const parsed = parseIngredientString(ing);
                            const displayIng = scaleIngredient(parsed, scaleFactor);
                            return (
                              <li key={i} className="text-[#3A3A34]">
                                {displayIng}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* INSTRUCTIONS */}
                      <div className="space-y-4">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1">Postup přípravy (krok za krokem)</h3>
                        <div className="space-y-3.5 text-base font-serif">
                          {selectedRecipe.instructions.map((step, idx) => (
                            <div key={idx} className="flex gap-3 leading-relaxed">
                              <span className="font-mono text-[#D97706] font-bold text-base shrink-0">{idx + 1}.</span>
                              <p className="text-[#3A3A34]">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TIPS */}
                      <div className="space-y-2 pt-4 border-t border-[#D8D2C2]">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1">Inženýrství & tip pro spotřebič ({selectedRecipe.applianceType})</h3>
                        <p className="text-base text-[#3A3A34] leading-relaxed font-serif">
                          {selectedRecipe.applianceTips}
                        </p>
                      </div>

                      {/* EXPERT JUSTIFICATION / METADATA */}
                      <div className="space-y-2">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1">Věda & kuchařská chemie (Odůvodnění receptu)</h3>
                        <p className="text-base text-[#3A3A34] leading-relaxed font-serif">
                          {selectedRecipe.expertJustification}
                        </p>
                      </div>

                      {/* PARCHMENT FEET */}
                      <div className="border-t border-[#D8D2C2] pt-6 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-[#888172] gap-2">
                        <span>Stabilita, přesnost a moderní tech-gastronomie</span>
                        <span>Vygenerováno dne: {new Date().toLocaleDateString("cs-CZ")}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* AI RECIPE AUDIT AND SIMULATION PANEL */}
                    <AnimatePresence>
                      {(isAuditing || auditSteps) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6 space-y-5 overflow-hidden text-slate-100"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
                                <Cpu className="h-4 w-4 text-emerald-400 animate-pulse" />
                              </div>
                              <div>
                                <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">
                                  AI Simulátor & Kulinární Audit
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                  Virtuální replikace receptu a hledání prostoru pro vylepšení
                                </p>
                              </div>
                            </div>

                            {!isAuditing && (
                              <button
                                onClick={handleRejectAuditChange}
                                className="text-slate-400 hover:text-slate-200 p-1 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Zavřít audit"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Display Auditing Loader when no steps returned yet */}
                          {isAuditing && !auditSteps && (
                            <div className="py-8 flex flex-col items-center justify-center space-y-4">
                              <div className="relative">
                                <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                                  <Zap className="h-5 w-5 text-emerald-400" />
                                </div>
                              </div>
                              <div className="text-center space-y-1">
                                <p className="text-sm font-bold text-emerald-400">
                                  Spouštím kulinářský simulátor...
                                </p>
                                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                  Program podrobuje složení a postup receptu kulinářské simulaci, kontroluje chemii jídla a reakce.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Audit Error */}
                          {auditError && (
                            <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4 flex gap-3 text-red-200 text-sm">
                              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold">Chyba při auditu receptu</p>
                                <p className="text-xs text-red-300 mt-1">{auditError}</p>
                                <button
                                  onClick={handleAuditRecipe}
                                  className="mt-3 text-xs bg-red-900/50 hover:bg-red-800/50 px-3 py-1.5 rounded-md font-semibold border border-red-800 transition-colors cursor-pointer"
                                >
                                  Zkusit znovu
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Steps of Virtual Replication */}
                          {auditSteps && (
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <History className="h-3.5 w-3.5 text-slate-500" />
                                  Protokol z virtuální kulinářské replikace
                                </h4>
                                
                                <div className="space-y-2">
                                  {auditSteps.map((step, i) => {
                                    const isShown = i <= activeStepIndex;
                                    const isActive = i === activeStepIndex;
                                    const isCompleted = i < activeStepIndex || (!isAuditing && i === auditSteps.length - 1);
                                    
                                    if (!isShown) return null;

                                    return (
                                      <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`p-3 rounded-lg border text-xs leading-relaxed transition-all flex gap-3 ${
                                          isActive
                                            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-medium"
                                            : "bg-slate-900/40 border-slate-800/80 text-slate-300"
                                        }`}
                                      >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                          isCompleted
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                                        }`}>
                                          {isCompleted ? "✓" : i + 1}
                                        </div>
                                        <div>{step}</div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Proposed change */}
                              {!isAuditing && proposedChange && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-amber-600/10 border border-amber-500/35 rounded-xl p-4 space-y-4"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 bg-amber-500/15 rounded-lg text-amber-400 shrink-0">
                                      <Zap className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                        Navrhovaná změna na základě simulace:
                                      </h4>
                                      <p className="text-sm text-amber-100 leading-relaxed font-semibold">
                                        {proposedChange}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 text-[11px] font-mono leading-relaxed text-slate-400 space-y-1.5 shadow-inner">
                                    <div className="text-slate-300 font-bold border-b border-slate-800 pb-1 mb-1.5 text-xs">
                                      Očekávaný vliv na stávající recept:
                                    </div>
                                    {auditModifiedRecipe && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                        <div>• Nová doba: <span className="text-emerald-400 font-bold">{auditModifiedRecipe.cookingTime}</span> (původně: {selectedRecipe.cookingTime})</div>
                                        <div>• Nová náročnost: <span className="text-emerald-400 font-bold">{auditModifiedRecipe.difficulty}</span></div>
                                        <div>• Suroviny: <span className="text-emerald-400 font-bold">{auditModifiedRecipe.ingredients.length} položek</span> (původně: {selectedRecipe.ingredients.length})</div>
                                        <div>• Postup: <span className="text-emerald-400 font-bold">{auditModifiedRecipe.instructions.length} kroků</span> (původně: {selectedRecipe.instructions.length})</div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-1 flex items-center gap-3 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={handleAcceptAuditChange}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Check className="h-4 w-4 stroke-[3]" />
                                      <span>Přijmout změnu a aktualizovat recept</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleRejectAuditChange}
                                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer border border-slate-700"
                                    >
                                      Odmítnout
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 2A. MAIN RECIPE PAPER CARD WITH SYSTEMATICALLY INCREASED FONT READABILITY */}
                  <div className="bg-white border border-[#E8E8E1] rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0">
                    
                    {/* Simplified Title Header (Only the Recipe Title as requested) */}
                    <div className="border-b border-[#E8E8E1] pb-5">
                      <h2 className="text-4xl sm:text-5xl font-serif font-black text-[#1B4332] leading-tight tracking-tight">
                        {selectedRecipe.title}
                      </h2>
                    </div>

                    {/* TWO-COLUMN INGREDIENTS AND PREPARATION */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                      
                      {/* Ingredients Check-list */}
                      <div className="lg:col-span-5 space-y-4">
                        <h3 className="text-base font-bold uppercase text-[#1B4332] flex items-center gap-2 pb-3 border-b border-[#E8E8E1] tracking-wider">
                          <UtensilsCrossed className="h-5 w-5 text-[#D97706]" />
                          <span>Seznam surovin</span>
                        </h3>
                        
                        <p className="text-sm text-[#9A9A8C] italic">
                          Tip: Suroviny si při přípravě na lince odškrtávejte.
                        </p>

                        {/* Toggle button for scaling calculator */}
                        {selectedRecipe && (() => {
                          const scalable = selectedRecipe.ingredients
                            .map((ing, originalIndex) => ({ originalIndex, parsed: parseIngredientString(ing) }))
                            .filter(item => item.parsed.hasNumber && item.parsed.parsedNumber !== null);

                          return (
                            <div className="space-y-2 mb-4 bg-[#F9F9F6] border border-[#EBE6DC] rounded-xl p-3.5 shadow-xs" id="calc-container-surovin">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <button
                                    id="btn-zmena-mnozstvi-surovin"
                                    type="button"
                                    onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                                    className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-bold uppercase tracking-wider py-2 px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span>⚖️ Změna množství surovin</span>
                                    <span>{isCalculatorOpen ? "▲ Zavřít" : "▼ Otevřít"}</span>
                                  </button>
                                  <p className="text-[10px] sm:text-xs text-[#7A7A70] mt-1 font-medium">
                                    Kliknutím změníte poměry a množství všech surovin v receptu.
                                  </p>
                                </div>

                                {scaleFactor !== 1 && (
                                  <button
                                    id="btn-reset-mnozstvi"
                                    type="button"
                                    onClick={() => {
                                      setScaleFactor(1);
                                      setEditingIngredientIndex(null);
                                      setEditingValue("");
                                    }}
                                    className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold py-1 px-2.5 rounded-md transition-colors cursor-pointer border border-red-200"
                                    title="Obnovit původní množství"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              {isCalculatorOpen && (
                                <div className="mt-4 pt-3 border-t border-[#E8E8E1] space-y-2.5">
                                  {scalable.length === 0 ? (
                                    <p className="text-xs text-amber-700 font-medium">
                                      U tohoto receptu nebyly nalezeny žádné číselné suroviny k přepočtu.
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-xs text-[#5A5A4D] italic">
                                        Zadejte libovolné množství do políčka u vybrané suroviny. Celý recept se automaticky přepočítá v přesném poměru.
                                      </p>

                                      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                                        {scalable.map((item) => {
                                          const isEditingThis = editingIngredientIndex === item.originalIndex;
                                          const currentDispVal = isEditingThis
                                            ? editingValue
                                            : formatCzechNumber(item.parsed.parsedNumber! * scaleFactor);

                                          // Smartly extract cleaner ingredient name without the number and primary unit
                                          let displayIngredientLabel = item.parsed.original;
                                          let unitStr = "";

                                          if (item.parsed.hasNumber && item.parsed.numberString) {
                                            const originalText = item.parsed.original;
                                            const numText = item.parsed.numberString;
                                            
                                            const parts = originalText.split(numText);
                                            const prefixText = parts[0] || "";
                                            const suffixText = parts.slice(1).join(numText);
                                            
                                            const units = ["g", "kg", "ml", "l", "ks", "lžíce", "lžičky", "lžička", "lžíc", "stroužků", "stroužky", "stroužek", "balení", "kusů", "kusy", "kus", "plátky", "plátek", "hrnky", "hrnek", "špetka", "špetky", "kostky", "kostka", "stroužek", "stroužků"];
                                            const trimmedSuffix = suffixText.trim();
                                            const wordsOfSuffix = trimmedSuffix.split(/\s+/);
                                            const possibleUnit = wordsOfSuffix[0] || "";
                                            
                                            if (units.includes(possibleUnit.toLowerCase())) {
                                              unitStr = possibleUnit;
                                              const restOfSuffix = trimmedSuffix.substring(possibleUnit.length).trim();
                                              displayIngredientLabel = (prefixText.trim() + " " + restOfSuffix.trim()).trim();
                                            } else {
                                              displayIngredientLabel = (prefixText.trim() + " " + suffixText.trim()).trim();
                                            }
                                            
                                            // Clean leading separator symbols
                                            displayIngredientLabel = displayIngredientLabel
                                              .replace(/^\s*[-•*,+;]\s*/, "")
                                              .replace(/\s+/g, " ")
                                              .trim();
                                            
                                            // Fallback if empty
                                            if (!displayIngredientLabel) {
                                              displayIngredientLabel = item.parsed.original;
                                            }
                                          }

                                          return (
                                            <div
                                              key={item.originalIndex}
                                              className="flex items-center justify-between gap-3 bg-white border border-[#E8E8E1] rounded-lg p-2.5 hover:border-[#D1E0D5]"
                                            >
                                              <span className="text-sm font-semibold text-[#4A4A40] truncate">
                                                {displayIngredientLabel}
                                              </span>

                                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <input
                                                  type="text"
                                                  value={currentDispVal}
                                                  onFocus={() => {
                                                    setEditingIngredientIndex(item.originalIndex);
                                                    setEditingValue(formatCzechNumber(item.parsed.parsedNumber! * scaleFactor));
                                                  }}
                                                  onChange={(e) => {
                                                    const typed = e.target.value;
                                                    setEditingValue(typed);
                                                    const parsed = parseCzechNumber(typed);
                                                    if (parsed !== null && parsed > 0 && item.parsed.parsedNumber !== null) {
                                                      setScaleFactor(parsed / item.parsed.parsedNumber);
                                                    }
                                                  }}
                                                  onBlur={() => {
                                                    setTimeout(() => {
                                                      setEditingIngredientIndex(null);
                                                    }, 150);
                                                  }}
                                                  className="w-20 bg-[#FAF9F5] border border-[#CBD5E1] rounded-md px-2 py-1 text-sm text-right font-mono font-bold text-[#1B4332] focus:bg-white focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F] outline-none"
                                                  placeholder={formatCzechNumber(item.parsed.parsedNumber!)}
                                                />
                                                <span className="text-xs font-semibold text-[#7A7A70] w-12 text-left truncate">
                                                  {unitStr}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}

                                  {scaleFactor !== 1 && (
                                    <div className="text-[11px] font-mono text-[#2D6A4F] font-bold flex items-center justify-center gap-1 bg-[#2D6A4F]/5 py-1 px-2.5 rounded-md border border-[#2D6A4F]/10">
                                      <span>⚡ Koeficient přepočtu: {formatCzechNumber(scaleFactor)}x</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="space-y-1 bg-white p-4 rounded-xl border border-[#E8E8E1] shadow-xs">
                          {selectedRecipe.ingredients.map((ing, i) => {
                            const isChecked = !!checkedIngredients[ing];
                            const parsed = parseIngredientString(ing);
                            const displayIng = scaleIngredient(parsed, scaleFactor);
                            return (
                              <div 
                                key={i}
                                onClick={() => toggleIngredient(ing)}
                                className={`flex items-start gap-2.5 p-2 rounded-lg transition-all cursor-pointer select-none border-b border-[#F5F5F0] last:border-0 ${
                                  isChecked 
                                  ? "bg-[#F5F5F0]/60 text-slate-400 line-through opacity-75" 
                                  : "hover:bg-[#F0F4F1] text-[#4A4A40]"
                                }`}
                              >
                                <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                                  isChecked 
                                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" 
                                  : "border-[#E8E8E1] bg-white"
                                }`}>
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className="text-base font-medium leading-relaxed">{displayIng}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step-by-Step Instructions */}
                      <div className="lg:col-span-7 space-y-4">
                        <h3 className="text-base font-bold uppercase text-[#1B4332] flex items-center gap-2 pb-3 border-b border-[#E8E8E1] tracking-wider">
                          <ChefHat className="h-5 w-5 text-[#D97706]" />
                          <span>Postup přípravy</span>
                        </h3>

                        <p className="text-sm text-[#9A9A8C] italic">
                          Tip: Označte si hotové kroky pro snazší orientaci v průběhu.
                        </p>

                        <div className="space-y-3">
                          {selectedRecipe.instructions.map((step, index) => {
                            const isCompleted = !!checkedInstructions[index];
                            return (
                              <div 
                                key={index}
                                onClick={() => toggleInstruction(index)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                                  isCompleted 
                                  ? "bg-[#F0F4F1]/60 border-emerald-100 text-slate-400 opacity-80" 
                                  : "bg-white hover:bg-[#FDFCF7] border-[#E8E8E1]"
                                }`}
                              >
                                {/* Step Number Badge */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                                  isCompleted 
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                  : "bg-[#1B4332] text-white"
                                }`}>
                                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                                </div>

                                <p className={`text-base leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-[#4A4A40] font-medium'}`}>
                                  {step}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* ALL OTHER INFORMATION MOVED UNDER THE RECIPE FOR BETTER READABILITY */}
                    <div className="mt-8 pt-8 border-t border-[#E8E8E1] space-y-6">
                      <div className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-[#1B4332]" />
                        <h3 className="text-base font-bold uppercase tracking-wider text-[#1B4332]">Podrobnosti o receptu</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Summary Block */}
                        <div className="md:col-span-2 space-y-3 bg-[#FDFCF7] border border-[#E8E8E1] p-5 rounded-xl">
                          <h4 className="text-xs font-bold uppercase text-[#5C5C50] tracking-wider">O receptu a vylepšení</h4>
                          <p className="text-sm text-[#4A4A40] leading-relaxed font-semibold">
                            {selectedRecipe.summary}
                          </p>
                        </div>

                        {/* Metadata Grid Parameters Card */}
                        <div className="bg-[#F5F5F0] border border-[#E8E8E1] p-5 rounded-xl flex flex-col justify-between gap-4">
                          <h4 className="text-xs font-bold uppercase text-[#5C5C50] tracking-wider">Parametry přípravy</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-[10px] text-[#9A9A8C] uppercase font-bold tracking-wider">Doba</span>
                              <span className="font-extrabold text-[#2C2C2C] text-base flex items-center gap-1.5 mt-0.5">
                                <Clock className="h-4 w-4 text-[#D97706]" />
                                {selectedRecipe.cookingTime}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-[#9A9A8C] uppercase font-bold tracking-wider">Náročnost</span>
                              <span className="font-extrabold text-[#2C2C2C] text-base mt-0.5 block">
                                {selectedRecipe.difficulty}
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#E8E8E1]">
                            <span className="block text-[10px] text-[#9A9A8C] uppercase font-bold tracking-wider">Doporučený spotřebič</span>
                            <span className="bg-[#1B4332] text-white text-xs font-bold px-2.5 py-1 rounded-md inline-block mt-1">
                              {selectedRecipe.applianceType}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* MODERN APPLIANCE HIGHLIGHT BOX */}
                      <div className="bg-[#FFFBEB] p-6 rounded-2xl border border-[#FEF3C7] flex items-start gap-4 shadow-xs">
                        <div className="p-3 bg-[#F59E0B] rounded-xl text-white shrink-0">
                          <Cpu className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold uppercase text-[#92400E] mb-1">Tip pro moderní kuchyni: {selectedRecipe.applianceType}</h4>
                          <p className="text-sm text-[#B45309] leading-relaxed font-semibold">{selectedRecipe.applianceTips}</p>
                        </div>
                      </div>

                      {/* FOOD SCIENCE EXPERT VETTING JUSTIFICATION BOX */}
                      <div className="bg-[#F5F5F0] p-6 rounded-2xl border border-[#DCDCCF] flex flex-col gap-2">
                        <h4 className="text-sm font-bold uppercase text-[#5C5C50] mb-1 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-[#1B4332]" />
                          Proč je to takto lepší? (Věda & Kuchařská chemie)
                        </h4>
                        <p className="text-sm leading-relaxed text-[#4A4A40] font-medium">
                          {selectedRecipe.expertJustification}
                        </p>

                        <div className="pt-3 border-t border-[#DCDCCF]/65 mt-1 flex flex-wrap gap-y-1 gap-x-4">
                          <span className="text-xs text-[#5C5C50] font-semibold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
                            1. Food Science optimalizováno
                          </span>
                          <span className="text-xs text-[#5C5C50] font-semibold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
                            2. Prověřeno šéfkuchaři
                          </span>
                          <span className="text-xs text-[#5C5C50] font-semibold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
                            3. Vyvážené sezónní poměry
                          </span>
                          <span className="text-xs text-[#5C5C50] font-semibold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
                            4. Zamezení obvyklým omylům
                          </span>
                        </div>
                      </div>

                    </div>

                  </div>
                </>
              )}
              </motion.article>
            ) : (
              
              /* 3. INPUT PORTAL: NOVÝ RECEPT */
              <motion.div
                key="input-portal"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                {!isAdmin ? (
                  !isStudioEnv ? (
                    /* Elegant read-only Welcome Screen for normal visitors */
                    <div className="bg-white border border-[#E8E8E1] rounded-2xl p-8 text-center space-y-6 shadow-md max-w-xl mx-auto my-8">
                      <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-[#2D6A4F] border border-amber-100">
                        <ChefHat className="w-8 h-8 animate-bounce-subtle" />
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="font-serif italic font-bold text-2xl text-[#1B4332]">
                          Vítejte v AI Kuchařce
                        </h3>
                        <p className="text-sm text-[#4A4A40] leading-relaxed font-semibold">
                          Vyberte si prosím některý z našich skvělých receptů v levém menu a objevte kouzlo vědecky podložené a technologicky vyladěné gastronomie!
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Všechny recepty jsou ověřeny pěti pilíři moderní kulinářské vědy a sestaveny zcela bez konzervantů či barviv. Každý krok obsahuje přesně odměřené hmotnosti a objemy surovin přímo v popisu, abyste při vaření nikdy nemuseli tápat.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-left">
                        <div className="p-3 bg-[#FDFCF7] border border-[#E8E8E1] rounded-xl">
                          <span className="block text-[10px] text-[#9A9A8C] uppercase font-bold tracking-wider">Mistrovská technika</span>
                          <span className="text-xs text-[#4A4A40] mt-1 block font-medium">Fyzikálně optimalizované časy a teploty tepelné úpravy.</span>
                        </div>
                        <div className="p-3 bg-[#FDFCF7] border border-[#E8E8E1] rounded-xl">
                          <span className="block text-[10px] text-[#9A9A8C] uppercase font-bold tracking-wider">Bez konzervantů</span>
                          <span className="text-xs text-[#4A4A40] mt-1 block font-medium">100% přírodní suroviny a poctivé domácí postupy.</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Admin/API key Lock Screen (Only in AI Google Studio) */
                    <div className="bg-white border border-[#E8E8E1] rounded-2xl p-8 text-center space-y-6 shadow-md max-w-xl mx-auto my-8">
                      <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 border border-amber-100">
                        <Lock className="w-8 h-8 animate-bounce-subtle" />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="font-serif italic font-bold text-xl text-[#1B4332]">
                          Přidávání nových receptů je zabezpečeno
                        </h3>
                        <p className="text-sm text-[#4A4A40] leading-relaxed">
                          Chcete-li generovat a vkládat nové AI recepty (ověřené <strong>pěti pilíři gastrotechnologie</strong> a zcela bez konzervantů), musíte se nejprve přihlásit administračním / API klíčem.
                        </p>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await handleLoginWithPassword(adminPassword);
                        }}
                        className="space-y-4 pt-2 text-left"
                      >
                        <div className="space-y-1.5">
                          <label className="block text-xs font-extrabold text-[#1B4332] uppercase tracking-wider">
                            Administrační / API klíč:
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Key className="w-4 h-4" />
                            </span>
                            <input
                              type="password"
                              placeholder="Zadejte administrační kód nebo API klíč..."
                              value={adminPassword}
                              onChange={(e) => {
                                setAdminPassword(e.target.value);
                                setLoginError(null);
                              }}
                              className="w-full text-sm pl-10 pr-4 py-3 border border-[#E8E8E1] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] focus:border-[#1B4332] bg-[#FDFCF7] text-[#2C2C2C] placeholder-[#9A9A8C]"
                            />
                          </div>
                        </div>

                        {loginError && (
                          <div className="bg-red-50 border border-red-100 text-red-800 text-xs py-2 px-3 rounded-lg flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                            <span>{loginError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isLoginLoading}
                          className="w-full bg-[#D97706] hover:bg-[#C26405] disabled:bg-amber-800/40 active:scale-95 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLoginLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <LogIn className="w-4.5 h-4.5 text-amber-200" />
                          )}
                          <span>{isLoginLoading ? "Ověřování..." : "Ověřit a pokračovat k zadání"}</span>
                        </button>
                      </form>
                    </div>
                  )
                ) : (
                  <>
                    {/* Welcome Card Info */}
                    <div className="bg-gradient-to-r from-[#F0F4F1] to-[#FDFCF7] border border-[#2D6A4F]/20 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-xs">
                      <div className="p-3 bg-[#1B4332] rounded-xl text-white self-start sm:self-center">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif italic font-bold text-lg text-[#1B4332] leading-snug">Vítejte v AI Kuchařce!</h3>
                        <p className="text-sm text-[#4A4A40] leading-relaxed">
                          Vložte jakýkoli neuspořádaný recept, vyfocené notesy, kuchařku v PDF nebo jen seznam zbytků v lednici. 
                          Prášek food science a profesionální barvy kuchařského inženýrství z něj obratem vytvoří špičkový gastronomický návod.
                        </p>
                      </div>
                    </div>

                    {/* Main Action Input Form */}
                    <form 
                      onSubmit={handleEnhanceRecipe}
                      className="bg-white border border-[#E8E8E1] rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-5"
                    >
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-[#1B4332] uppercase tracking-wider">
                          Vložte chaotický text receptu k opravě a syntéze
                        </label>
                        <textarea
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          rows={6}
                          placeholder="Sem napište nebo vložte cokoli... Například: 'kuřecí na medu a česneku, máme sušený česnek a lžíci medu, taky starou remosku, nevím jak dlouho dělat aby nebylo suché... ingredience: kuře 4 kousky, pepř ruznobarevny, kus masla'."
                          className="w-full text-sm p-4 border border-[#E8E8E1] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] focus:border-[#1B4332] bg-[#FDFCF7] placeholder-[#9A9A8C] text-[#2C2C2C]"
                        />
                      </div>

                      {/* Multimodal Drag-and-Drop Area */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-[#1B4332] uppercase tracking-wider">
                          Nahrát fotku receptu nebo PDF dokument (Volitelné)
                        </label>
                        
                        <div
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                            dragActive 
                              ? "border-[#1B4332] bg-[#F0F4F1]/30" 
                              : "border-[#E8E8E1] hover:border-[#1B4332]/50 bg-[#FDFCF7]/60 hover:bg-[#FDFCF7]"
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                          />

                          {fileName ? (
                            <div className="flex items-center gap-2 bg-[#F0F4F1] border border-[#2D6A4F]/20 py-1.5 px-3 rounded-lg text-[#1B4332] font-semibold text-xs relative animate-pulse">
                              {mimeType?.includes("pdf") ? (
                                <FileText className="h-4 w-4 text-[#2D6A4F]" />
                              ) : (
                                <FileImage className="h-4 w-4 text-[#2D6A4F]" />
                              )}
                              <span className="max-w-[200px] truncate">{fileName}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile();
                                }}
                                className="bg-[#2D6A4F]/10 hover:bg-[#2D6A4F]/20 rounded-full p-0.5 text-[#1B4332] ml-1 transition-all"
                                title="Odebrat přílohu"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="bg-[#F5F5F0] p-2.5 rounded-full text-[#5C5C50]">
                                <Upload className="h-5 w-5 expand-animation" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[#4A4A40]">Přetáhněte sem obrázek nebo klikněte</p>
                                <p className="text-[10px] text-[#9A9A8C] mt-0.5">Podpora JPEG, PNG, WEBP a PDF (max 12 MB) pro vizuální rozbor</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ERROR LOGGER DISPLAY */}
                      {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl flex items-start gap-2.5">
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-bold">Nastala chyba:</span> {errorMessage}
                          </div>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-[#D97706] hover:bg-[#C26405] disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="h-5 w-5" />
                          <span>Vylepšit můj recept (5 pilířů AI)</span>
                        </button>
                        <p className="text-center text-[10px] text-[#9A9A8C] mt-2 font-medium">
                          Zpracování potrvá zhruba 10-15 sekund pro důkladný výpočet fyzikálních a kulinářských parametrů.
                        </p>
                      </div>
                    </form>

                    {/* Scientific Pillars Documentation Card */}
                    <div className="bg-white border border-[#E8E8E1] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
                      <h4 className="font-serif italic font-bold text-lg text-[#1B4332] flex items-center gap-2">
                        <Globe className="h-5 w-5 text-[#D97706]" />
                        <span>Metodika stabilního vaření (Pět pilířů AI Kuchařky)</span>
                      </h4>
                      <p className="text-xs text-[#5C5C50] leading-relaxed font-medium">
                        Každý recept prochází komplexním syntetickým zpracováním, které zajišťuje, že se pokrm úspěšně podaří bez ohledu na úroveň vašich zkušeností:
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#FDFCF7] p-4 rounded-xl border border-[#E8E8E1] space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B4332] font-serif">
                            <span className="bg-[#1B4332] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
                            <span>Food Science (Chemie jídla)</span>
                          </div>
                          <p className="text-[10px] text-[#5C5C50] leading-relaxed">
                            Propočítává správné teploty pro optimální rozložení kolagenu v mase a škrobů v omáčkách tak, aby jídlo bylo šťavnaté.
                          </p>
                        </div>

                        <div className="bg-[#FDFCF7] p-4 rounded-xl border border-[#E8E8E1] space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B4332] font-serif">
                            <span className="bg-[#1B4332] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
                            <span>Culinary Masterclass (Praxe)</span>
                          </div>
                          <p className="text-[10px] text-[#5C5C50] leading-relaxed">
                            Zjednodušuje haute-cuisine techniky mistrů šéfkuchařů do snadno replikovatelných manuálních postupů.
                          </p>
                        </div>

                        <div className="bg-[#FDFCF7] p-4 rounded-xl border border-[#E8E8E1] space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B4332] font-serif">
                            <span className="bg-[#1B4332] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">3</span>
                            <span>Analýza poměrů (Data)</span>
                          </div>
                          <p className="text-[10px] text-[#5C5C50] leading-relaxed">
                            Agreguje kořenící a objemové modely tisíců receptur z databází k docílení vyvážené, bohaté chuti.
                          </p>
                        </div>

                        <div className="bg-[#FDFCF7] p-4 rounded-xl border border-[#E8E8E1] space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B4332] font-serif">
                            <span className="bg-[#1B4332] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">4</span>
                            <span>Eliminace chyb amatérů</span>
                          </div>
                          <p className="text-[10px] text-[#5C5C50] leading-relaxed">
                            Skenuje diskuzní kuchyňská fóra k vypíchnutí kroků, na kterých lidé nejčastěji pohoří (např. sražení, vysušení).
                          </p>
                        </div>

                        <div className="bg-[#FDFCF7] p-4 rounded-xl border border-[#E8E8E1] space-y-1 md:col-span-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B4332] font-serif">
                            <span className="bg-[#1B4332] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">5</span>
                            <span>Optimalizace moderních spotřebičů</span>
                          </div>
                          <p className="text-[10px] text-[#5C5C50] leading-relaxed">
                            Přizpůsobuje receptury pro horkovzdušné fritézy, domácí pekárny, pomalé hrnce a roboty (Thermomix), čímž ušetří spoustu času i energie.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </motion.div>
            )}
          </AnimatePresence>
          
        </main>
      </div>

      {/* FOOTER */}
      <footer className="no-print bg-white border-t border-[#E8E8E1] py-5 px-6 text-center text-xs text-[#9A9A8C] mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-medium">
          <span>© 2026 AI Kuchařka. Všechna práva vyhrazena.</span>

          {/* Discrete Admin Activation Panel */}
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <div className="flex items-center gap-4 text-[#2D6A4F] font-bold flex-wrap justify-center sm:justify-end">
                <span className="flex items-center gap-1">✓ Administrátor (Přihlášen)</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdmin(false);
                    setAdminPassword("");
                    localStorage.removeItem("admin_password_token");
                  }}
                  className="text-xs text-red-600 hover:underline hover:text-red-700 cursor-pointer font-bold"
                >
                  Odhlásit se
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="text-xs text-[#2D6A4F] hover:underline hover:text-[#1B4332] cursor-pointer font-bold flex items-center gap-1"
              >
                🔐 Administrátorské přihlášení
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[#E8E8E1]">|</span>
            <span>Made in cooperation with Culinary Chemistry Lab</span>
          </div>
        </div>
      </footer>

      {recipeToDelete && (() => {
        const recipeBeingDeleted = recipes.find(r => r.id === recipeToDelete);
        return (
          <div 
            id="delete-confirmation-backdrop"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={() => setRecipeToDelete(null)}
          >
            <div 
              id="delete-confirmation-modal"
              className="bg-[#FDFCF7] border-2 border-[#E8E8E1] rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 relative animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="font-sans font-bold text-lg text-slate-900 leading-tight">
                  Smazat recept z historie?
                </h3>
              </div>

              <div className="space-y-2">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Opravdu chcete z historie smazat recept{" "}
                  <strong className="text-slate-900 font-semibold">
                    „{recipeBeingDeleted?.title || "Zvolený recept"}“
                  </strong>?
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Tato akce je nevratná. Recept bude trvale smazán z vašeho lokálního úložiště.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  id="btn-confirm-delete-cancel"
                  type="button"
                  onClick={() => setRecipeToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-xl text-sm font-semibold transition-all cursor-pointer border border-slate-200"
                >
                  Zrušit
                </button>
                <button
                  id="btn-confirm-delete-submit"
                  type="button"
                  onClick={confirmDeleteRecipe}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  Smazat recept
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADMINISTRÁTORSKÝ PŘIHLÁŠENÍ MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#1B4332] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[#52B788]" />
                <h3 className="font-bold text-lg tracking-tight">Administrátorské přihlášení</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const passwordInput = form.elements.namedItem("adminPassword") as HTMLInputElement;
                const success = await handleLoginWithPassword(passwordInput.value);
                if (success) {
                  setShowLoginModal(false);
                }
              }}
              className="p-6 space-y-4 text-slate-700 flex flex-col flex-1"
            >
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#1B4332]">
                  Kulinářský API klíč (Administrační heslo)
                </label>
                <input
                  type="password"
                  name="adminPassword"
                  placeholder="Zadejte heslo..."
                  required
                  disabled={isLoginLoading}
                  className="w-full px-4 py-2.5 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent font-sans text-sm disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Instructions on how to set/configure it */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-[11px] leading-relaxed space-y-1.5">
                <p className="font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1">
                  💡 Jak nastavit administrátorské heslo?
                </p>
                <p>
                  Vaše administrátorské heslo je spravováno bezpečně na serveru.
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Otevřete soubor <code className="font-mono bg-amber-100 px-1 py-0.5 rounded font-bold">.env</code> v kořenovém adresáři.</li>
                  <li>Přidejte nebo upravte řádek s proměnnou <code className="font-mono bg-amber-100 px-1 py-0.5 rounded font-bold">ADMIN_PASSWORD=moje_super_tajne_heslo</code>.</li>
                  <li>Po uložení souboru restartujte vývojový server nebo aplikaci znovu nasaďte.</li>
                </ol>
              </div>

              {/* Footer */}
              <div className="pt-2 flex justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setLoginError(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-xl text-sm font-semibold transition-all cursor-pointer border border-slate-200"
                >
                  Zavřít
                </button>
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#153528] text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isLoginLoading ? "Ověřování..." : "Přihlásit se"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
