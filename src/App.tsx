import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  BookOpen, 
  FolderOpen,
  Sparkles, 
  Plus, 
  Minus, 
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
  ChevronUp,
  Eye,
  EyeOff,
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
  Scale,
  Square,
  GitBranch,
  ShoppingBag
} from "lucide-react";
import { Recipe } from "./types";
import { DEFAULT_RECIPES } from "./defaultRecipes";

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

export function isIngredientHeader(ing: string): boolean {
  if (!ing) return false;
  const trimmed = ing.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("---") || trimmed.startsWith("===") || trimmed.startsWith("###") || trimmed.startsWith("📌") || trimmed.startsWith("• [")) {
    return true;
  }
  if (trimmed.endsWith(":") && !/^\d/.test(trimmed)) {
    return true;
  }
  return false;
}

export function cleanHeaderTitle(ing: string): string {
  let text = ing.trim();
  text = text.replace(/^\[+\s*/, "").replace(/\s*\]+$/, "");
  text = text.replace(/^--+\s*/, "").replace(/\s*--+$/, "");
  text = text.replace(/^===+\s*/, "").replace(/\s*===+$/, "");
  text = text.replace(/^#+\s*/, "");
  text = text.replace(/^📌\s*/, "");
  text = text.replace(/:$/, "");
  return text.trim();
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
  let autoCat = "Ostatní";
  
  if (title.includes("chléb") || title.includes("chlieb") || title.includes("housk") || title.includes("rohlík") || title.includes("pečivo") || title.includes("briošk") || title.includes("koláč") || title.includes("moučník") || title.includes("buchta") || title.includes("sladk") || title.includes("knedlí")) {
    autoCat = "Pečivo";
  } else if (title.includes("polévka") || title.includes("polievka") || title.includes("vývar") || title.includes("bramboračka") || title.includes("kulajda")) {
    autoCat = "Polévky";
  } else if (title.includes("maso") || title.includes("vepřov") || title.includes("hověz") || title.includes("kuřec") || title.includes("bůček") || title.includes("buček") || title.includes("kachn") || title.includes("řízek") || title.includes("plátek") || title.includes("sekan") || title.includes("karban") || title.includes("steak") || title.includes("křídl") || title.includes("svíčková") || title.includes("svickova")) {
    autoCat = "Maso";
  }
  
  try {
    const savedDeleted = localStorage.getItem("ai_kucharka_deleted_default_categories");
    if (savedDeleted) {
      const deletedList = JSON.parse(savedDeleted);
      if (Array.isArray(deletedList) && deletedList.includes(autoCat)) {
        return "Ostatní";
      }
    }
  } catch (e) {
    // ignore
  }

  return autoCat;
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

  return ingredients
    .filter(ing => !isIngredientHeader(ing))
    .map((ing) => {
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
  // State for Toast Notifications
  const [toast, setToast] = useState<{ id: string; title: string; message: string; type: "success" | "info" | "warn" } | null>(null);

  // Request Notification Permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(err => console.log("Web Notification permission blocked:", err));
    }
  }, []);

  const sendWorkFinishedNotification = (title: string, message: string, type: "success" | "info" | "warn" = "success") => {
    // 1. Play sound chime
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const playChime = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.12, start);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.start(start);
          osc.stop(start + duration);
        };
        playChime(587.33, audioCtx.currentTime, 0.15); // D5
        playChime(698.46, audioCtx.currentTime + 0.1, 0.25); // F5
      }
    } catch (e) {
      console.warn("Could not play audio notification:", e);
    }

    // 2. Browser standard Web Notification API
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(title, { body: message });
        } catch (e) {
          console.warn("Error triggering Notification:", e);
        }
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            try {
              new Notification(title, { body: message });
            } catch (err) {
              console.warn("Error triggering Notification:", err);
            }
          }
        });
      }
    }

    // 3. Browser Tab Title flash
    const originalTitle = document.title;
    let isFlashing = true;
    let flashCount = 0;
    const interval = setInterval(() => {
      if (flashCount >= 12) {
        clearInterval(interval);
        document.title = originalTitle;
      } else {
        document.title = isFlashing ? `🔔 HOTOVO! ${title}` : originalTitle;
        isFlashing = !isFlashing;
        flashCount++;
      }
    }, 800);

    // 4. In-app Toast alert
    const id = Date.now().toString();
    setToast({ id, title, message, type });
    
    // Automatically dismiss toast after 5 seconds
    setTimeout(() => {
      setToast(prev => prev && prev.id === id ? null : prev);
    }, 5000);
  };

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

  // Shopping Cart states
  const [cartItems, setCartItems] = useState<{ id: string; name: string; checked: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem("ai_kucharka_cart");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [customCartItem, setCustomCartItem] = useState<string>("");
  const [confirmClearCart, setConfirmClearCart] = useState<boolean>(false);

  useEffect(() => {
    if (!isCartOpen) {
      setConfirmClearCart(false);
    }
  }, [isCartOpen]);

  useEffect(() => {
    localStorage.setItem("ai_kucharka_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const handleAddRecipeToCart = () => {
    if (!selectedRecipe) return;
    
    const scaledIngredients = selectedRecipe.ingredients
      .filter(ing => !isIngredientHeader(ing))
      .map(ing => {
        const parsed = parseIngredientString(ing);
        return scaleIngredient(parsed, scaleFactor);
      });

    const newItems = scaledIngredients.map((displayIng, index) => ({
      id: `${selectedRecipe.id}-${index}-${Date.now()}`,
      name: displayIng,
      checked: false
    }));

    setCartItems(prev => {
      const existingNames = new Set(prev.map(item => item.name));
      const filteredNew = newItems.filter(item => !existingNames.has(item.name));
      return [...prev, ...filteredNew];
    });
    
    setIsCartOpen(true);
  };

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
  const [showAdminSettingsModal, setShowAdminSettingsModal] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<"backup" | "github" | "diagnostics" | "categories">("backup");

  // States for diagnostic test panel
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<{
    timestamp: string;
    writePermissionOk: boolean;
    writePermissionMessage: string;
    geminiOk: boolean;
    geminiMessage: string;
    recipesCount: number;
    githubOk?: boolean;
    githubMessage?: string;
  } | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnosticsProgressText, setDiagnosticsProgressText] = useState("");
  const [diagnosticsProgressPercent, setDiagnosticsProgressPercent] = useState(0);
  const [diagnosticsStepIndex, setDiagnosticsStepIndex] = useState(-1);

  const diagnosticsAbortRef = useRef<AbortController | null>(null);
  const auditAbortRef = useRef<AbortController | null>(null);

  // States for Recipe Controls & Printing
  const [paperFontSize, setPaperFontSize] = useState<"normal" | "large" | "extra-large">("normal");
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [activePrintUrl, setActivePrintUrl] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // States for search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedAlphabet, setCollapsedAlphabet] = useState<Record<string, boolean>>({});
  const [sidebarViewMode, setSidebarViewMode] = useState<"druh" | "abeceda">("druh");
  const [mobileActiveTab, setMobileActiveTab] = useState<"list" | "home">("home");

  // Auto-reset mobile active tab to home view (intro screen) when no recipe is selected
  useEffect(() => {
    if (!selectedRecipe) {
      setMobileActiveTab("home");
    }
  }, [selectedRecipe]);

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
  const [acceptAuditParams, setAcceptAuditParams] = useState(true);
  const [acceptAuditIngredients, setAcceptAuditIngredients] = useState(true);
  const [acceptAuditInstructions, setAcceptAuditInstructions] = useState(true);
  const [showParamsDiff, setShowParamsDiff] = useState(false);
  const [showIngredientsDiff, setShowIngredientsDiff] = useState(false);
  const [showInstructionsDiff, setShowInstructionsDiff] = useState(false);

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

  // Manual GitHub sync states
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [manualSyncResult, setManualSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Category Editor states
  const [showCategoryEditorModal, setShowCategoryEditorModal] = useState(false);
  const [categoryEditorTab, setCategoryEditorTab] = useState<"by-category" | "all-recipes">("by-category");
  const [newCustomCategoryName, setNewCustomCategoryName] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  
  const [localCustomCategories, setLocalCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("ai_kucharka_custom_categories");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletedDefaultCategories, setDeletedDefaultCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("ai_kucharka_deleted_default_categories");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("ai_kucharka_custom_categories", JSON.stringify(localCustomCategories));
  }, [localCustomCategories]);

  useEffect(() => {
    localStorage.setItem("ai_kucharka_deleted_default_categories", JSON.stringify(deletedDefaultCategories));
  }, [deletedDefaultCategories]);

  // Rename and inline editing states
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");

  // States for Add New Recipe Modal Window
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [addRecipeTab, setAddRecipeTab] = useState<"manual" | "ai">("manual");
  const [addTitle, setAddTitle] = useState("");
  const [addCategory, setAddCategory] = useState("Maso");
  const [addCookingTime, setAddCookingTime] = useState("");
  const [addEstimatedTime, setAddEstimatedTime] = useState("");
  const [addDifficulty, setAddDifficulty] = useState<"Snadné" | "Střední" | "Složité">("Střední");
  const [addPortions, setAddPortions] = useState<number>(4);
  const [addAppliance, setAddAppliance] = useState("Sporák");
  const [addSummary, setAddSummary] = useState("");
  const [addIngredients, setAddIngredients] = useState<Array<{ amount: string; unit: string; name: string }>>([
    { amount: "", unit: "g", name: "" },
    { amount: "", unit: "g", name: "" },
    { amount: "", unit: "ks", name: "" }
  ]);
  const [addRawIngredients, setAddRawIngredients] = useState("");
  const [useRawIngredientsInput, setUseRawIngredientsInput] = useState(false);
  const [addInstructions, setAddInstructions] = useState<string[]>(["", "", ""]);
  const [addApplianceTips, setAddApplianceTips] = useState("");
  const [addExpertJustification, setAddExpertJustification] = useState("");
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [addAiText, setAddAiText] = useState("");
  const [isGeneratingAiModal, setIsGeneratingAiModal] = useState(false);
  const [aiModalProgressPercent, setAiModalProgressPercent] = useState(0);
  const [aiModalProgressText, setAiModalProgressText] = useState("");

  const defaultCategories = useMemo(() => ["Maso", "Pečivo", "Polévky", "Sladká jídla a moučníky", "Ostatní"], []);

  const allUsedCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    
    // Add default categories except deleted ones
    defaultCategories.forEach(c => {
      if (!deletedDefaultCategories.includes(c)) {
        categoriesSet.add(c);
      }
    });

    // Add manual override categories from recipes (only if they are not explicitly deleted)
    recipes.forEach(r => {
      if (r.category && !deletedDefaultCategories.includes(r.category)) {
        categoriesSet.add(r.category);
      }
    });

    // Add custom categories except deleted ones
    localCustomCategories.forEach(c => {
      if (c.trim() && !deletedDefaultCategories.includes(c.trim())) {
        categoriesSet.add(c.trim());
      }
    });

    return Array.from(categoriesSet).sort((a: string, b: string) => a.localeCompare(b, "cs"));
  }, [recipes, localCustomCategories, defaultCategories, deletedDefaultCategories]);

  const handleRenameCategory = (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) return;
    if (trimmedNewName === oldName) return;
    
    if (allUsedCategories.includes(trimmedNewName)) {
      alert(`Kategorie "${trimmedNewName}" již existuje.`);
      return;
    }

    // If we are renaming a deleted default category (or if newName is in deletedDefaultCategories), restore it
    if (deletedDefaultCategories.includes(trimmedNewName)) {
      setDeletedDefaultCategories(prev => prev.filter(c => c !== trimmedNewName));
    }

    // 1. Update custom categories and deleted default categories
    if (localCustomCategories.includes(oldName)) {
      setLocalCustomCategories(prev => prev.map(c => c === oldName ? trimmedNewName : c));
    } else {
      // It's a default category being renamed!
      // Add the new name to custom categories
      setLocalCustomCategories(prev => [...prev, trimmedNewName]);
      // Mark old default category as deleted
      if (defaultCategories.includes(oldName)) {
        setDeletedDefaultCategories(prev => [...prev, oldName]);
      }
    }

    // 2. Update recipes
    const updatedRecipesList = recipes.map(recipe => {
      if (recipe.category === oldName) {
        return { ...recipe, category: trimmedNewName, updatedAt: new Date().toISOString() };
      }
      if (!recipe.category && getRecipeCategory(recipe) === oldName) {
        return { ...recipe, category: trimmedNewName, updatedAt: new Date().toISOString() };
      }
      return recipe;
    });

    saveRecipesToStorage(updatedRecipesList);
  };

  const handleDeleteCategory = (categoryName: string) => {
    const assignedRecipes = recipes.filter(r => (r.category || getRecipeCategory(r)) === categoryName);
    
    let confirmMessage = `Opravdu chcete smazat kategorii "${categoryName}"?`;
    if (assignedRecipes.length > 0) {
      confirmMessage = `Kategorie "${categoryName}" obsahuje ${assignedRecipes.length} receptů. Pokud ji smažete, tyto recepty se vrátí k automatickému řazení nebo do kategorie "Ostatní".\n\nOpravdu chcete kategorii smazat?`;
    }

    if (!confirm(confirmMessage)) return;

    // 1. Remove from localCustomCategories
    setLocalCustomCategories(prev => prev.filter(c => c !== categoryName));

    // 2. If it's a default category, add to deleted default categories
    if (defaultCategories.includes(categoryName)) {
      setDeletedDefaultCategories(prev => [...prev, categoryName]);
    }

    // 3. Reset category override for recipes that had this category
    const updatedRecipesList = recipes.map(recipe => {
      if (recipe.category === categoryName) {
        const updated = { ...recipe, updatedAt: new Date().toISOString() };
        delete updated.category;
        return updated;
      }
      return recipe;
    });

    saveRecipesToStorage(updatedRecipesList);
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case "Maso": return "🥩";
      case "Pečivo": return "🍞";
      case "Polévky": return "🥣";
      case "Sladká jídla a moučníky": return "🍰";
      case "Ostatní": return "🍽️";
      case "Saláty": return "🥗";
      case "Přílohy": return "🍟";
      case "Nápoje": return "🍹";
      case "Snídaně": return "🍳";
      default: return "🍽️";
    }
  };

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

  const handleManualGithubSync = async () => {
    setIsManualSyncing(true);
    setManualSyncResult(null);
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
      if (adminPassword) headers["x-admin-password"] = adminPassword;

      const response = await fetch("/api/sync-github", {
        method: "POST",
        headers,
        body: JSON.stringify({ adminPassword })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setManualSyncResult({ success: true, message: data.message });
        // Refresh recipes locally to make sure we've updated local list
        const freshRes = await fetch("/api/recipes", { headers });
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          const list = Array.isArray(freshData) ? freshData : (freshData.recipes || []);
          if (list && list.length > 0) {
            setRecipes(list);
            localStorage.setItem("ai_kucharka_recipes", JSON.stringify(list));
          }
        }
      } else {
        setManualSyncResult({ success: false, message: data.error || "Synchronizace selhala." });
      }
    } catch (err: any) {
      setManualSyncResult({ success: false, message: `Chyba spojení: ${err.message || err}` });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleStopAudit = () => {
    if (auditAbortRef.current) {
      auditAbortRef.current.abort();
      auditAbortRef.current = null;
    }
    setIsAuditing(false);
    setAuditError("Kontrola receptu byla zastavena uživatelem.");
  };

  const handleAuditRecipe = async () => {
    if (!selectedRecipe) return;

    if (auditAbortRef.current) {
      auditAbortRef.current.abort();
    }
    const controller = new AbortController();
    auditAbortRef.current = controller;

    setIsAuditing(true);
    setAuditError(null);
    setAuditSteps(null);
    setProposedChange(null);
    setAuditModifiedRecipe(null);
    setActiveStepIndex(-1);
    setAcceptAuditParams(true);
    setAcceptAuditIngredients(true);
    setAcceptAuditInstructions(true);

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
        signal: controller.signal,
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
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        setActiveStepIndex(i);
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, i === 0 ? 0 : 700);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }

      sendWorkFinishedNotification(
        "Vědecká kontrola dokončena",
        `Rozbor receptu "${selectedRecipe.title}" pomocí Gemini 3.6 Flash proběhl úspěšně.`
      );

    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Audit aborted");
        setAuditError("Kontrola receptu byla zastavena uživatelem.");
      } else {
        console.error(err);
        setAuditError(err.message || "Nepodařilo se spojit se serverem pro kontrolu.");
        sendWorkFinishedNotification(
          "Chyba při kontrole receptu",
          err.message || "Chyba při vědecké kontrole.",
          "warn"
        );
      }
    } finally {
      if (auditAbortRef.current === controller) {
        auditAbortRef.current = null;
      }
      setIsAuditing(false);
    }
  };

  const handleAcceptAuditChange = () => {
    if (!selectedRecipe || !auditModifiedRecipe) return;
    
    // Create a copy of the selected recipe
    const stampedRecipe = { 
      ...selectedRecipe, 
      updatedAt: new Date().toISOString() 
    };

    // Apply only the accepted items (metadata/params, ingredients, instructions)
    if (acceptAuditParams) {
      stampedRecipe.summary = auditModifiedRecipe.summary;
      stampedRecipe.cookingTime = auditModifiedRecipe.cookingTime;
      if (auditModifiedRecipe.estimatedCookingTime) {
        stampedRecipe.estimatedCookingTime = auditModifiedRecipe.estimatedCookingTime;
      }
      stampedRecipe.difficulty = auditModifiedRecipe.difficulty;
      stampedRecipe.applianceType = auditModifiedRecipe.applianceType;
      stampedRecipe.applianceTips = auditModifiedRecipe.applianceTips;
      stampedRecipe.expertJustification = auditModifiedRecipe.expertJustification;
      if (auditModifiedRecipe.category) {
        stampedRecipe.category = auditModifiedRecipe.category;
      }
    }

    if (acceptAuditIngredients) {
      stampedRecipe.ingredients = [...auditModifiedRecipe.ingredients];
    }

    if (acceptAuditInstructions) {
      stampedRecipe.instructions = [...auditModifiedRecipe.instructions];
    }

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

  // Hands-free cooking mode methods have been removed as requested.

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
  const [editEstimatedCookingTime, setEditEstimatedCookingTime] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("Střední");
  const [editCategory, setEditCategory] = useState("Ostatní");
  
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLogs, setEditLogs] = useState<string[]>([]);
  const [editProgressPercent, setEditProgressPercent] = useState(0);

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
    setEditEstimatedCookingTime(selectedRecipe.estimatedCookingTime || "");
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
      estimatedCookingTime: editEstimatedCookingTime.trim() || editCookingTime || "20 min",
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
    setEditProgressPercent(10);

    const nowStr = () => {
      const d = new Date();
      return d.toTimeString().split(' ')[0];
    };

    setEditLogs([`[${nowStr()}] [INFO] Iniciace systému úprav...`]);

    const logStepsTemplates = [
      `[PROCESS] Parsování vašich pokynů: "${editPrompt}"`,
      "[PROCESS] Spojení s kulinářským AI jádrem (Pilíř 1, 2, 3, 4 & 5)...",
      "[PROCESS] Vyhodnocování chemických vazeb a gastronomických vztahů surovin...",
      "[PROCESS] Validace pravidla pro postupy přípravy (časy u procesních kroků)...",
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
        const pct = Math.min(92, Math.round((currentStep / logStepsTemplates.length) * 85) + 10);
        setEditProgressPercent(pct);
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
      
      // Clear local interval
      clearInterval(intervalId);
      
      if (data.logs && Array.isArray(data.logs)) {
        const now = new Date().toTimeString().split(' ')[0];
        const serverLogsFormatted = data.logs.map((l: string) => {
          // If the log already starts with a level indicator like [INFO] or [SUCCESS], keep it, else default to [PROCESS]
          const cleaned = l.replace(/^\[[A-Z]+\]\s*/, "");
          const match = l.match(/^\[([A-Z]+)\]/);
          const level = match ? match[1] : "PROCESS";
          return `[${now}] [${level}] ${cleaned}`;
        });
        setEditLogs(prev => [...prev, ...serverLogsFormatted]);
      } else {
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
      }

      setEditTitle(editedRecipe.title || "");
      setEditSummary(editedRecipe.summary || "");
      setEditIngredientsText(editedRecipe.ingredients ? editedRecipe.ingredients.join("\n") : "");
      setEditInstructionsText(editedRecipe.instructions ? editedRecipe.instructions.join("\n") : "");
      setEditApplianceTips(editedRecipe.applianceTips || "");
      setEditExpertJustification(editedRecipe.expertJustification || "");
      setEditApplianceType(editedRecipe.applianceType || "");
      setEditCookingTime(editedRecipe.cookingTime || "");
      setEditEstimatedCookingTime(editedRecipe.estimatedCookingTime || "");
      setEditDifficulty(editedRecipe.difficulty || "Střední");
      setEditCategory(editedRecipe.category || getRecipeCategory(editedRecipe));
      setEditPrompt(""); // Clear prompt after success
      setEditProgressPercent(100);

      const timeStrSuccess = new Date().toTimeString().split(' ')[0];
      setEditLogs(prev => [...prev, `[${timeStrSuccess}] [SUCCESS] Recept byl úspěšně zrekonstruován a načten do formuláře!`]);
      sendWorkFinishedNotification(
        "Úprava receptu dokončena",
        `Recept "${selectedRecipe.title}" byl úspěšně upraven kulinářským jádrem.`
      );
    } catch (err: any) {
      clearInterval(intervalId);
      console.error(err);
      const timeStrErr = new Date().toTimeString().split(' ')[0];
      setEditLogs(prev => [...prev, `[${timeStrErr}] [WARN] Selhání při úpravě: ${err.message || "Neznámá chyba"}`]);
      setEditError(err.message || "Nepodařilo se spojit se serverem pro AI úpravu.");
      sendWorkFinishedNotification(
        "Úprava receptu selhala",
        err.message || "Chyba při úpravě receptu kulinářským jádrem.",
        "warn"
      );
    } finally {
      setIsEditLoading(false);
    }
  };

  // Handlers for Add Recipe Modal
  const handleOpenAddRecipeModal = () => {
    setAddTitle("");
    setAddCategory("Maso");
    setAddCookingTime("");
    setAddEstimatedTime("");
    setAddDifficulty("Střední");
    setAddPortions(4);
    setAddAppliance("Sporák");
    setAddSummary("");
    setAddIngredients([
      { amount: "", unit: "g", name: "" },
      { amount: "", unit: "g", name: "" },
      { amount: "", unit: "ks", name: "" }
    ]);
    setAddRawIngredients("");
    setUseRawIngredientsInput(false);
    setAddInstructions(["", "", ""]);
    setAddApplianceTips("");
    setAddExpertJustification("");
    setAddFormError(null);
    setAddAiText("");
    setAddRecipeTab("manual");
    setShowAddRecipeModal(true);
  };

  const handleAddIngredientRow = () => {
    setAddIngredients(prev => [...prev, { amount: "", unit: "g", name: "" }]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setAddIngredients(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateIngredientRow = (index: number, field: "amount" | "unit" | "name", value: string) => {
    setAddIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddInstructionRow = () => {
    setAddInstructions(prev => [...prev, ""]);
  };

  const handleRemoveInstructionRow = (index: number) => {
    setAddInstructions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateInstructionRow = (index: number, value: string) => {
    setAddInstructions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleSaveManualRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);

    if (!addTitle.trim()) {
      setAddFormError("Prosím vyplňte název receptu.");
      return;
    }

    if (!addCookingTime.trim()) {
      setAddFormError("Prosím vyplňte celkovou dobu přípravy (např. '45 min' nebo '2 h marinování, 30 min pečení').");
      return;
    }

    let finalIngredients: string[] = [];
    if (useRawIngredientsInput && addRawIngredients.trim()) {
      finalIngredients = addRawIngredients.split("\n").map(l => l.trim()).filter(Boolean);
    } else {
      finalIngredients = addIngredients
        .filter(i => i.name.trim().length > 0)
        .map(i => `${i.amount.trim()} ${i.unit.trim()} ${i.name.trim()}`.replace(/\s+/g, " ").trim());
    }

    if (finalIngredients.length === 0) {
      setAddFormError("Přidejte prosím alespoň jednu ingredienci.");
      return;
    }

    const finalInstructions = addInstructions
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (finalInstructions.length === 0) {
      setAddFormError("Přidejte prosím alespoň jeden krok postupu.");
      return;
    }

    const newRecipe: Recipe = {
      id: "recipe-" + Date.now(),
      title: addTitle.trim(),
      category: addCategory || "Maso",
      cookingTime: addCookingTime.trim(),
      estimatedCookingTime: addEstimatedTime.trim() || addCookingTime.trim(),
      difficulty: addDifficulty || "Střední",
      applianceType: addAppliance || "Sporák",
      summary: addSummary.trim() || `${addTitle.trim()} – poctivý domácí recept (doba přípravy: ${addCookingTime.trim()}).`,
      ingredients: finalIngredients,
      instructions: finalInstructions,
      applianceTips: addApplianceTips.trim() || `Při přípravě v zařízení '${addAppliance}' dbejte na dodržení správných časů a teplot.`,
      expertJustification: addExpertJustification.trim() || "Vědecká kontrola: Použití čerstvých ingrediencí a fázování přípravy zajišťuje optimální chuť i strukturu.",
      updatedAt: new Date().toISOString()
    };

    const updatedRecipes = [newRecipe, ...recipes];
    saveRecipesToStorage(updatedRecipes, newRecipe);
    setSelectedRecipe(newRecipe);
    setShowAddRecipeModal(false);
    setToast({
      title: "Recept byl vytvořen!",
      message: `Nový recept "${newRecipe.title}" byl úspěšně uložen do vaší kuchařky.`
    });
  };

  const handleGenerateAiModalRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAiText.trim() && !fileData) {
      setAddFormError("Prosím napište popis receptu nebo vložte soubor.");
      return;
    }

    setIsGeneratingAiModal(true);
    setAddFormError(null);
    setAiModalProgressPercent(12);
    setAiModalProgressText("Iniciace spojení s Google Gemini 3.6 Flash...");

    const aiModalSteps = [
      { p: 25, t: "Skenování surovin a rozpoznávání textu/dokumentu..." },
      { p: 48, t: "Kontrola a dopočítání přesných časů u všech kulinářských kroků..." },
      { p: 72, t: "Aplikace pravidla pro postupy přípravy (časy u procesních kroků)..." },
      { p: 88, t: "Chemicko-fyzikální kulinářská kontrola a syntéza..." },
      { p: 96, t: "Sestavování finální struktury receptu..." }
    ];

    let modalStepIdx = 0;
    const modalInterval = setInterval(() => {
      if (modalStepIdx < aiModalSteps.length) {
        setAiModalProgressPercent(aiModalSteps[modalStepIdx].p);
        setAiModalProgressText(aiModalSteps[modalStepIdx].t);
        modalStepIdx++;
      }
    }, 1100);

    try {
      const response = await fetch("/api/enhance-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: addAiText,
          fileData,
          fileName,
          mimeType,
          adminPassword
        })
      });

      clearInterval(modalInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Při generování receptu přes AI nastala chyba.");
      }

      const data = await response.json();
      if (!data.recipe) {
        throw new Error("Server nevrátil platný recept.");
      }

      setAiModalProgressPercent(100);
      setAiModalProgressText("Recept byl úspěšně vygenerován!");

      const newRecipe: Recipe = {
        ...data.recipe,
        id: "recipe-ai-" + Date.now(),
        updatedAt: new Date().toISOString()
      };

      const updatedRecipes = [newRecipe, ...recipes];
      saveRecipesToStorage(updatedRecipes, newRecipe);
      setSelectedRecipe(newRecipe);
      setShowAddRecipeModal(false);
      removeFile();
      setAddAiText("");
      setToast({
        title: "AI Recept vytvořen!",
        message: `Recept "${newRecipe.title}" byl vygenerován a uložen do kuchařky.`
      });
    } catch (err: any) {
      console.error(err);
      setAddFormError(err.message || "Chyba při komunikaci s AI serverem.");
    } finally {
      setIsGeneratingAiModal(false);
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

  const handleStopDiagnostics = () => {
    if (diagnosticsAbortRef.current) {
      diagnosticsAbortRef.current.abort();
      diagnosticsAbortRef.current = null;
    }
    setIsDiagnosing(false);
    setDiagnosticsProgressText("Diagnostika byla zastavena uživatelem.");
    setDiagnosticsProgressPercent(0);
    setDiagnosticsStepIndex(-1);
    setDiagnosticsError("Diagnostika byla zastavena uživatelem.");
  };

  const handleRunDiagnostics = async () => {
    if (diagnosticsAbortRef.current) {
      diagnosticsAbortRef.current.abort();
    }
    const controller = new AbortController();
    diagnosticsAbortRef.current = controller;

    setIsDiagnosing(true);
    setDiagnosticsResult(null);
    setDiagnosticsError(null);
    setDiagnosticsProgressPercent(0);
    setDiagnosticsStepIndex(0);

    const sleep = (ms: number) => new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      controller.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

    try {
      setDiagnosticsProgressText("Inicializace systému a ověřování práv...");
      setDiagnosticsProgressPercent(15);
      await sleep(600);

      setDiagnosticsProgressText("Ověřování přístupových práv k souborovému systému...");
      setDiagnosticsProgressPercent(35);
      setDiagnosticsStepIndex(1);
      await sleep(700);

      setDiagnosticsProgressText("Navazování spojení s Google Gemini AI (gemini-3.6-flash)...");
      setDiagnosticsProgressPercent(60);
      setDiagnosticsStepIndex(2);

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

      const response = await fetch("/api/test-diagnostics", {
        method: "POST",
        headers,
        body: JSON.stringify({ adminPassword }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Nepodařilo se spustit diagnostiku.");
      }
      const data = await response.json();

      setDiagnosticsProgressText("Sestavování závěrečného diagnostického reportu...");
      setDiagnosticsProgressPercent(90);
      setDiagnosticsStepIndex(3);
      await sleep(600);

      setDiagnosticsProgressPercent(100);
      setDiagnosticsProgressText("Diagnostika dokončena úspěšně.");
      setDiagnosticsResult(data);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Diagnostics aborted");
        setDiagnosticsError("Diagnostika byla zastavena uživatelem.");
      } else {
        console.error("[Diagnostics Error]:", err);
        setDiagnosticsError(err.message || "Během diagnostiky došlo k chybě.");
      }
    } finally {
      if (diagnosticsAbortRef.current === controller) {
        diagnosticsAbortRef.current = null;
      }
      setIsDiagnosing(false);
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
Celková doba: ${selectedRecipe.cookingTime || "Není specifikováno"}
Tepelná úprava (expert): ${selectedRecipe.estimatedCookingTime || "Není specifikováno"}
Náročnost: ${selectedRecipe.difficulty || "Střední"}
Doporučený spotřebič: ${selectedRecipe.applianceType || "Standardní spotřebič"}

--- SHRNUTÍ RECEPTU ---
${selectedRecipe.summary || "Bez popisu."}

--- SEZNAM INGREDIENCÍ ---
${selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 
  ? selectedRecipe.ingredients.map(ing => isIngredientHeader(ing) ? `\n📌 ${cleanHeaderTitle(ing).toUpperCase()}:` : `• ${ing}`).join("\n").trim() 
  : "Žádné ingredience nejsou zapsány."}

--- POSTUP PŘÍPRAVY ---
${selectedRecipe.instructions && selectedRecipe.instructions.length > 0 
  ? (() => {
      let num = 1;
      return selectedRecipe.instructions.map((step) => {
        if (isIngredientHeader(step)) return `\n📌 ${cleanHeaderTitle(step).toUpperCase()}:`;
        return `${num++}. ${step}`;
      }).join("\n\n");
    })()
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
          padding: 12px;
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
          border-radius: 12px;
          padding: 20px 24px;
          max-width: 760px;
          margin: 0 auto;
          box-shadow: none;
          page-break-inside: auto;
          break-inside: auto;
        }

        .instruction-step, .break-inside-avoid {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .page-break-after-avoid, h1, h2, h3, h4 {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }

        .meta-bottom-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .no-print, button, #calc-container-surovin, .no-pdf {
          display: none !important;
        }

        .border-b {
          border-bottom: 1px solid #D8D2C2;
        }

        .border-t {
          border-top: 1px solid #D8D2C2;
        }

        .pb-6 {
          padding-bottom: 16px;
        }

        .pb-1 {
          padding-bottom: 4px;
        }

        .pt-4 {
          padding-top: 12px;
        }

        .py-4 {
          padding-top: 12px;
          padding-bottom: 12px;
        }

        .space-y-3 {
          margin-top: 10px;
        }

        .space-y-3 > * + * {
          margin-top: 10px;
        }

        .space-y-4 > * + * {
          margin-top: 12px;
        }

        .space-y-2 > * + * {
          margin-top: 6px;
        }

        .space-y-6 > * + * {
          margin-top: 16px;
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
          gap: 10px;
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
          font-size: 11.5px;
        }

        .text-xs {
          font-size: 13px;
        }

        .text-sm {
          font-size: 14.5px;
        }

        .text-base {
          font-size: 16px;
        }

        .text-lg {
          font-size: 18.5px;
        }

        .text-3xl {
          font-size: 27px;
        }

        .text-4xl {
          font-size: 32px;
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
          gap: 12px;
        }

        .italic {
          font-style: italic;
        }

        .list-disc {
          list-style-type: disc;
        }

        .pl-5 {
          padding-left: 18px;
        }

        .shrink-0 {
          flex-shrink: 0;
        }

        @media (min-width: 500px) {
          .grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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

      // Compact margins for A4 (top 12mm, right 14mm, bottom 12mm, left 14mm)
      const safeMargin = iframeWin.JSON.parse("[12, 14, 12, 14]");

      // Adjust height of the iframe so html2pdf layout is entirely visible
      const scrollHeight = Math.max(
        iframeDoc.body?.scrollHeight || 0,
        iframeDoc.documentElement?.scrollHeight || 0,
        pdfRootElement.scrollHeight || 0,
        1500
      );
      iframe.style.height = `${scrollHeight + 150}px`;

      // Configure beautiful options for high-quality standard A4 PDFs
      const opt = {
        margin:       safeMargin,
        filename:     cleanFilename,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: "#FFFFFF"
        },
        jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
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

  const handlePrintRecipe = () => {
    if (!selectedRecipe) return;

    const title = selectedRecipe.title;
    const category = selectedRecipe.category || getRecipeCategory(selectedRecipe);
    const cookingTime = selectedRecipe.cookingTime || "Není specifikováno";
    const difficulty = selectedRecipe.difficulty || "Střední";
    const applianceType = selectedRecipe.applianceType || "Standardní spotřebič";
    const summary = selectedRecipe.summary || "";
    const applianceTips = selectedRecipe.applianceTips || "";
    const expertJustification = selectedRecipe.expertJustification || "";

    // Ingredients list with scaled quantities (rendered in multi-column layout top-to-bottom column 1 then column 2)
    const ingredientsHtml = selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 
      ? selectedRecipe.ingredients.map(ing => {
          if (isIngredientHeader(ing)) {
            const headerTitle = cleanHeaderTitle(ing);
            return `
              <li style="column-span: all; -webkit-column-span: all; list-style: none; padding: 6px 0 2px 0; border-bottom: 1.5px solid #1B4332; font-weight: 800; font-size: 14px; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; page-break-after: avoid; break-after: avoid; margin-top: 6px; margin-bottom: 4px;">
                📌 ${headerTitle}
              </li>
            `;
          }
          const parsed = parseIngredientString(ing);
          const displayIng = scaleIngredient(parsed, scaleFactor);
          return `
            <li style="padding: 3px 0; border-bottom: 1px solid #F0EFEA; font-size: 13.5px; color: #2C2C2C; page-break-inside: avoid; break-inside: avoid; line-height: 1.35; font-weight: 500;">
              ${displayIng}
            </li>
          `;
        }).join("")
      : `<li style="font-style: italic; color: #666; padding: 4px 0; column-span: all; -webkit-column-span: all;">Žádné ingredience nejsou zapsány.</li>`;

    // Instructions list
    let pdfStepNum = 1;
    const instructionsHtml = selectedRecipe.instructions && selectedRecipe.instructions.length > 0
      ? selectedRecipe.instructions.map((step) => {
          if (isIngredientHeader(step)) {
            const headerTitle = cleanHeaderTitle(step);
            return `
              <div style="font-weight: 800; font-size: 13.5px; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #1B4332; padding: 6px 0 2px 0; margin-top: 10px; margin-bottom: 6px; page-break-after: avoid; break-after: avoid;">
                📌 ${headerTitle}
              </div>
            `;
          }
          const currentNum = pdfStepNum++;
          return `
            <div class="instruction-step" style="display: flex; flex-direction: column; gap: 4px; padding: 7px 10px; margin-bottom: 7px; background-color: #FAF8F3; border: 1px solid #E8E4DB; border-radius: 6px; page-break-inside: avoid !important; break-inside: avoid !important;">
              <div style="display: flex; gap: 9px; align-items: flex-start;">
                <div style="font-weight: 800; font-size: 12px; color: #FFFFFF; background-color: #1B4332; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">${currentNum}</div>
                <div style="font-size: 14px; line-height: 1.45; color: #2C2C2C; flex: 1;">${step}</div>
              </div>
            </div>
          `;
        }).join("")
      : `<p style="font-style: italic; color: #666;">Žádný postup přípravy není zapsán.</p>`;

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
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background-color: #FFFFFF;
      color: #1B4332;
      margin: 0;
      padding: 0;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .recipe-sheet {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: #FFFFFF;
      padding: 4mm 4mm;
      box-sizing: border-box;
    }
    .sheet-header {
      border-bottom: 2px solid #E8E5DC;
      padding-bottom: 8px;
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .meta-brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .meta-brand {
      font-size: 10.5px;
      font-weight: 800;
      color: #888172;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .recipe-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 25px;
      color: #1B4332;
      margin: 2px 0 4px 0;
      font-weight: 800;
      line-height: 1.2;
      page-break-after: avoid;
      break-after: avoid;
    }
    .recipe-category {
      display: inline-block;
      font-size: 11.5px;
      font-weight: 700;
      color: #2D6A4F;
      background-color: #E8F5E9;
      padding: 2.5px 9px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .portion-badge {
      display: inline-block;
      font-size: 11.5px;
      font-weight: 700;
      color: #1B4332;
      background-color: #FAF8F3;
      border: 1px solid #E8E4DB;
      padding: 2.5px 9px;
      border-radius: 8px;
    }
    .section-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 17px;
      font-weight: 700;
      color: #1B4332;
      border-bottom: 1.5px solid #E8E5DC;
      padding-bottom: 4px;
      margin: 12px 0 8px 0;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .ingredients-grid {
      list-style: none;
      padding: 0;
      margin: 0;
      column-count: 2;
      -webkit-column-count: 2;
      column-gap: 16px;
      -webkit-column-gap: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .ingredients-grid li {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .summary-text {
      font-style: italic;
      color: #4A4A40;
      font-size: 13.5px;
      margin-top: 4px;
      line-height: 1.45;
    }
    .instruction-step {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .parameters-bottom-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-top: 6px;
      padding: 8px 10px;
      background-color: #FDFBF7;
      border: 1px solid #E8E5DC;
      border-radius: 6px;
      text-align: center;
    }
    .param-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #7A7A70;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 1px;
    }
    .param-value {
      font-size: 13px;
      font-weight: 700;
      color: #1B4332;
    }
    .expert-block {
      background-color: #FDFBF7;
      border: 1px solid #E8E5DC;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 12px;
      font-size: 12.5px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .expert-block h4 {
      margin: 0 0 4px 0;
      font-size: 12.5px;
      color: #1B4332;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer-stamp {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #E8E5DC;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 700;
      color: #888172;
      text-transform: uppercase;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    @media screen {
      body {
        background-color: #F8F6F0;
        padding: 20px 12px;
      }
      .recipe-sheet {
        max-width: 190mm;
        padding: 24px 28px;
        border: 1px solid #E8E5DC;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      }
    }
    @media print {
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #FFFFFF !important;
      }
      .recipe-sheet {
        border: none !important;
        border-radius: 0 !important;
        padding: 4mm 4mm !important;
        margin: 0 auto !important;
        max-width: 100% !important;
        width: 100% !important;
        box-shadow: none !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body>
  <div class="recipe-sheet">
    <div class="sheet-header">
      <div class="meta-brand-row">
        <span class="meta-brand">AI KUCHAŘKA • 5 PILÍŘOVÁ SYNTÉZA</span>
        <div>
          <span class="recipe-category">${category}</span>
          <span class="portion-badge">Porce: ${scaleFactor === 1 ? "1x" : `${formatCzechNumber(scaleFactor)}x`}</span>
        </div>
      </div>
      <h1 class="recipe-title">${title}</h1>
      ${summary ? `<div class="summary-text">${summary}</div>` : ''}
    </div>

    <h2 class="section-title">Suroviny a ingredience</h2>
    <ul class="ingredients-grid">
      ${ingredientsHtml}
    </ul>

    <h2 class="section-title">Postup přípravy (krok za krokem)</h2>
    <div>
      ${instructionsHtml}
    </div>

    <!-- SECONDARY METADATA & PARAMETERS MOVED TO THE END OF RECIPE -->
    <div class="expert-block">
      <h4>Doplňující informace a technické parametry</h4>
      <div class="parameters-bottom-grid">
        <div>
          <span class="param-label">Celková doba</span>
          <span class="param-value">${cookingTime}</span>
        </div>
        <div>
          <span class="param-label">Náročnost</span>
          <span class="param-value">${difficulty}</span>
        </div>
        <div>
          <span class="param-label">Spotřebič</span>
          <span class="param-value">${applianceType}</span>
        </div>
        <div>
          <span class="param-label">Porce</span>
          <span class="param-value">${scaleFactor === 1 ? "1x" : `${formatCzechNumber(scaleFactor)}x`}</span>
        </div>
      </div>

      ${applianceTips ? `
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E8E5DC;">
          <strong>💡 Tip pro spotřebič (${applianceType}):</strong>
          <div style="margin-top: 2px;">${applianceTips}</div>
        </div>
      ` : ''}

      ${expertJustification ? `
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E8E5DC;">
          <strong>🔬 Kulinářská chemie a zdůvodnění:</strong>
          <div style="margin-top: 2px;">${expertJustification}</div>
        </div>
      ` : ''}
    </div>

    <div class="footer-stamp">
      <span>AI Kuchařka • Moderní gastronomické inženýrství</span>
      <span>Vytisknuto dne: ${new Date().toLocaleDateString("cs-CZ")}</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        try { window.print(); } catch(e) {}
      }, 350);
    };
  </script>
</body>
</html>`;

    // 1. Create a clean standalone Blob URL for new tab / direct link opening
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    setActivePrintUrl(blobUrl);

    // 2. Trigger native window.print() directly on main window
    try {
      window.print();
    } catch (e) {
      console.warn("Direct window.print call failed:", e);
    }

    // 3. Attempt window.open in a new tab (runs unrestricted print outside sandboxed iframe)
    try {
      const win = window.open(blobUrl, "_blank");
      if (win) {
        win.focus();
      }
    } catch (e) {
      console.warn("window.open call failed:", e);
    }

    // 4. Open interactive Print & PDF Modal so user has instant choices and direct buttons
    setShowPrintModal(true);
    setPrintNotice(`Spuštěn tisk receptu „${selectedRecipe.title}“. Připravili jsme pro vás také přímý tiskový list a možnost stažení PDF.`);
    setTimeout(() => setPrintNotice(null), 6000);
  };

  const triggerNativePrint = handlePrintRecipe;
  const triggerPaperPrint = handlePrintRecipe;

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
      ? selectedRecipe.ingredients.map(ing => {
          if (isIngredientHeader(ing)) {
            const headerTitle = cleanHeaderTitle(ing);
            return `<li class="ingredient-header-item" style="list-style:none; margin-top:10px; font-weight:bold; color:#1B4332; border-bottom:2px solid #1B4332; text-transform:uppercase;">📌 ${headerTitle}</li>`;
          }
          return `
            <li class="ingredient-item">
              <span class="checkbox-box"></span>
              <span>${ing}</span>
            </li>
          `;
        }).join("")
      : `<li class="ingredient-item">Žádné ingredience nejsou zapsány.</li>`;

    // Render instructions list
    let printStepNum = 1;
    const instructionsHtml = selectedRecipe.instructions && selectedRecipe.instructions.length > 0
      ? selectedRecipe.instructions.map((step) => {
          if (isIngredientHeader(step)) {
            const headerTitle = cleanHeaderTitle(step);
            return `
              <div style="font-weight: 800; font-size: 14px; color: #1B4332; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #1B4332; padding: 6px 0 2px 0; margin-top: 10px; margin-bottom: 6px; page-break-after: avoid; break-after: avoid;">
                📌 ${headerTitle}
              </div>
            `;
          }
          const currentNum = printStepNum++;
          return `
            <div class="step-card">
              <div class="step-number">${currentNum}</div>
              <div class="step-text">${step}</div>
            </div>
          `;
        }).join("")
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

      // 3. Fallback to empty list / DEFAULT_RECIPES
      if (loadedList === null || loadedList.length === 0) {
        loadedList = DEFAULT_RECIPES;
        console.log("Seznam receptů je prázdný, načítám výchozí recepty.");
      }

      // Upgrade loaded recipes with instruction headers from DEFAULT_RECIPES if missing
      const defaultMap = new Map(DEFAULT_RECIPES.map(r => [r.title, r]));
      const upgradedList = loadedList.map(loadedRecipe => {
        const def = defaultMap.get(loadedRecipe.title);
        if (def) {
          const defHasHeaders = (def.instructions || []).some(i => isIngredientHeader(i));
          const loadedHasHeaders = (loadedRecipe.instructions || []).some(i => isIngredientHeader(i));
          if (defHasHeaders && !loadedHasHeaders) {
            return {
              ...loadedRecipe,
              instructions: [...def.instructions],
              ingredients: (def.ingredients && def.ingredients.some(i => isIngredientHeader(i))) 
                ? [...def.ingredients] 
                : loadedRecipe.ingredients
            };
          }
        }
        return loadedRecipe;
      });

      // Save and set
      const cleaned = upgradedList.map(removePreservativesFromSoup);
      setRecipes(cleaned);
      setSelectedRecipe(prev => {
        if (prev) {
          const matching = cleaned.find(r => r.id === prev.id);
          if (matching) return matching;
        }
        return null; // Force Home Screen on start!
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
    <div className="h-screen overflow-hidden bg-[#FDFCF7] text-[#2C2C2C] font-sans flex flex-col antialiased print:h-auto print:overflow-visible">
      {/* FLOATING PRINT / PDF STATUS NOTICE */}
      <AnimatePresence>
        {printNotice && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            style={{ zIndex: 99999 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-emerald-900 text-white border border-emerald-800/80 rounded-2xl shadow-xl p-4 flex items-start gap-3 pointer-events-auto no-print"
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

      {/* INTERACTIVE PRINT & EXPORT MODAL */}
      <AnimatePresence>
        {showPrintModal && selectedRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-[#1B4332] text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#2D6A4F] p-2 rounded-xl text-white">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg leading-tight">Možnosti tisku a uložení</h3>
                    <p className="text-xs text-emerald-200 mt-0.5 line-clamp-1">{selectedRecipe.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  Tiskový lístek byl vygenerován. Zvolte preferovaný způsob tisku nebo exportu:
                </p>

                <div className="space-y-2.5 pt-1">
                  {/* Option 1: Direct window.print */}
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-between cursor-pointer shadow-md active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      <Printer className="h-4 w-4 text-emerald-400" />
                      <span>1. Spustit tiskový dialog prohlížeče</span>
                    </div>
                    <span className="text-xs font-mono bg-[#2D6A4F] px-2 py-0.5 rounded text-emerald-100">Ctrl+P</span>
                  </button>

                  {/* Option 2: Open standalone printable document in new tab */}
                  {activePrintUrl && (
                    <a
                      href={activePrintUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setTimeout(() => setShowPrintModal(false), 800);
                      }}
                      className="w-full bg-white hover:bg-emerald-50 border-2 border-[#1B4332] text-[#1B4332] font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-between cursor-pointer shadow-xs active:scale-98"
                    >
                      <div className="flex items-center gap-2.5">
                        <ExternalLink className="h-4 w-4 text-[#1B4332]" />
                        <span>2. Otevřít tiskový list v novém okně</span>
                      </div>
                      <span className="text-xs font-mono text-[#2D6A4F] font-semibold">Nové okno ↗</span>
                    </a>
                  )}

                  {/* Option 3: Download PDF */}
                  <button
                    onClick={() => {
                      setShowPrintModal(false);
                      downloadRecipePDF();
                    }}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-between cursor-pointer shadow-sm active:scale-98"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4" />
                      <span>3. Stáhnout jako PDF soubor</span>
                    </div>
                    <span className="text-xs font-mono bg-amber-700 px-2 py-0.5 rounded text-amber-100">PDF</span>
                  </button>

                  {/* Option 4: Download HTML file for printing */}
                  {activePrintUrl && (
                    <a
                      href={activePrintUrl}
                      download={`${selectedRecipe.title.replace(/[^a-zA-Z0-9-áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, "_")}-tisk.html`}
                      className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>4. Stáhnout samostatný HTML soubor k tisku</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">.HTML</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-[#F5F5F0] border-t border-[#E8E8E1] px-6 py-3 flex justify-end">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  Zavřít
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* HEADER */}
      <header className="no-print bg-white border-b border-[#E8E8E1] py-3.5 px-4 md:px-6 sticky top-0 z-40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <button
          onClick={() => {
            setSelectedRecipe(null);
            setIsEditing(false);
            setSearchQuery("");
            setShowExportView(false);
            setAuditSteps(null);
            setProposedChange(null);
            setAuditModifiedRecipe(null);
            setActiveStepIndex(-1);
            setErrorMessage(null);
          }}
          className="flex items-center gap-3 hover:opacity-90 active:scale-98 transition-all text-left bg-transparent border-0 p-0 m-0 cursor-pointer group shrink-0"
          title="Přejít na hlavní stránku"
        >
          <div className="bg-[#1B4332] text-white p-2 rounded-xl shadow-md group-hover:bg-[#2D6A4F] transition-colors">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif italic font-semibold text-2xl text-[#1B4332] flex items-center gap-2 group-hover:text-[#2D6A4F] transition-colors">
              AI Kuchařka
              <span className="text-[10px] bg-[#F0F4F1] text-[#2D6A4F] border border-[#2D6A4F]/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans normal-case">
                5x Pilířová Syntéza
              </span>
            </h1>
            <p className="text-xs text-[#5C5C50] hidden sm:block font-medium">Vědecky podložená a technologicky vyladěná gastronomie</p>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2 md:gap-2.5 ml-auto md:ml-0">
          {/* 1. RECIPE SPECIFIC HEADER CONTROLS (WHEN A RECIPE IS SELECTED) */}
          {selectedRecipe ? (
            <>
              {/* BACK BUTTON */}
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-[#F5F5F0] hover:bg-[#E8E8E1] text-[#2C2C2C] border border-[#E8E8E1] font-bold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer active:scale-98"
                  title="Zrušit úpravy a vrátit se"
                >
                  <ChevronLeft className="h-4.5 w-4.5" />
                  <span>Zpět</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedRecipe(null);
                    setIsEditing(false);
                    setShowExportView(false);
                    setAuditSteps(null);
                    setProposedChange(null);
                    setAuditModifiedRecipe(null);
                    setActiveStepIndex(-1);
                    setErrorMessage(null);
                  }}
                  className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer hover:shadow-md active:scale-98"
                  title="Zpět na hlavní přehled receptů"
                >
                  <ChevronLeft className="h-4.5 w-4.5" />
                  <span>Zpět</span>
                </button>
              )}

              {/* PREVIOUS & NEXT RECIPE BUTTONS */}
              {(() => {
                const currentIndex = filteredRecipes.findIndex(r => r.id === selectedRecipe.id);
                const hasPrev = currentIndex > 0;
                const hasNext = currentIndex < filteredRecipes.length - 1 && currentIndex !== -1;

                const handlePrev = () => {
                  if (hasPrev) {
                    const prevR = filteredRecipes[currentIndex - 1];
                    setSelectedRecipe(prevR);
                    setCheckedIngredients({});
                    setCheckedInstructions({});
                    setIsEditing(false);
                    setShowExportView(false);
                    setAuditSteps(null);
                    setProposedChange(null);
                    setAuditModifiedRecipe(null);
                    setActiveStepIndex(-1);
                    setErrorMessage(null);
                  }
                };

                const handleNext = () => {
                  if (hasNext) {
                    const nextR = filteredRecipes[currentIndex + 1];
                    setSelectedRecipe(nextR);
                    setCheckedIngredients({});
                    setCheckedInstructions({});
                    setIsEditing(false);
                    setShowExportView(false);
                    setAuditSteps(null);
                    setProposedChange(null);
                    setAuditModifiedRecipe(null);
                    setActiveStepIndex(-1);
                    setErrorMessage(null);
                  }
                };

                return (
                  <>
                    <button
                      id="btn-previous-recipe"
                      onClick={handlePrev}
                      disabled={!hasPrev}
                      className={`font-bold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 text-xs sm:text-sm cursor-pointer ${
                        hasPrev 
                          ? "bg-white border border-[#1B4332] text-[#1B4332] hover:bg-[#F0F4F1] active:scale-98" 
                          : "bg-[#F5F5F0] text-[#9A9A8C] border border-[#E8E8E1] cursor-not-allowed opacity-55"
                      }`}
                      title="Přejít na předchozí recept"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Předchozí</span>
                    </button>

                    <button
                      id="btn-next-recipe"
                      onClick={handleNext}
                      disabled={!hasNext}
                      className={`font-bold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 text-xs sm:text-sm cursor-pointer ${
                        hasNext 
                          ? "bg-white border border-[#1B4332] text-[#1B4332] hover:bg-[#F0F4F1] active:scale-98" 
                          : "bg-[#F5F5F0] text-[#9A9A8C] border border-[#E8E8E1] cursor-not-allowed opacity-55"
                      }`}
                      title="Přejít na další recept"
                    >
                      <span>Další</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                );
              })()}

              {/* EDITING MODE VS VIEWING MODE BUTTONS */}
              {isEditing ? (
                <>
                  {/* KONTROLA RECEPTU */}
                  <button
                    type="button"
                    onClick={handleAuditRecipe}
                    disabled={isAuditing}
                    className={`font-bold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer ${
                      isAuditing
                        ? "bg-amber-100 text-amber-800 border border-amber-200 cursor-not-allowed animate-pulse"
                        : "bg-[#2D6A4F] hover:bg-[#1B4332] text-white hover:shadow-md active:scale-98"
                    }`}
                    title="Spustit vědeckou kontrolu a audit receptu"
                  >
                    <Cpu className={`h-4.5 w-4.5 ${isAuditing ? "animate-spin" : ""}`} />
                    <span>{isAuditing ? "Simuluji..." : "Kontrola receptu"}</span>
                  </button>

                  {/* ULOŽIT RECEPT */}
                  <button
                    type="submit"
                    form="edit-recipe-form"
                    className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold py-2 px-3.5 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer active:scale-98"
                    title="Uložit změny v receptu"
                  >
                    <Check className="h-4.5 w-4.5" />
                    <span>Uložit</span>
                  </button>
                </>
              ) : (
                <>
                  {/* UPRAVIT RECEPT (For Admin) */}
                  {isAdmin && (
                    <button
                      onClick={startEditingRecipe}
                      className="bg-white border border-[#1B4332] text-[#1B4332] hover:bg-emerald-50 font-bold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
                      title="Upravit a doladit kulinářské parametry receptu"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Upravit recept</span>
                    </button>
                  )}


                </>
              )}
            </>
          ) : (
            <>
              {/* HEADER BUTTON: Nový recept */}
              <button
                onClick={handleOpenAddRecipeModal}
                className="bg-[#D97706] hover:bg-[#C26405] active:scale-95 text-white font-bold py-2 px-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
                title="Vytvořit zcela nový recept"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>Nový recept</span>
              </button>
            </>
          )}

          {/* GENERAL ACTIONS (Shed for both home and recipe detailed views) */}
          {/* NÁKUPNÍ KOŠÍK / LIST */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-[#1B4332] border border-emerald-200/60 font-bold p-2 rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer relative"
            title="Zobrazit nákupní lístek / košík surovin"
          >
            <div className="relative">
              <ShoppingBag className="h-4.5 w-4.5 text-emerald-700" />
              {cartItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                  {cartItems.length}
                </span>
              )}
            </div>
          </button>

          {/* ADMINISTRAČNÍ PANEL NASTAVENÍ (For Admin only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveAdminTab("backup");
                setShowAdminSettingsModal(true);
              }}
              className="bg-white hover:bg-[#FDFCF7] text-slate-700 hover:text-[#1B4332] border border-[#E8E8E1] hover:border-[#1B4332]/30 font-bold p-2 rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer"
              title="Administrace a nastavení kuchařky"
            >
              <Settings className="h-4.5 w-4.5 text-slate-600 hover:text-[#1B4332] transition-transform hover:rotate-45 duration-300" />
            </button>
          )}
        </div>
      </header>

      {/* BODY WORKSPACE */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col md:flex-row gap-0 overflow-hidden relative print:h-auto print:overflow-visible">
        
        {/* MOBILE NAVIGATION TABS (Only visible on mobile when no recipe is selected) */}
        {!selectedRecipe && (
          <div className="md:hidden no-print w-full bg-white border-b border-[#E8E8E1] p-2 flex gap-2 flex-shrink-0">
            <button
              onClick={() => setMobileActiveTab("list")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mobileActiveTab === "list"
                  ? "bg-[#1B4332] text-white shadow-xs"
                  : "bg-[#F5F5F0] text-[#5C5C50] hover:text-[#1B4332] hover:bg-[#F5F5F0]/80"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Seznam receptů</span>
            </button>
            <button
              onClick={() => setMobileActiveTab("home")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mobileActiveTab === "home"
                  ? "bg-[#1B4332] text-white shadow-xs"
                  : "bg-[#F5F5F0] text-[#5C5C50] hover:text-[#1B4332] hover:bg-[#F5F5F0]/80"
              }`}
            >
              <ChefHat className="h-4 w-4" />
              <span>O kuchařce (Úvod)</span>
            </button>
          </div>
        )}

        {/* LEFT SIDEBAR: RECIPE LIST */}
        <aside className={`no-print w-full md:w-80 lg:w-96 border-r border-[#E8E8E1] bg-white flex-col flex-shrink-0 ${
          selectedRecipe 
            ? "hidden" 
            : mobileActiveTab === "list"
              ? "flex flex-1 md:flex-initial h-full"
              : "hidden md:flex h-full"
        }`}>

          {/* SEARCH & FILTER CONTROLS */}
          <div className="p-4 border-b border-[#E8E8E1] bg-[#FDFCF7]/60 flex flex-col gap-3">
            {/* Top row with Title and Nový recept button */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B4332] uppercase tracking-wider font-serif">
                Recepty ({recipes.length})
              </span>
              <button
                type="button"
                onClick={handleOpenAddRecipeModal}
                className="bg-[#D97706] hover:bg-[#C26405] active:scale-95 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                title="Vytvořit zcela nový recept"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Nový recept</span>
              </button>
            </div>

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
                            className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-[#F5F5F0] rounded-lg transition-colors text-left font-sans font-bold text-sm text-[#1B4332]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-base leading-none shrink-0">
                                {getCategoryEmoji(category)}
                              </span>
                              <span className="truncate">{category}</span>
                              <span className="text-[11px] font-sans text-white font-bold bg-[#2D6A4F] px-1.5 py-0.5 rounded-full shrink-0">
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
                                      <h3 className={`font-semibold text-sm line-clamp-2 transition-colors leading-snug ${
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
                            className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-[#F5F5F0] rounded-lg transition-colors text-left font-sans font-bold text-sm text-[#1B4332]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 flex items-center justify-center font-extrabold text-[11px] bg-[#1B4332] text-white rounded-md shrink-0">
                                {letter}
                              </span>
                              <span className="truncate">Recepty od "{letter}"</span>
                              <span className="text-[11px] font-sans text-white font-bold bg-[#2D6A4F] px-1.5 py-0.5 rounded-full shrink-0">
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
                                      <h3 className={`font-semibold text-sm line-clamp-2 transition-colors leading-snug ${
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
          {!isAdmin && (
            <div className="p-4 bg-[#F5F5F0] border-t border-[#E8E8E1] text-xs text-[#5C5C50] flex flex-col gap-1.5">
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
          )}
        </aside>

        {/* MAIN WORKSPACE REGION */}
        <main id="main-area" className={`flex-1 bg-[#FDFCF7]/50 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:h-auto ${
          selectedRecipe 
            ? "block" 
            : mobileActiveTab === "home" 
              ? "block" 
              : "hidden md:block"
        }`}>
          
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

                {/* 2A. CONTENT WORKSPACE */}

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

                        {isAuditing ? (
                          <button
                            onClick={handleStopAudit}
                            className="text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-950/45 hover:bg-red-950/80 border border-red-900/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
                            title="Zastavit audit"
                          >
                            <Square className="h-2.5 w-2.5 fill-current" />
                            <span>Zastavit</span>
                          </button>
                        ) : (
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
                          <div className="text-center space-y-3">
                            <p className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                              <span className="inline-block h-2 w-2 bg-emerald-500 rounded-full animate-ping"></span>
                              Zpracovávám pomocí Gemini 3.6 Flash...
                            </p>
                            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                              Právě probíhá kompletní kulinářský audit s vědeckým kulinářským modelem <strong className="text-emerald-300">Gemini 3.6 Flash</strong>. Recept prochází chemickou simulací reakcí surovin, vyvažováním chutí a eliminací konzervantů.
                            </p>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1 bg-slate-950 p-2 rounded-lg max-w-sm mx-auto border border-slate-800">
                              <span>🚀 Aktivní relace: </span>
                              <span className="text-emerald-400 font-bold">gemini-3.6-flash</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleStopAudit}
                              className="mx-auto text-xs bg-red-950/80 hover:bg-red-900 text-red-200 font-bold py-1.5 px-4 rounded-xl border border-red-900/60 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                            >
                              <Square className="h-2.5 w-2.5 fill-red-400" />
                              <span>Zastavit kontrolu</span>
                            </button>
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

                              {/* THREE-ITEM STRUCTURE FOR SELECTION WITH DETAILED REVIEWS */}
                              <div className="space-y-3 bg-slate-950/75 p-4 rounded-xl border border-slate-800/80">
                                <div className="text-slate-300 font-bold border-b border-slate-800/80 pb-1.5 mb-2.5 text-xs flex items-center gap-1.5">
                                  <Settings className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Vyberte složky změn, které chcete zapracovat (3 položky):</span>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                  {/* ITEM 1: Parameters, difficulty, summary */}
                                  <div 
                                    className={`p-3 rounded-lg border transition-all select-none ${
                                      acceptAuditParams 
                                        ? "bg-emerald-950/25 border-emerald-500/40 text-slate-100" 
                                        : "bg-slate-900/50 border-slate-800/80 text-slate-500"
                                    }`} 
                                  >
                                    <div 
                                      className="flex items-start gap-2.5 cursor-pointer"
                                      onClick={() => setAcceptAuditParams(!acceptAuditParams)}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={acceptAuditParams} 
                                        onChange={() => {}} // handled by parent click
                                        className="mt-1 accent-emerald-500 h-4 w-4 shrink-0 rounded cursor-pointer"
                                      />
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-slate-200">1. Parametry, obtížnost a shrnutí</span>
                                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                            acceptAuditParams ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                                          }`}>
                                            {acceptAuditParams ? "PŘIJMOUT" : "IGNOROVAT"}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                          Aktualizovat dobu přípravy na <strong className="text-emerald-400">{auditModifiedRecipe?.cookingTime}</strong> (původně: {selectedRecipe.cookingTime}) a náročnost na <strong className="text-emerald-400">{auditModifiedRecipe?.difficulty}</strong>, včetně nového shrnutí a technických rad.
                                        </p>
                                      </div>
                                    </div>

                                    {/* Detailed Review Button */}
                                    <div className="mt-2 pl-6">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowParamsDiff(!showParamsDiff);
                                        }}
                                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                                      >
                                        {showParamsDiff ? (
                                          <>
                                            <EyeOff className="h-3 w-3" />
                                            <span>Skrýt srovnání změn</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="h-3 w-3" />
                                            <span>Zobrazit detailní srovnání změn</span>
                                          </>
                                        )}
                                      </button>
                                      
                                      {/* Detailed Comparison Panel */}
                                      {showParamsDiff && (
                                        <div 
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-2.5 text-slate-300 select-text"
                                        >
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800/50">
                                              <div className="text-slate-500 uppercase tracking-wider font-semibold text-[9px]">Původní hodnoty:</div>
                                              <div>• Celková doba: <span className="text-slate-400 font-medium">{selectedRecipe.cookingTime}</span></div>
                                              <div>• Náročnost: <span className="text-slate-400 font-medium">{selectedRecipe.difficulty}</span></div>
                                              <div>• Spotřebič: <span className="text-slate-400 font-medium">{selectedRecipe.applianceType || "Neuveden"}</span></div>
                                            </div>
                                            <div className="space-y-1 bg-emerald-950/20 p-2 rounded-lg border border-emerald-900/40">
                                              <div className="text-emerald-400/80 uppercase tracking-wider font-semibold text-[9px]">Navržené hodnoty:</div>
                                              <div>• Celková doba: <span className="text-emerald-400 font-bold">{auditModifiedRecipe?.cookingTime}</span></div>
                                              <div>• Náročnost: <span className="text-emerald-400 font-bold">{auditModifiedRecipe?.difficulty}</span></div>
                                              <div>• Spotřebič: <span className="text-emerald-400 font-bold">{auditModifiedRecipe?.applianceType}</span></div>
                                            </div>
                                          </div>
                                          {selectedRecipe.summary !== auditModifiedRecipe?.summary && (
                                            <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                                              <div className="text-slate-500 uppercase tracking-wider font-semibold text-[9px]">Srovnání shrnutí:</div>
                                              <div className="text-slate-500 line-through mb-1">Původní: {selectedRecipe.summary}</div>
                                              <div className="text-emerald-300 font-medium">Nové: {auditModifiedRecipe?.summary}</div>
                                            </div>
                                          )}
                                          {selectedRecipe.applianceTips !== auditModifiedRecipe?.applianceTips && (
                                            <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                                              <div className="text-slate-500 uppercase tracking-wider font-semibold text-[9px]">Tipy pro moderní spotřebiče:</div>
                                              <div className="text-emerald-300/90 leading-relaxed font-mono">{auditModifiedRecipe?.applianceTips}</div>
                                            </div>
                                          )}
                                          <div className="space-y-1 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                                            <div className="text-slate-500 uppercase tracking-wider font-semibold text-[9px]">Vědecké kulinářské zdůvodnění:</div>
                                            <p className="text-slate-300 leading-relaxed italic">{auditModifiedRecipe?.expertJustification}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* ITEM 2: Ingredients */}
                                  <div 
                                    className={`p-3 rounded-lg border transition-all select-none ${
                                      acceptAuditIngredients 
                                        ? "bg-emerald-950/25 border-emerald-500/40 text-slate-100" 
                                        : "bg-slate-900/50 border-slate-800/80 text-slate-500"
                                    }`} 
                                  >
                                    <div 
                                      className="flex items-start gap-2.5 cursor-pointer"
                                      onClick={() => setAcceptAuditIngredients(!acceptAuditIngredients)}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={acceptAuditIngredients} 
                                        onChange={() => {}} // handled by parent click
                                        className="mt-1 accent-emerald-500 h-4 w-4 shrink-0 rounded cursor-pointer"
                                      />
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-slate-200">2. Optimalizované složení a bilance surovin</span>
                                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                            acceptAuditIngredients ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                                          }`}>
                                            {acceptAuditIngredients ? "PŘIJMOUT" : "IGNOROVAT"}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                          Uplatnit matematický přepočet mouky a vody pro optimální hydrataci. Změna počtu ingrediencí na <strong className="text-emerald-400">{auditModifiedRecipe?.ingredients.length}</strong> (původně: {selectedRecipe.ingredients.length}).
                                        </p>
                                      </div>
                                    </div>

                                    {/* Detailed Review Button */}
                                    <div className="mt-2 pl-6">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowIngredientsDiff(!showIngredientsDiff);
                                        }}
                                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                                      >
                                        {showIngredientsDiff ? (
                                          <>
                                            <EyeOff className="h-3 w-3" />
                                            <span>Skrýt srovnání surovin</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="h-3 w-3" />
                                            <span>Zobrazit detailní srovnání surovin</span>
                                          </>
                                        )}
                                      </button>
                                      
                                      {/* Detailed Comparison Panel */}
                                      {showIngredientsDiff && (
                                        <div 
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-3 select-text"
                                        >
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50 space-y-1.5">
                                              <div className="text-slate-500 uppercase tracking-wider font-semibold text-[9px] border-b border-slate-800/80 pb-1 mb-1">Originální suroviny ({selectedRecipe.ingredients.length}):</div>
                                              <ul className="space-y-1 list-disc list-inside text-slate-400 font-mono">
                                                {selectedRecipe.ingredients.map((ing, idx) => (
                                                  isIngredientHeader(ing) ? (
                                                    <li key={idx} className="list-none pt-1 font-bold text-amber-400 uppercase text-[10px] -ml-2">📌 {cleanHeaderTitle(ing)}</li>
                                                  ) : (
                                                    <li key={idx} className="truncate">{ing}</li>
                                                  )
                                                ))}
                                              </ul>
                                            </div>
                                            <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 space-y-1.5">
                                              <div className="text-emerald-400/80 uppercase tracking-wider font-semibold text-[9px] border-b border-emerald-800/40 pb-1 mb-1">Optimalizované složení ({auditModifiedRecipe?.ingredients.length}):</div>
                                              <ul className="space-y-1 list-disc list-inside text-slate-200 font-mono">
                                                {auditModifiedRecipe?.ingredients.map((ing, idx) => {
                                                  if (isIngredientHeader(ing)) {
                                                    return (
                                                      <li key={idx} className="list-none pt-1 font-bold text-emerald-400 uppercase text-[10px] -ml-2">📌 {cleanHeaderTitle(ing)}</li>
                                                    );
                                                  }
                                                  const isExactMatch = selectedRecipe.ingredients.includes(ing);
                                                  return (
                                                    <li key={idx} className={isExactMatch ? "truncate text-slate-300" : "truncate text-emerald-300 font-bold"}>
                                                      {ing} {!isExactMatch && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-bold uppercase ml-1">Nová</span>}
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* ITEM 3: Instructions */}
                                  <div 
                                    className={`p-3 rounded-lg border transition-all select-none ${
                                      acceptAuditInstructions 
                                        ? "bg-emerald-950/25 border-emerald-500/40 text-slate-100" 
                                        : "bg-slate-900/50 border-slate-800/80 text-slate-500"
                                    }`} 
                                  >
                                    <div 
                                      className="flex items-start gap-2.5 cursor-pointer"
                                      onClick={() => setAcceptAuditInstructions(!acceptAuditInstructions)}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={acceptAuditInstructions} 
                                        onChange={() => {}} // handled by parent click
                                        className="mt-1 accent-emerald-500 h-4 w-4 shrink-0 rounded cursor-pointer"
                                      />
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-slate-200">3. Přepracovaný technologický postup</span>
                                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                            acceptAuditInstructions ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
                                          }`}>
                                            {acceptAuditInstructions ? "PŘIJMOUT" : "IGNOROVAT"}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                          Zapsat opravené časy fermentace, hnětení a intervaly překládání. Nový postup má <strong className="text-emerald-400">{auditModifiedRecipe?.instructions.length} kroků</strong> (původně: {selectedRecipe.instructions.length}).
                                        </p>
                                      </div>
                                    </div>

                                    {/* Detailed Review Button */}
                                    <div className="mt-2 pl-6">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowInstructionsDiff(!showInstructionsDiff);
                                        }}
                                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                                      >
                                        {showInstructionsDiff ? (
                                          <>
                                            <EyeOff className="h-3 w-3" />
                                            <span>Skrýt srovnání postupu</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="h-3 w-3" />
                                            <span>Zobrazit detailní srovnání postupu</span>
                                          </>
                                        )}
                                      </button>
                                      
                                      {/* Detailed Comparison Panel */}
                                      {showInstructionsDiff && (
                                        <div 
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-3 select-text"
                                        >
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50 space-y-2">
                                              <div className="text-slate-500 uppercase tracking-wider font-semibold text-[9px] border-b border-slate-800/80 pb-1">Originální technologický postup ({selectedRecipe.instructions.length} kroků):</div>
                                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                {selectedRecipe.instructions.map((step, idx) => (
                                                  <div key={idx} className="text-slate-400 flex gap-1.5 items-start">
                                                    <span className="font-bold text-slate-500 shrink-0">{idx + 1}.</span>
                                                    <p className="leading-normal">{step}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 space-y-2">
                                              <div className="text-emerald-400/80 uppercase tracking-wider font-semibold text-[9px] border-b border-emerald-800/40 pb-1">Přepracovaný postup ({auditModifiedRecipe?.instructions.length} kroků):</div>
                                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                {auditModifiedRecipe?.instructions.map((step, idx) => {
                                                  const isExactMatch = selectedRecipe.instructions.includes(step);
                                                  return (
                                                    <div key={idx} className={`flex gap-1.5 items-start ${isExactMatch ? "text-slate-300" : "text-emerald-200 font-medium"}`}>
                                                      <span className={`font-bold shrink-0 ${isExactMatch ? "text-slate-500" : "text-emerald-400"}`}>{idx + 1}.</span>
                                                      <p className="leading-normal">
                                                        {step} {!isExactMatch && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-bold uppercase ml-1 shrink-0 inline-block font-sans">Upraveno</span>}
                                                      </p>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-1 flex items-center gap-3 flex-wrap">
                                <button
                                  type="button"
                                  onClick={handleAcceptAuditChange}
                                  disabled={!acceptAuditParams && !acceptAuditIngredients && !acceptAuditInstructions}
                                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <Check className="h-4 w-4 stroke-[3]" />
                                  <span>Uložit vybrané změny do receptu</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRejectAuditChange}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer border border-slate-700"
                                >
                                  Zrušit
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>


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

                      {/* Prompt presets & Active model info */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 mt-2 pt-1 border-t border-[#FEF3C7]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditPrompt("AI")}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border border-amber-200 active:scale-95"
                            title="Nastavit prompt jako 'AI'"
                          >
                            🪄 Nastavit prompt jako 'AI'
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPrompt("AI: Vyvážit chutě, optimalizovat nutriční hodnoty a zmodernizovat postupy.")}
                            className="bg-[#FFFBEB] hover:bg-amber-100 text-[#B45309] text-[10px] sm:text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border border-amber-200/50 active:scale-95"
                            title="Nastavit pokročilý AI prompt"
                          >
                            💡 Pokročilý AI prompt
                          </button>
                        </div>
                        <div className="text-[10px] text-[#92400E] font-mono font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/40 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Aktivní model: Gemini 3.6 Flash
                        </div>
                      </div>
                      {editError && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {editError}
                        </p>
                      )}

                      {editLogs.length > 0 && (
                        <div className="mt-3 bg-[#1E1E1C] border border-[#2D2D2A] rounded-xl p-3.5 font-mono text-[11px] leading-relaxed text-[#DCD1BA] shadow-inner space-y-2.5">
                          <div className="flex items-center justify-between border-b border-[#3A3A34] pb-1.5 text-[10px] text-[#8C8273] uppercase tracking-wider font-bold">
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <Sparkles className="h-3.5 w-3.5" />
                              Průběh kulinářské analýzy (živý log)
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-bold">{editProgressPercent}%</span>
                              {isEditLoading && (
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-[#2D2D2A] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full transition-all duration-300 ease-out"
                              style={{ width: `${editProgressPercent}%` }}
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 select-text pt-0.5">
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
                    <form id="edit-recipe-form" onSubmit={handleSaveEditedRecipe} className="space-y-4">
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
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                              Shrnutí / Podstata vylepšení <span className="text-amber-700 font-normal normal-case">(vždy uveďte časy, např. 2 h marinování v zmesi, 45 min pečení)</span>
                            </label>
                          </div>
                          <textarea 
                            rows={2}
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            placeholder="Např. Šťavnaté maso odležené 2 hodiny v marinádě, pečené 45 min v horkovzdušné fritéze."
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
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">Celková doba</label>
                          <input 
                            type="text"
                            value={editCookingTime}
                            onChange={(e) => setEditCookingTime(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            required
                          />
                        </div>

                        {/* Estimated Cooking Time */}
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider flex items-center justify-between">
                            <span>Tepelná úprava (expert)</span>
                            <span className="text-[10px] text-amber-800 font-medium lowercase">volitelné</span>
                          </label>
                          <input 
                            type="text"
                            value={editEstimatedCookingTime}
                            onChange={(e) => setEditEstimatedCookingTime(e.target.value)}
                            className="w-full text-sm p-3 border border-[#E8E8E1] rounded-lg bg-[#FDFCF7] text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                            placeholder="Např. 45 min, nebo ponechte prázdné pro autodetekci"
                          />
                          <p className="text-[10px] text-slate-500 italic mt-0.5">Pokud ponecháte prázdné, doplní se automaticky podle celkové doby.</p>
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
                            {allUsedCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
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
                    </form>
                  </div>
                ) : showExportView ? (
                  /* 2C. SIMPLE TEXT FORMAT / EXPORT VIEW */
                  <div className="space-y-6 animate-fade-in print:m-0 print:border-none">
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
                    <div className="printable-recipe-sheet bg-[#FCF9F2] border border-[#E3DDCF] rounded-2xl shadow-sm p-5 sm:p-8 text-[#2C2C2C] space-y-5">
                      
                      {/* Monospace Header Typewriter-Like */}
                      <div className="border-b border-[#D8D2C2] pb-4 space-y-2 break-inside-avoid">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-mono tracking-widest text-[#888172] uppercase font-bold">
                            RECEPT Z AI KUCHAŘKY • 5 PILÍŘOVÁ SYNTÉZA
                          </span>
                          <div className="flex items-center gap-2">
                            {selectedRecipe.category && (
                              <span className="text-xs font-bold text-[#2D6A4F] bg-[#E8F5E9] px-2.5 py-0.5 rounded-full uppercase">
                                {selectedRecipe.category}
                              </span>
                            )}
                            <span className="text-xs font-mono bg-[#1B4332]/10 text-[#1B4332] px-2 py-0.5 rounded font-bold">
                              Porce: {scaleFactor === 1 ? "1x" : `${formatCzechNumber(scaleFactor)}x`}
                            </span>
                          </div>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-serif font-black text-[#1B4332] tracking-tight">
                          {selectedRecipe.title}
                        </h2>
                        {selectedRecipe.summary && (
                          <p className="text-sm sm:text-base text-[#46463D] leading-relaxed font-serif italic pt-0.5">
                            {selectedRecipe.summary}
                          </p>
                        )}
                      </div>

                      {/* INGREDIENTS LIST (PAGE 1 DIRECTLY AFTER HEADER) */}
                      <div className="space-y-2 break-inside-avoid">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1 page-break-after-avoid">
                          Suroviny a ingredience (přesné poměry)
                        </h3>
                        <ul className="columns-1 sm:columns-2 gap-x-6 text-sm sm:text-base font-serif">
                          {selectedRecipe.ingredients.map((ing, i) => {
                            if (isIngredientHeader(ing)) {
                              const headerTitle = cleanHeaderTitle(ing);
                              return (
                                <li key={i} className="[column-span:all] pt-2 pb-0.5 font-bold font-serif text-[#1B4332] text-sm border-b border-[#1B4332]/20 uppercase tracking-wide list-none break-inside-avoid">
                                  📌 {headerTitle}
                                </li>
                              );
                            }
                            const parsed = parseIngredientString(ing);
                            const displayIng = scaleIngredient(parsed, scaleFactor);
                            return (
                              <li key={i} className="break-inside-avoid py-1 text-[#3A3A34] border-b border-[#F0EFEA] last:border-0 leading-snug">
                                {displayIng}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* INSTRUCTIONS */}
                      <div className="space-y-3 pt-1">
                        <h3 className="font-serif font-bold text-lg text-[#1B4332] border-b border-[#E8E8E1] pb-1 page-break-after-avoid">
                          Postup přípravy (krok za krokem)
                        </h3>
                        <div className="space-y-2.5 text-sm sm:text-base font-serif">
                          {(() => {
                            let previewStepNum = 1;
                            return selectedRecipe.instructions.map((step, idx) => {
                              if (isIngredientHeader(step)) {
                                const headerTitle = cleanHeaderTitle(step);
                                return (
                                  <div key={idx} className="pt-3 pb-1 border-b-2 border-[#1B4332] mt-4 mb-2 page-break-after-avoid">
                                    <h4 className="font-serif font-bold text-sm sm:text-base text-[#1B4332] uppercase tracking-wide flex items-center gap-2">
                                      <span>📌</span> {headerTitle}
                                    </h4>
                                  </div>
                                );
                              }
                              const currentNum = previewStepNum++;
                              return (
                                <div key={idx} className="instruction-step flex flex-col gap-1 leading-relaxed break-inside-avoid p-3 rounded-lg bg-[#FAF8F3] border border-[#E8E4DB]">
                                  <div className="flex gap-2.5 items-start">
                                    <span className="font-mono text-[#FFFFFF] bg-[#1B4332] font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                      {currentNum}
                                    </span>
                                    <p className="text-[#3A3A34] flex-1 text-sm sm:text-base">{step}</p>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* SECONDARY METADATA & PARAMETERS AT THE VERY END */}
                      <div className="meta-bottom-block bg-[#F7F4EA] border border-[#E3DDCF] rounded-xl p-4 space-y-3 break-inside-avoid text-sm">
                        <h4 className="font-serif font-bold text-sm text-[#1B4332] border-b border-[#D8D2C2] pb-1 uppercase tracking-wider font-mono">
                          Doplňující informace a technické parametry
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm font-sans text-slate-700">
                          <div>
                            <span className="block text-xs font-mono uppercase text-[#888172] font-bold">Celková doba</span>
                            <span className="font-bold text-[#1B4332] font-serif text-sm">{selectedRecipe.cookingTime || "Není uvedeno"}</span>
                          </div>
                          <div>
                            <span className="block text-xs font-mono uppercase text-[#888172] font-bold">Náročnost</span>
                            <span className="font-bold text-[#1B4332] font-serif text-sm">{selectedRecipe.difficulty || "Střední"}</span>
                          </div>
                          <div>
                            <span className="block text-xs font-mono uppercase text-[#888172] font-bold">Spotřebič</span>
                            <span className="font-bold text-[#1B4332] font-serif text-sm">{selectedRecipe.applianceType || "Sporák"}</span>
                          </div>
                          <div>
                            <span className="block text-xs font-mono uppercase text-[#888172] font-bold">Tepelná úprava</span>
                            <span className="font-bold text-emerald-800 font-serif text-sm">{selectedRecipe.estimatedCookingTime || "Není uvedeno"}</span>
                          </div>
                        </div>

                        {selectedRecipe.applianceTips && (
                          <div className="pt-2 border-t border-[#E3DDCF]">
                            <span className="font-bold text-[#1B4332] block font-mono text-xs uppercase">Doporučení pro spotřebič ({selectedRecipe.applianceType}):</span>
                            <p className="text-xs sm:text-sm text-[#3A3A34] font-serif mt-0.5 leading-relaxed">{selectedRecipe.applianceTips}</p>
                          </div>
                        )}

                        {selectedRecipe.expertJustification && (
                          <div className="pt-2 border-t border-[#E3DDCF]">
                            <span className="font-bold text-[#1B4332] block font-mono text-xs uppercase">Kulinářská chemie & vědecké zdůvodnění:</span>
                            <p className="text-xs sm:text-sm text-[#3A3A34] font-serif mt-0.5 leading-relaxed">{selectedRecipe.expertJustification}</p>
                          </div>
                        )}
                      </div>

                      {/* PARCHMENT FEET */}
                      <div className="border-t border-[#D8D2C2] pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-[#888172] gap-2 break-inside-avoid">
                        <span>AI Kuchařka • Moderní gastronomické inženýrství</span>
                        <span>Vygenerováno dne: {new Date().toLocaleDateString("cs-CZ")}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* TOP RECIPE CONTROLS TOOLBAR (Single horizontal row) */}
                    <div className="no-print bg-[#FDFBF7] border border-[#E8E4DB] rounded-2xl p-2.5 sm:p-3 shadow-2xs mb-6 flex flex-row items-center justify-between gap-2 overflow-x-auto select-none no-scrollbar">
                      
                      {/* Left Group: Servings & Font Size */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Počet porcí (Servings controller) */}
                        <div className="flex items-center gap-1 bg-white border border-[#E8E4DB] rounded-xl p-1 font-sans text-xs shadow-2xs shrink-0">
                          <span className="px-1.5 font-bold text-[#555] flex items-center gap-1 whitespace-nowrap">
                            Porce:
                          </span>
                          <button
                            type="button"
                            onClick={() => setScaleFactor(prev => Math.max(0.25, Number((prev - 0.25).toFixed(2))))}
                            className="h-6 w-6 rounded-lg bg-[#FDFBF7] text-[#1B4332] hover:bg-[#E8F5E9] font-bold flex items-center justify-center transition-all cursor-pointer border border-[#E8E4DB] active:scale-95"
                            title="Méně porcí"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-bold font-mono text-[#1B4332] text-xs">
                            {formatCzechNumber(scaleFactor)}x
                          </span>
                          <button
                            type="button"
                            onClick={() => setScaleFactor(prev => Number((prev + 0.25).toFixed(2)))}
                            className="h-6 w-6 rounded-lg bg-[#FDFBF7] text-[#1B4332] hover:bg-[#E8F5E9] font-bold flex items-center justify-center transition-all cursor-pointer border border-[#E8E4DB] active:scale-95"
                            title="Více porcí"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          {scaleFactor !== 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setScaleFactor(1);
                                setEditingIngredientIndex(null);
                                setEditingValue("");
                              }}
                              className="px-1.5 text-[10px] font-black text-amber-750 hover:text-amber-900 cursor-pointer uppercase underline"
                              title="Obnovit výchozí porce"
                            >
                              Původní
                            </button>
                          )}
                        </div>

                        {/* Velikost textu (Font Size Selector) */}
                        <div className="flex items-center gap-1 bg-white border border-[#E8E4DB] rounded-xl p-1 font-sans text-xs shadow-2xs shrink-0">
                          <span className="px-1.5 font-bold text-[#555] whitespace-nowrap">Velikost textu:</span>
                          <div className="flex items-center gap-0.5">
                            {(["normal", "large", "extra-large"] as const).map((size) => (
                              <button
                                type="button"
                                key={size}
                                onClick={() => setPaperFontSize(size)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                  paperFontSize === size
                                    ? "bg-[#2D6A4F] text-white shadow-3xs"
                                    : "bg-[#FDFBF7] text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {size === "normal" ? "Standardní" : size === "large" ? "Větší" : "Největší"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Group: Export & Print Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Stáhnout text (TXT) */}
                        <button
                          type="button"
                          onClick={() => {
                            const element = document.createElement("a");
                            const file = new Blob([generateRecipeText()], {type: 'text/plain;charset=utf-8'});
                            element.href = URL.createObjectURL(file);
                            element.download = `${selectedRecipe.title.toLowerCase().replace(/\s+/g, "_")}_recept.txt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                          className="flex items-center gap-1.5 bg-white border border-[#E8E4DB] hover:bg-slate-50 text-slate-700 hover:text-[#1B4332] px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                          title="Stáhnout recept jako textový soubor (TXT)"
                        >
                          <Download className="h-3.5 w-3.5 text-emerald-600 font-bold" />
                          <span>Stáhnout text</span>
                        </button>

                        {/* Kopírovat text */}
                        <button
                          type="button"
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
                          className={`flex items-center gap-1.5 border border-[#E8E4DB] px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
                            copiedText 
                              ? "bg-emerald-700 text-white border-emerald-700" 
                              : "bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                          title="Zkopírovat recept do schránky"
                        >
                          <Copy className="h-3.5 w-3.5 text-slate-500 font-bold" />
                          <span>{copiedText ? "Zkopírováno!" : "Kopírovat"}</span>
                        </button>

                        {/* Tisknout (Tisk) */}
                        <button
                          type="button"
                          onClick={triggerPaperPrint}
                          className="flex items-center gap-1.5 bg-[#1B4332] text-white hover:bg-[#2D6A4F] px-3 py-1.5 rounded-xl font-sans font-bold text-xs transition-all cursor-pointer shadow-md active:scale-95 whitespace-nowrap"
                          title="Vytisknout recept"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Tisknout</span>
                        </button>
                      </div>

                    </div>

                    {/* 2A. MAIN RECIPE PRINTABLE CARD */}
                    <div className="printable-recipe-sheet bg-white border border-[#E8E8E1] rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6 print:border-none print:shadow-none">
                      
                      {/* Title Header and Print Metadata Summary */}
                      <div className="border-b border-[#E8E8E1] pb-5 space-y-3">
                        {selectedRecipe.category && (
                          <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-[#2D6A4F] bg-[#E8F5E9] px-3 py-1 rounded-full font-sans inline-block">
                            {selectedRecipe.category}
                          </span>
                        )}
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-[#1B4332] leading-tight tracking-tight">
                          {selectedRecipe.title}
                        </h2>

                        {selectedRecipe.summary && (
                          <p className="text-slate-600 font-serif italic text-sm sm:text-base leading-relaxed pt-1">
                            {selectedRecipe.summary}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-xs font-mono bg-[#1B4332]/10 text-[#1B4332] px-2.5 py-1 rounded-md font-bold">
                            Porce: {scaleFactor === 1 ? "Výchozí (1x)" : `${formatCzechNumber(scaleFactor)}x`}
                          </span>
                        </div>
                      </div>

                    {/* SINGLE-COLUMN FLOW FOR INGREDIENTS AND PREPARATION (PROCEDURE BELOW INGREDIENTS) */}
                    <div className="space-y-8 pt-2">
                      
                      {/* 1. Ingredients Check-list Section (In one column) */}
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E8E8E1]">
                          <h3 className="text-base font-bold uppercase text-[#1B4332] flex items-center gap-2 tracking-wider font-serif">
                            <UtensilsCrossed className="h-5 w-5 text-[#D97706]" />
                            <span>Suroviny a ingredience</span>
                          </h3>
                          <p className="text-xs text-[#9A9A8C] italic">
                            Tip: Suroviny si při přípravě na lince odškrtávejte.
                          </p>
                        </div>

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

                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
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

                        <div className="space-y-1 bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E8E8E1] shadow-2xs">
                          {selectedRecipe.ingredients.map((ing, i) => {
                            if (isIngredientHeader(ing)) {
                              const headerTitle = cleanHeaderTitle(ing);
                              return (
                                <div 
                                  key={i} 
                                  className="mt-5 first:mt-0 mb-2 pt-3 pb-1.5 border-b-2 border-[#1B4332]/25 flex items-center gap-2 select-none"
                                >
                                  <span className="text-[10px] sm:text-[11px] bg-[#1B4332] text-white px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase">
                                    Sekce
                                  </span>
                                  <h4 className="font-serif font-bold text-[#1B4332] text-base sm:text-lg">
                                    {headerTitle}
                                  </h4>
                                </div>
                              );
                            }

                            const isChecked = !!checkedIngredients[ing];
                            const parsed = parseIngredientString(ing);
                            const displayIng = scaleIngredient(parsed, scaleFactor);
                            return (
                              <div 
                                key={i}
                                onClick={() => toggleIngredient(ing)}
                                className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer select-none border-b border-[#E8E8E1]/60 last:border-0 ${
                                  isChecked 
                                  ? "bg-[#EAE8E3]/60 text-slate-400 line-through opacity-75" 
                                  : "bg-white hover:bg-[#F0F4F1] text-[#2C2C2C] border border-[#E8E8E1]/40 hover:border-[#1B4332]/30 shadow-2xs"
                                }`}
                              >
                                <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                                  isChecked 
                                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" 
                                  : "border-[#1B4332]/40 bg-white"
                                }`}>
                                  {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                </div>
                                <span className={`leading-relaxed ${
                                  paperFontSize === "normal" ? "text-base font-medium" :
                                  paperFontSize === "large" ? "text-lg font-semibold" :
                                  "text-xl font-bold"
                                }`}>{displayIng}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Step-by-Step Instructions Section (In second column / block below ingredients) */}
                      <div className="space-y-4 pt-4 border-t border-[#E8E8E1]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E8E8E1]">
                          <h3 className="text-base font-bold uppercase text-[#1B4332] flex items-center gap-2 tracking-wider font-serif">
                            <ChefHat className="h-5 w-5 text-[#D97706]" />
                            <span>Postup přípravy</span>
                          </h3>
                          <p className="text-xs text-[#9A9A8C] italic">
                            Tip: Označte si hotové kroky pro snazší orientaci v průběhu.
                          </p>
                        </div>

                        <div className="space-y-3.5">
                          {(() => {
                            let mainStepNum = 1;
                            return selectedRecipe.instructions.map((step, index) => {
                              if (isIngredientHeader(step)) {
                                const headerTitle = cleanHeaderTitle(step);
                                return (
                                  <div key={index} className="pt-4 pb-1.5 border-b-2 border-[#1B4332] mt-6 mb-3 first:mt-0">
                                    <h4 className="font-serif font-bold text-base sm:text-lg text-[#1B4332] uppercase tracking-wider flex items-center gap-2">
                                      <span className="text-emerald-700">📌</span> {headerTitle}
                                    </h4>
                                  </div>
                                );
                              }

                              const currentNum = mainStepNum++;
                              const isCompleted = !!checkedInstructions[index];
                              return (
                                <div 
                                  key={index}
                                  onClick={() => toggleInstruction(index)}
                                  className={`instruction-step p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex gap-4 break-inside-avoid ${
                                    isCompleted 
                                    ? "bg-[#F0F4F1]/60 border-emerald-100 text-slate-400 opacity-80" 
                                    : "bg-white hover:bg-[#FDFCF7] border-[#E8E8E1] hover:border-[#1B4332]/30 shadow-2xs"
                                  }`}
                                >
                                  {/* Step Number Badge */}
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-extrabold flex-shrink-0 transition-colors ${
                                    isCompleted 
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                    : "bg-[#1B4332] text-white shadow-xs"
                                  }`}>
                                    {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : currentNum}
                                  </div>

                                  <div className="space-y-2 flex-1">
                                    <p className={`leading-relaxed ${
                                      paperFontSize === "normal" ? "text-base" :
                                      paperFontSize === "large" ? "text-lg font-medium" :
                                      "text-xl font-semibold"
                                    } ${isCompleted ? 'text-slate-400' : 'text-[#2C2C2C]'}`}>
                                      {step}
                                    </p>
                                  </div>
                                </div>
                              );
                            });
                          })()}
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
              
              /* 3. UNIVERSAL HOME SCREEN (DOMOVSKÁ OBRAZOVKA) */
              <motion.div
                key="input-portal"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto space-y-8 pb-10"
              >
                {/* HERO WELCOME BANNER & DESCRIPTION */}
                <div className="bg-white border border-[#E8E8E1] rounded-2xl p-8 sm:p-10 text-center space-y-6 shadow-sm max-w-2xl mx-auto my-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-700" />
                  
                  <div className="mx-auto w-18 h-18 bg-emerald-50 rounded-full flex items-center justify-center text-[#2D6A4F] border border-emerald-100/60 shadow-xs">
                    <ChefHat className="w-10 h-10 animate-bounce-subtle" />
                  </div>
                  
                  <div className="space-y-4">
                    <span className="inline-block text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                      Vědecky ověřené kulinářské umění
                    </span>
                    <h3 className="font-serif italic font-extrabold text-3xl text-[#1B4332] tracking-tight">
                      Vítejte v AI Kuchařce
                    </h3>
                    <p className="text-sm text-[#4A4A40] leading-relaxed font-semibold max-w-lg mx-auto">
                      Váš inteligentní kulinářský asistent, který propojuje moderní vědu (Food Science) s poctivou, 100% přírodní domácí kuchyní.
                    </p>
                    <div className="text-xs text-slate-500 leading-relaxed max-w-xl mx-auto space-y-3 pt-2 text-justify sm:text-center">
                      <p>
                        <strong>AI Kuchařka</strong> slouží k precizní úpravě a optimalizaci receptů. 
                        Na rozdíl od běžných receptářů, každý pokrm zde prochází přísným rozborem kulinářské chemie a fyziky. 
                        Zásadně se vyhýbáme jakékoli průmyslové chemii, polotovarům či konzervantům.
                      </p>
                      <p>
                        Každý krok postupu je navržen tak, aby byl maximálně srozumitelný. Ingredience jsou propočítávány 
                        v reálném čase a jejich přesné gramáže, objemy či kusy vidíte <strong>přímo v textu konkrétního kroku</strong>, 
                        takže nemusíte neustále přebíhat očima nahoru k seznamu surovin.
                      </p>
                    </div>
                  </div>
                </div>

                {/* METODIKA STABILNÍHO VAŘENÍ (PĚT PILÍŘŮ AI KUCHAŘKY) */}
                <div className="bg-white border border-[#E8E8E1] rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
                  <div className="space-y-1.5">
                    <h4 className="font-serif italic font-bold text-xl text-[#1B4332] flex items-center gap-2">
                      <Globe className="h-5.5 w-5.5 text-[#D97706]" />
                      <span>Jak to funguje? (Pět pilířů technologie)</span>
                    </h4>
                    <p className="text-xs text-[#5C5C50] leading-relaxed font-medium">
                      Prostřednictvím umělé inteligence prochází každý recept komplexní syntézou, která garantuje úspěch bez ohledu na úroveň vašich zkušeností:
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#FDFCF7] p-4.5 rounded-xl border border-[#E8E8E1] space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332] font-serif">
                        <span className="bg-[#1B4332] text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] shrink-0">1</span>
                        <span>Food Science (Chemie jídla)</span>
                      </div>
                      <p className="text-[11px] text-[#5C5C50] leading-relaxed">
                        Propočítává přesné fyzikální teploty pro optimální rozklad kolagenu v mase a želatinizaci škrobů v omáčkách. Výsledkem je dokonale šťavnaté jídlo.
                      </p>
                    </div>

                    <div className="bg-[#FDFCF7] p-4.5 rounded-xl border border-[#E8E8E1] space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332] font-serif">
                        <span className="bg-[#1B4332] text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] shrink-0">2</span>
                        <span>Culinary Masterclass (Praxe)</span>
                      </div>
                      <p className="text-[11px] text-[#5C5C50] leading-relaxed">
                        Převádí složité techniky z michelinských restaurací do jednoduchých a snadno popsatelných manuálních úkonů pro domácí kuchyni.
                      </p>
                    </div>

                    <div className="bg-[#FDFCF7] p-4.5 rounded-xl border border-[#E8E8E1] space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332] font-serif">
                        <span className="bg-[#1B4332] text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] shrink-0">3</span>
                        <span>Analýza chuťových poměrů (Data)</span>
                      </div>
                      <p className="text-[11px] text-[#5C5C50] leading-relaxed">
                        Porovnává a ladí poměry koření, solí a kyselin na základě tisíců úspěšných gastronomických receptur pro plnou, hlubokou chuť.
                      </p>
                    </div>

                    <div className="bg-[#FDFCF7] p-4.5 rounded-xl border border-[#E8E8E1] space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332] font-serif">
                        <span className="bg-[#1B4332] text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] shrink-0">4</span>
                        <span>Eliminace chyb amatérů (Prevence)</span>
                      </div>
                      <p className="text-[11px] text-[#5C5C50] leading-relaxed">
                        Identifikuje kritické body, na kterých lidé nejčastěji pohoří (např. sražení omáčky, vysušení drůbeže) a předchází jim jasným varováním.
                      </p>
                    </div>

                    <div className="bg-[#FDFCF7] p-4.5 rounded-xl border border-[#E8E8E1] space-y-1.5 md:col-span-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332] font-serif">
                        <span className="bg-[#1B4332] text-white w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] shrink-0">5</span>
                        <span>Optimalizace moderních spotřebičů</span>
                      </div>
                      <p className="text-[11px] text-[#5C5C50] leading-relaxed">
                        Přizpůsobuje receptury pro horkovzdušné fritézy, domácí pekárny, pomalé hrnce a roboty (Thermomix), čímž ušetří spoustu času i energie.
                      </p>
                    </div>
                  </div>
                </div>

                {/* RYCHLÝ PRŮVODCE PRO UŽIVATELE */}
                <div className="bg-white border border-[#E8E8E1] rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
                  <h4 className="font-serif italic font-bold text-xl text-[#1B4332] flex items-center gap-2">
                    <Sparkles className="h-5.5 w-5.5 text-emerald-600" />
                    <span>Průvodce: Jak pracovat s kuchařkou?</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                    <div className="p-4 bg-[#FDFCF7] border border-[#E8E8E1] rounded-xl space-y-1">
                      <span className="block text-[10px] text-[#9A9A8C] uppercase font-black tracking-widest">Krok 1</span>
                      <span className="font-serif font-bold text-sm text-[#1B4332] block">Vyberte si pokrm</span>
                      <p className="text-xs text-[#5C5C50] leading-relaxed mt-1">
                        V levém menu najdete přehledný seznam receptů rozdělených do kategorií. Klikněte na jakýkoli recept pro okamžité zobrazení detailů.
                      </p>
                    </div>

                    <div className="p-4 bg-[#FDFCF7] border border-[#E8E8E1] rounded-xl space-y-1">
                      <span className="block text-[10px] text-[#9A9A8C] uppercase font-black tracking-widest">Krok 2</span>
                      <span className="font-serif font-bold text-sm text-[#1B4332] block">Upravte počet porcí</span>
                      <p className="text-xs text-[#5C5C50] leading-relaxed mt-1">
                        V detailu receptu můžete dynamicky měnit počet porcí. Všechny suroviny se bleskově přepočítají v seznamu i přímo v postupu přípravy.
                      </p>
                    </div>

                    <div className="p-4 bg-[#FDFCF7] border border-[#E8E8E1] rounded-xl space-y-1">
                      <span className="block text-[10px] text-[#9A9A8C] uppercase font-black tracking-widest">Krok 3</span>
                      <span className="font-serif font-bold text-sm text-[#1B4332] block">Vytiskněte nebo sdílejte</span>
                      <p className="text-xs text-[#5C5C50] leading-relaxed mt-1">
                        Využijte tlačítko tisku pro zobrazení čisté tiskové šablony k vaření bez otisků prstů na displeji, nebo exportujte celý recept jako text.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ZÓNA PRO ADMINISTRÁTORY (TVORBA NOVÝCH RECEPTŮ) */}
                {isAdmin ? (
                  <div className="space-y-4 animate-fade-in">
                    {/* Welcome Card Info */}
                    <div className="bg-gradient-to-r from-[#F0F4F1] to-[#FDFCF7] border border-[#2D6A4F]/20 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-xs">
                      <div className="p-3 bg-[#1B4332] rounded-xl text-white self-start sm:self-center shrink-0">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif italic font-bold text-lg text-[#1B4332] leading-snug">Administrátorský panel tvorby</h3>
                        <p className="text-xs text-[#4A4A40] leading-relaxed">
                          Jste přihlášeni jako Administrátor. Vložte jakýkoli neuspořádaný recept, vyfocený kuchařský zápisník, nebo PDF a nechte umělou inteligenci sestavit precizní recept.
                        </p>
                      </div>
                    </div>

                    {/* Main Action Input Form */}
                    <form 
                      onSubmit={handleEnhanceRecipe}
                      className="bg-white border border-[#E8E8E1] rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-5"
                    >
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
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
                        <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
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
                          className="w-full bg-[#D97706] hover:bg-[#C26405] disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                        >
                          <Sparkles className="h-5 w-5" />
                          <span>Vylepšit můj recept (5 pilířů AI)</span>
                        </button>
                        <p className="text-center text-[10px] text-[#9A9A8C] mt-2 font-medium">
                          Zpracování potrvá zhruba 10-15 sekund pro důkladný výpočet fyzikálních a kulinářských parametrů.
                        </p>
                      </div>
                    </form>
                  </div>
                ) : (
                  isStudioEnv && (
                    /* Admin/API key Lock Screen (Only visible in AI Studio Dev Environment for authorization) */
                    <div className="bg-white border border-[#E8E8E1] rounded-2xl p-8 text-center space-y-6 shadow-md max-w-xl mx-auto my-4">
                      <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 border border-amber-100">
                        <Lock className="w-8 h-8 animate-bounce-subtle" />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="font-serif italic font-bold text-xl text-[#1B4332]">
                          Přidávání nových receptů je zabezpečeno
                        </h3>
                        <p className="text-xs text-[#4A4A40] leading-relaxed">
                          Pro generování nových AI receptů se nejprve přihlaste administračním kódem nebo API klíčem.
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
                          className="w-full bg-[#D97706] hover:bg-[#C26405] disabled:bg-amber-800/40 active:scale-95 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
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
            ) : isStudioEnv ? (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="text-xs text-[#2D6A4F] hover:underline hover:text-[#1B4332] cursor-pointer font-bold flex items-center gap-1"
              >
                🔐 Administrátorské přihlášení
              </button>
            ) : null}
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

      {/* ADMINISTRÁTORSKÝ PŘIHLÁŠENÍ / CONFIG MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#1B4332] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[#52B788]" />
                <h3 className="font-bold text-lg tracking-tight">
                  {activeTab === "admin" ? "Administrátorské přihlášení" : "Propojení s GitHubem"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError(null);
                  setGithubStatusResult(null);
                  setSaveGithubConfigSuccess(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#E8E8E1] bg-[#F4F3EA] px-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("admin");
                  setGithubStatusResult(null);
                  setSaveGithubConfigSuccess(null);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
                  activeTab === "admin"
                    ? "bg-[#FDFCF7] text-[#1B4332] border-t border-x border-[#E8E8E1] -mb-[1px]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🔒 Správa hesla
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("github");
                }}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
                  activeTab === "github"
                    ? "bg-[#FDFCF7] text-[#1B4332] border-t border-x border-[#E8E8E1] -mb-[1px]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🐙 GitHub Připojení
              </button>
            </div>

            {/* Content Tab 1: Admin Password */}
            {activeTab === "admin" && (
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
            )}

            {/* Content Tab 2: GitHub Config */}
            {activeTab === "github" && (
              <div className="p-6 space-y-4 text-slate-700 flex flex-col flex-1 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#1B4332]">
                      Uživatel / Vlastník
                    </label>
                    <input
                      type="text"
                      value={githubUser}
                      onChange={(e) => setGithubUser(e.target.value)}
                      placeholder="ambrus-k"
                      className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent font-sans text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#1B4332]">
                      Repozitář
                    </label>
                    <input
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="ai-kucharka"
                      className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent font-sans text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1B4332]">
                    Větev repozitáře
                  </label>
                  <input
                    type="text"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent font-sans text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#1B4332]">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder={githubToken ? "PONECHAT_STÁVAJÍCÍ" : "ghp_..."}
                    className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent font-sans text-xs"
                  />
                </div>

                {githubStatusResult && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    githubStatusResult.connected 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    <AlertCircle className={`h-4 w-4 shrink-0 ${githubStatusResult.connected ? "text-emerald-600" : "text-red-600"}`} />
                    <div className="space-y-0.5">
                      <p className="font-bold">{githubStatusResult.connected ? "Úspěšně propojeno" : "Chyba připojení"}</p>
                      <p className="opacity-90">{githubStatusResult.message || githubStatusResult.errorMessage}</p>
                    </div>
                  </div>
                )}

                {saveGithubConfigSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{saveGithubConfigSuccess}</span>
                  </div>
                )}

                {manualSyncResult && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    manualSyncResult.success 
                      ? "bg-indigo-50 border-indigo-200 text-indigo-900" 
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    <Check className={`h-4 w-4 shrink-0 ${manualSyncResult.success ? "text-indigo-600" : "text-red-600"}`} />
                    <div className="space-y-0.5">
                      <p className="font-bold">{manualSyncResult.success ? "Synchronizace úspěšná" : "Chyba synchronizace"}</p>
                      <p className="opacity-95">{manualSyncResult.message}</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3.5 text-[10px] leading-relaxed space-y-1">
                  <p className="font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1">
                    ℹ️ Proč propojit s GitHubem?
                  </p>
                  <p>
                    Propojení umožňuje ukládat a synchronizovat všechny recepty přímo do vašeho vlastního repozitáře. 
                    Recepty jsou na GitHubu ukládány jako jednotlivé JSON soubory ve složce <code className="font-mono bg-blue-100 px-1 rounded">data/recipes/</code>.
                  </p>
                </div>

                <div className="pt-2 flex justify-between items-center border-t border-[#E8E8E1] mt-auto">
                  <button
                    type="button"
                    onClick={handleManualGithubSync}
                    disabled={isManualSyncing}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isManualSyncing ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Synchronizuji...</span>
                      </>
                    ) : (
                      <>
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>Synchronizovat teď</span>
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestGithubConnection(githubUser, githubRepo, githubBranch, githubToken)}
                      disabled={isTestingConnection}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isTestingConnection ? "Testuji..." : "Otestovat spojení"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveGithubConfig(githubUser, githubRepo, githubBranch, githubToken)}
                      disabled={isSavingGithubConfig}
                      className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#153528] text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingGithubConfig ? "Ukládám..." : "Uložit nastavení"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NÁKUPNÍ KOŠÍK MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#1B4332] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#52B788]" />
                <h3 className="font-serif italic font-bold text-lg tracking-tight">
                  Váš nákupní košík
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Actions (Add current recipe ingredients) */}
            {selectedRecipe && (
              <div className="p-4 bg-emerald-50 border-b border-[#E8E8E1] flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-[#1B4332] font-semibold truncate max-w-[65%]">
                  Otevřený recept: <span className="font-serif italic">{selectedRecipe.title}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddRecipeToCart}
                  className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer shadow-xs whitespace-nowrap flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Vložit vše</span>
                </button>
              </div>
            )}

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cartItems.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Košík je prázdný</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Přidejte suroviny přímo z detailu kteréhokoli receptu nebo si napište vlastní položky níže.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                    <span>Položka</span>
                    <span>Stav</span>
                  </div>
                  <div className="space-y-1.5">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          item.checked
                            ? "bg-slate-50/50 border-slate-100 opacity-60 line-through text-slate-400"
                            : "bg-white border-[#E8E8E1] hover:border-emerald-200/60 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => {
                              setCartItems(prev =>
                                prev.map(c => (c.id === item.id ? { ...c, checked: !c.checked } : c))
                              );
                            }}
                            className="h-4.5 w-4.5 rounded-md border-[#E8E8E1] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-sm font-medium leading-normal break-words pr-2">
                            {item.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCartItems(prev => prev.filter(c => c.id !== item.id));
                          }}
                          className="text-xs text-slate-400 hover:text-red-500 font-bold p-1 rounded-lg hover:bg-red-50/80 transition-all cursor-pointer shrink-0"
                          title="Odebrat z košíku"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add Custom Item Form */}
            <div className="p-4 border-t border-[#E8E8E1] bg-[#F4F3EA] space-y-3 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customCartItem.trim()) return;
                  const newItem = {
                    id: `custom-${Date.now()}`,
                    name: customCartItem.trim(),
                    checked: false
                  };
                  setCartItems(prev => [...prev, newItem]);
                  setCustomCartItem("");
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Přidat vlastní položku (např. 2ks vajec)..."
                  value={customCartItem}
                  onChange={(e) => setCustomCartItem(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-[#E8E8E1] bg-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] focus:border-[#1B4332] text-[#2C2C2C] placeholder-[#9A9A8C]"
                />
                <button
                  type="submit"
                  className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer transition-all shrink-0 shadow-2xs"
                >
                  Přidat
                </button>
              </form>

              {cartItems.length > 0 && (
                <div className="flex gap-2 justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const text = cartItems
                        .map(i => `${i.checked ? "[x]" : "[ ]"} ${i.name}`)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                      alert("Nákupní lístek byl zkopírován do schránky!");
                    }}
                    className="text-[#1B4332] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Kopírovat seznam</span>
                  </button>
                  {confirmClearCart ? (
                    <div className="flex items-center gap-2 bg-red-50 text-red-700 p-1 px-2 rounded-lg border border-red-100 animate-fade-in select-none">
                      <span className="font-semibold text-[10px]">Vymazat košík?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCartItems([]);
                          setConfirmClearCart(false);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer"
                      >
                        Ano
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearCart(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer"
                      >
                        Ne
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearCart(true)}
                      className="text-red-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Vymazat vše</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMINISTRACE KUCHAŘKY & NASTAVENÍ MODAL */}
      {showAdminSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] md:h-[75vh] overflow-hidden flex flex-col animate-scale-up">
            {/* Header */}
            <div className="bg-[#1B4332] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-[#52B788] animate-spin-hover" />
                <div>
                  <h3 className="font-serif italic font-bold text-xl tracking-tight">
                    Administrace & Nastavení kuchařky
                  </h3>
                  <p className="text-[11px] text-[#A3E635] font-medium leading-tight opacity-90">
                    Zálohování, synchronizace s GitHubem, správa kategorií a diagnostika systému
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminSettingsModal(false);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all cursor-pointer"
                title="Zavřít administraci"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Left Sidebar (Tabs list) */}
              <div className="w-full md:w-64 bg-[#F4F3EA] border-r border-[#E8E8E1] p-4 flex flex-col justify-between shrink-0">
                <nav className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("backup")}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                      activeAdminTab === "backup"
                        ? "bg-[#1B4332] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    <span>Záloha a přenos receptů</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("github")}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                      activeAdminTab === "github"
                        ? "bg-[#1B4332] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <GitBranch className="h-4 w-4" />
                    <span>GitHub Synchronizace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("categories")}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                      activeAdminTab === "categories"
                        ? "bg-[#1B4332] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>Správa kategorií</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("diagnostics")}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                      activeAdminTab === "diagnostics"
                        ? "bg-[#1B4332] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <Cpu className="h-4 w-4" />
                    <span>Diagnostika systému</span>
                  </button>
                </nav>

                {/* Left Sidebar Footer: Logout */}
                <div className="pt-4 border-t border-[#E8E8E1] mt-4 md:mt-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdmin(false);
                      setAdminPassword("");
                      localStorage.removeItem("admin_password_token");
                      setShowAdminSettingsModal(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Odhlásit se z administračního účtu"
                  >
                    Odhlásit se z administrace
                  </button>
                </div>
              </div>

              {/* Right content panel */}
              <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col">
                
                {/* TAB 1: BACKUP AND RESTORE */}
                {activeAdminTab === "backup" && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="font-serif italic font-bold text-lg text-[#1B4332] mb-1">
                        Zálohování a přenos receptů
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Exportujte celou kuchařku pro bezpečné uložení nebo importujte dříve uloženou zálohu.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Export card */}
                      <div className="border border-[#E8E8E1] bg-[#FDFCF7]/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="p-3.5 bg-emerald-50 text-[#1B4332] rounded-xl w-12 h-12 flex items-center justify-center">
                            <Download className="h-6 w-6 text-emerald-700" />
                          </div>
                          <h5 className="font-serif font-bold text-base text-slate-800">Exportovat kuchařku</h5>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Stáhne kompletní databázi všech vašich receptů jako přenositelný <code className="bg-amber-100/60 px-1 py-0.5 rounded font-mono font-bold text-amber-900 text-[10px]">JSON</code> soubor.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportBackup}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          <span>Exportovat do souboru</span>
                        </button>
                      </div>

                      {/* Import card */}
                      <div className="border border-[#E8E8E1] bg-[#FDFCF7]/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="p-3.5 bg-blue-50 text-blue-700 rounded-xl w-12 h-12 flex items-center justify-center">
                            <Upload className="h-6 w-6 text-blue-700" />
                          </div>
                          <h5 className="font-serif font-bold text-base text-slate-800">Nahraní zálohy (Import)</h5>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Nahraje dříve vyexportované recepty ze souboru. <strong className="text-red-700">Pozor!</strong> Importované recepty se sloučí s vaším stávajícím seznamem.
                          </p>
                        </div>
                        <label className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
                          <Upload className="h-4 w-4" />
                          <span>Vybrat soubor se zálohou</span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportBackup}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-[11px] leading-relaxed">
                      <p className="font-bold uppercase tracking-wider text-amber-950 mb-1">
                        💡 Tip pro přenos dat:
                      </p>
                      <p>
                        Zálohovací soubor obsahuje kompletní strukturu vašich receptů včetně surovin, fází přípravy, technologických tipů a vědeckých odůvodnění. Tento soubor můžete použít k bezpečnému přesunu celé své kuchařky na jiné zařízení nebo k obnově v případě nechtěného smazání.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 2: GITHUB SYNC */}
                {activeAdminTab === "github" && (
                  <div className="space-y-6 animate-fade-in flex flex-col flex-1 overflow-hidden">
                    <div>
                      <h4 className="font-serif italic font-bold text-lg text-[#1B4332] mb-1">
                        GitHub Synchronizace & Propojení
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Synchronizujte kuchařku s vaším repozitářem nebo upravte konfigurační údaje pro automatické ukládání.
                      </p>
                    </div>

                    {/* Synchronization Status & Button */}
                    <div className="bg-[#1B4332]/5 border border-emerald-100 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                          🐙 Stav synchronizace
                        </span>
                        <p className="text-xs text-slate-600">
                          Můžete spustit manuální synchronizaci, která nahraje všechny recepty na GitHub.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleManualGithubSync}
                        disabled={isManualSyncing}
                        className="text-xs bg-[#1B4332] hover:bg-[#153528] disabled:bg-[#1B4332]/30 text-white font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm"
                      >
                        {isManualSyncing ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Synchronizuji...</span>
                          </>
                        ) : (
                          <>
                            <GitBranch className="h-3.5 w-3.5" />
                            <span>Synchronizovat teď</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Sync Message Results */}
                    {manualSyncResult && (
                      <div className={`p-4 rounded-xl text-xs border ${
                        manualSyncResult.success 
                          ? "bg-emerald-100 border-emerald-200 text-emerald-900 animate-scale-up" 
                          : "bg-red-100 border-red-200 text-red-950 animate-scale-up"
                      }`}>
                        <p className="font-semibold leading-normal">{manualSyncResult.message}</p>
                      </div>
                    )}

                    {/* Repository Connection settings form */}
                    <div className="border border-[#E8E8E1] bg-[#FDFCF7]/20 p-5 rounded-2xl space-y-4">
                      <h5 className="font-bold text-sm text-slate-700 border-b border-[#E8E8E1] pb-2">
                        Nastavení GitHub repozitáře
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#1B4332]">
                            Uživatel / Vlastník repozitáře
                          </label>
                          <input
                            type="text"
                            value={githubUser}
                            onChange={(e) => setGithubUser(e.target.value)}
                            placeholder="ambrus-k"
                            className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] text-xs font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#1B4332]">
                            Název repozitáře
                          </label>
                          <input
                            type="text"
                            value={githubRepo}
                            onChange={(e) => setGithubRepo(e.target.value)}
                            placeholder="ai-kucharka"
                            className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#1B4332]">
                            Větev repozitáře
                          </label>
                          <input
                            type="text"
                            value={githubBranch}
                            onChange={(e) => setGithubBranch(e.target.value)}
                            placeholder="main"
                            className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] text-xs font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#1B4332]">
                            GitHub Personal Access Token (PAT)
                          </label>
                          <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder={githubToken ? "PONECHAT_STÁVAJÍCÍ" : "ghp_..."}
                            className="w-full px-3 py-2 bg-white border border-[#E8E8E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4332] text-xs font-medium"
                          />
                        </div>
                      </div>

                      {githubStatusResult && (
                        <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                          githubStatusResult.connected 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800 animate-scale-up" 
                            : "bg-red-50 border-red-200 text-red-800 animate-scale-up"
                        }`}>
                          <AlertCircle className={`h-4 w-4 shrink-0 ${githubStatusResult.connected ? "text-emerald-600" : "text-red-600"}`} />
                          <div className="space-y-0.5">
                            <p className="font-bold">{githubStatusResult.connected ? "Úspěšně propojeno" : "Chyba připojení"}</p>
                            <p className="opacity-90">{githubStatusResult.message || githubStatusResult.errorMessage}</p>
                          </div>
                        </div>
                      )}

                      {saveGithubConfigSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-scale-up">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{saveGithubConfigSuccess}</span>
                        </div>
                      )}

                      <div className="pt-2 flex justify-end gap-3 border-t border-[#E8E8E1]">
                        <button
                          type="button"
                          onClick={() => handleTestGithubConnection(githubUser, githubRepo, githubBranch, githubToken)}
                          disabled={isTestingConnection}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isTestingConnection ? "Testuji..." : "Otestovat spojení"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveGithubConfig(githubUser, githubRepo, githubBranch, githubToken)}
                          disabled={isSavingGithubConfig}
                          className="px-4 py-2 bg-[#1B4332] hover:bg-[#153528] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSavingGithubConfig ? "Ukládám..." : "Uložit nastavení"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: CATEGORIES */}
                {activeAdminTab === "categories" && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="font-serif italic font-bold text-lg text-[#1B4332] mb-1">
                        Správa a organizace kategorií
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Uspořádejte si strukturu kuchařky podle témat, surovin nebo příležitostí.
                      </p>
                    </div>

                    <div className="border border-[#E8E8E1] bg-[#FDFCF7]/40 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center">
                      <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl shrink-0">
                        <FolderOpen className="h-10 w-10 text-amber-600" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h5 className="font-serif font-bold text-base text-slate-800">
                          Hromadný Editor kategorií receptů
                        </h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Tento mocný nástroj vám umožňuje vidět přehledně všechny existující kategorie, vytvářet vlastní nové kategorie, snadno přesouvat recepty mezi sekcemi a přejmenovávat nebo slučovat duplicity.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCategoryEditorModal(true);
                          }}
                          className="mt-2 text-xs bg-[#1B4332] hover:bg-[#153528] text-white px-5 py-3 rounded-xl font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2"
                        >
                          <FolderOpen className="h-4 w-4" />
                          <span>Otevřít hromadný editor kategorií</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 text-[11px] leading-relaxed">
                      <p className="font-bold uppercase tracking-wider text-blue-950 mb-1">
                        📌 Jak funguje automatická kategorizace?
                      </p>
                      <p>
                        Pokud u receptu nezadáte kategorii manuálně, systém ji automaticky odvodí na základě názvu a surovin do odpovídajících gastronomických pilířů (Svačiny, Polévky, Hlavní jídla, Dezerty atd.). V editoru kategorií však můžete toto automatické chování přepsat a zařadit recept do libovolné vlastní složky.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 4: DIAGNOSTICS */}
                {activeAdminTab === "diagnostics" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="font-serif italic font-bold text-lg text-[#1B4332] mb-1">
                          Diagnostika kulinářského systému
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Otestujte připojení k souborovému systému, funkčnost Gemini API a spojení se sítí.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleRunDiagnostics}
                          disabled={isDiagnosing}
                          className="text-xs bg-[#1B4332] hover:bg-[#153528] disabled:bg-emerald-300 text-white font-bold py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                        >
                          {isDiagnosing ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Spouštím diagnostiku...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Spustit diagnostiku</span>
                            </>
                          )}
                        </button>
                        {isDiagnosing && (
                          <button
                            type="button"
                            onClick={handleStopDiagnostics}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
                            title="Zastavit diagnostiku"
                          >
                            <Square className="h-3 w-3 fill-current" />
                            <span>Zastavit</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PROGRESS WINDOW FOR DIAGNOSTICS */}
                    {isDiagnosing && (
                      <div className="p-4 bg-[#FDFCF7] border border-[#E8E8E1] rounded-xl space-y-3 text-[#2c2c2c] shadow-xs animate-scale-up">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="truncate pr-1 text-slate-600">{diagnosticsProgressText}</span>
                          <span className="font-mono text-emerald-700 shrink-0">{diagnosticsProgressPercent}%</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${diagnosticsProgressPercent}%` }}
                          />
                        </div>
                        {/* Step checklist */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500 pt-1.5 border-t border-slate-200">
                          <div className={`flex items-center gap-1.5 ${diagnosticsStepIndex >= 0 ? 'text-emerald-800' : ''}`}>
                            {diagnosticsStepIndex > 0 ? (
                              <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                            ) : diagnosticsStepIndex === 0 ? (
                              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
                            ) : (
                              <div className="h-1 w-1 rounded-full bg-slate-300 mx-1 shrink-0" />
                            )}
                            <span className={diagnosticsStepIndex === 0 ? 'font-bold' : ''}>1. Inicializace</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${diagnosticsStepIndex >= 1 ? 'text-emerald-800' : ''}`}>
                            {diagnosticsStepIndex > 1 ? (
                              <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                            ) : diagnosticsStepIndex === 1 ? (
                              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
                            ) : (
                              <div className="h-1 w-1 rounded-full bg-slate-300 mx-1 shrink-0" />
                            )}
                            <span className={diagnosticsStepIndex === 1 ? 'font-bold' : ''}>2. Test zápisu</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${diagnosticsStepIndex >= 2 ? 'text-emerald-800' : ''}`}>
                            {diagnosticsStepIndex > 2 ? (
                              <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                            ) : diagnosticsStepIndex === 2 ? (
                              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
                            ) : (
                              <div className="h-1 w-1 rounded-full bg-slate-300 mx-1 shrink-0" />
                            )}
                            <span className={diagnosticsStepIndex === 2 ? 'font-bold' : ''}>3. Spojení s Gemini AI</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${diagnosticsStepIndex >= 3 ? 'text-emerald-800' : ''}`}>
                            {diagnosticsStepIndex > 3 ? (
                              <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                            ) : diagnosticsStepIndex === 3 ? (
                              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
                            ) : (
                              <div className="h-1 w-1 rounded-full bg-slate-300 mx-1 shrink-0" />
                            )}
                            <span className={diagnosticsStepIndex === 3 ? 'font-bold' : ''}>4. Sestavení reportu</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {diagnosticsError && (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1 animate-scale-up">
                        <p className="font-bold">Chyba diagnostiky:</p>
                        <p className="opacity-95 leading-normal">{diagnosticsError}</p>
                      </div>
                    )}

                    {diagnosticsResult && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-scale-up">
                        {/* 1. WRITE PERMISSION */}
                        <div className="p-4 bg-[#FDFCF7]/30 border border-[#E8E8E1] rounded-xl space-y-1 text-[#2c2c2c] shadow-xs">
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1">
                              <Database className="h-4 w-4 text-emerald-600 shrink-0" />
                              Souborový systém:
                            </span>
                            {diagnosticsResult.writePermissionOk ? (
                              <span className="text-emerald-600 font-extrabold uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">OK</span>
                            ) : (
                              <span className="text-red-600 font-extrabold uppercase text-[10px] bg-red-50 px-2 py-0.5 rounded-full border border-red-200">CHYBA</span>
                            )}
                          </div>
                          <p className="text-slate-600 text-[11px] leading-snug font-medium">
                            {diagnosticsResult.writePermissionMessage}
                          </p>
                        </div>

                        {/* 2. GEMINI AI */}
                        <div className="p-4 bg-[#FDFCF7]/30 border border-[#E8E8E1] rounded-xl space-y-1 text-[#2c2c2c] shadow-xs">
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                              Gemini AI API:
                            </span>
                            {diagnosticsResult.geminiOk ? (
                              <span className="text-emerald-600 font-extrabold uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">OK</span>
                            ) : (
                              <span className="text-red-600 font-extrabold uppercase text-[10px] bg-red-50 px-2 py-0.5 rounded-full border border-red-200">CHYBA</span>
                            )}
                          </div>
                          <p className="text-slate-600 text-[11px] leading-snug font-medium">
                            {diagnosticsResult.geminiMessage}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#F4F3EA] p-4 border-t border-[#E8E8E1] flex justify-end shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdminSettingsModal(false);
                }}
                className="px-5 py-2 bg-[#1B4332] hover:bg-[#153528] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Hotovo / Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KATEGORIE EDITOR MODAL */}
      {showCategoryEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#1B4332] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-[#52B788]" />
                <h3 className="font-bold text-lg tracking-tight">
                  Editor kategorií receptů
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryEditorModal(false);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#E8E8E1] bg-[#F4F3EA] px-4 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCategoryEditorTab("by-category");
                }}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                  categoryEditorTab === "by-category"
                    ? "bg-[#FDFCF7] text-[#1B4332] border-t border-x border-[#E8E8E1] -mb-[1px]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📁 Podle kategorií
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryEditorTab("all-recipes");
                }}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                  categoryEditorTab === "all-recipes"
                    ? "bg-[#FDFCF7] text-[#1B4332] border-t border-x border-[#E8E8E1] -mb-[1px]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📋 Všechny recepty
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Tab 1: By Category */}
              {categoryEditorTab === "by-category" && (
                <div className="space-y-4">
                  {/* Create New Category Form */}
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between animate-fade-in">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Vytvořit vlastní kategorii</h4>
                      <p className="text-[11px] text-emerald-800">Přidejte novou kategorii do seznamu a přiřaďte jí recepty.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <input
                        type="text"
                        value={newCustomCategoryName}
                        onChange={(e) => setNewCustomCategoryName(e.target.value)}
                        placeholder="Název (např. Saláty, Dezerty...)"
                        className="px-3 py-2 bg-white border border-[#E8E8E1] rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] w-48 sm:w-64"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = newCustomCategoryName.trim();
                          if (name) {
                            if (allUsedCategories.includes(name)) {
                              alert(`Kategorie "${name}" již existuje.`);
                            } else {
                              if (deletedDefaultCategories.includes(name)) {
                                setDeletedDefaultCategories(prev => prev.filter(c => c !== name));
                              } else {
                                setLocalCustomCategories(prev => [...prev, name]);
                              }
                              setNewCustomCategoryName("");
                            }
                          }
                        }}
                        className="px-4 py-2 bg-[#1B4332] hover:bg-[#153528] active:scale-95 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shrink-0"
                      >
                        Přidat
                      </button>
                    </div>
                  </div>

                  {/* Grid of Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allUsedCategories.map(category => {
                      const assignedRecipes = recipes.filter(r => (r.category || getRecipeCategory(r)) === category);
                      const sortedAssigned = [...assignedRecipes].sort((a,b) => a.title.localeCompare(b.title, "cs"));
                      
                      return (
                        <div key={category} className="bg-white border border-[#E8E8E1] rounded-xl p-4 flex flex-col min-h-[220px]">
                          {/* Category Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-[#F4F3EA] mb-3 min-h-[36px]">
                            {editingCategoryName === category ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <span className="text-lg shrink-0">{getCategoryEmoji(category)}</span>
                                <input
                                  type="text"
                                  value={editingCategoryValue}
                                  onChange={(e) => setEditingCategoryValue(e.target.value)}
                                  className="px-2 py-1 bg-white border border-[#E8E8E1] rounded text-xs font-semibold text-[#1B4332] w-full focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleRenameCategory(category, editingCategoryValue);
                                      setEditingCategoryName(null);
                                    } else if (e.key === "Escape") {
                                      setEditingCategoryName(null);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRenameCategory(category, editingCategoryValue);
                                    setEditingCategoryName(null);
                                  }}
                                  className="text-xs text-emerald-600 hover:text-emerald-800 font-bold p-1 hover:bg-emerald-50 rounded cursor-pointer shrink-0"
                                  title="Uložit název"
                                >
                                  ✔
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCategoryName(null);
                                  }}
                                  className="text-xs text-slate-400 hover:text-slate-600 font-bold p-1 hover:bg-slate-50 rounded cursor-pointer shrink-0"
                                  title="Zrušit"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-1.5 text-sm font-bold text-[#1B4332] min-w-0">
                                  <span className="text-lg shrink-0">{getCategoryEmoji(category)}</span>
                                  <span className="truncate" title={category}>{category}</span>
                                  <span className="text-[10px] text-white bg-[#2D6A4F] px-1.5 py-0.5 rounded-full font-sans font-bold shrink-0">
                                    {sortedAssigned.length}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCategoryName(category);
                                      setEditingCategoryValue(category);
                                    }}
                                    className="text-[10px] text-[#2D6A4F] hover:text-[#1B4332] font-semibold cursor-pointer hover:underline flex items-center gap-0.5"
                                    title="Přejmenovat kategorii"
                                  >
                                    ✏️ Přejmenovat
                                  </button>
                                  
                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteCategory(category);
                                    }}
                                    className="text-[10px] text-red-500 hover:text-red-700 font-semibold cursor-pointer hover:underline flex items-center gap-0.5"
                                    title="Smazat kategorii"
                                  >
                                    🗑️ Smazat
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Recipe List */}
                          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-48 pr-1 mb-3">
                            {sortedAssigned.length === 0 ? (
                              <div className="text-center py-6 text-xs text-[#9A9A8C] italic">
                                Žádné recepty v této kategorii
                              </div>
                            ) : (
                              sortedAssigned.map(recipe => (
                                <div key={recipe.id} className="flex items-center justify-between p-1.5 hover:bg-[#FDFCF7] rounded-lg border border-transparent hover:border-[#E8E8E1] text-xs">
                                  <span className="font-medium text-slate-700 truncate pr-2 max-w-[180px] sm:max-w-xs" title={recipe.title}>
                                    {recipe.title}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Indicator for manual/auto */}
                                    {recipe.category ? (
                                      <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-800 px-1 py-0.2 rounded font-sans font-bold cursor-help shrink-0" title="Ručně přiřazená kategorie">
                                        R
                                      </span>
                                    ) : (
                                      <span className="text-[9px] bg-slate-50 border border-slate-200 text-slate-500 px-1 py-0.2 rounded font-sans font-bold cursor-help shrink-0" title="Automaticky odhadnutá kategorie">
                                        A
                                      </span>
                                    )}

                                    {/* Dropdown to move */}
                                    <select
                                      value={category}
                                      onChange={(e) => {
                                        const targetCat = e.target.value;
                                        const updatedList = recipes.map(r => r.id === recipe.id ? { ...r, category: targetCat } : r);
                                        saveRecipesToStorage(updatedList);
                                      }}
                                      className="text-[11px] p-1 bg-white border border-[#E8E8E1] rounded focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] font-medium"
                                    >
                                      {allUsedCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
                                    </select>

                                    {/* Reset to auto */}
                                    {recipe.category && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedRecipe = { ...recipe };
                                          delete updatedRecipe.category;
                                          const updatedList = recipes.map(r => r.id === recipe.id ? updatedRecipe : r);
                                          saveRecipesToStorage(updatedList);
                                        }}
                                        className="text-[11px] text-red-500 hover:text-red-700 font-bold p-1 hover:bg-red-50 rounded cursor-pointer shrink-0"
                                        title="Obnovit na automatické přiřazení"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Quick Assign Dropdown */}
                          <div className="pt-2 border-t border-[#F4F3EA] mt-auto">
                            <select
                              value=""
                              onChange={(e) => {
                                const recipeId = e.target.value;
                                if (!recipeId) return;
                                const updatedList = recipes.map(r => r.id === recipeId ? { ...r, category: category } : r);
                                saveRecipesToStorage(updatedList);
                              }}
                              className="w-full text-xs p-2 bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg text-slate-500 font-medium cursor-pointer"
                            >
                              <option value="">➕ Přidat recept do této kategorie...</option>
                              {recipes
                                .filter(r => (r.category || getRecipeCategory(r)) !== category)
                                .sort((a,b) => a.title.localeCompare(b.title, "cs"))
                                .map(r => (
                                  <option key={r.id} value={r.id}>{r.title}</option>
                                ))
                              }
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: All Recipes List */}
              {categoryEditorTab === "all-recipes" && (
                <div className="space-y-4">
                  {/* Search box */}
                  <div className="relative">
                    <input
                      type="text"
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      placeholder="Vyhledat recept podle názvu..."
                      className="w-full text-xs p-3 pl-9 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                    />
                    <div className="absolute left-3 top-3.5 text-slate-400">
                      <Search className="h-4 w-4" />
                    </div>
                  </div>

                  {/* List of Recipes */}
                  <div className="border border-[#E8E8E1] rounded-xl bg-white divide-y divide-[#F4F3EA] overflow-y-auto max-h-[50vh]">
                    {recipes
                      .filter(recipe => recipe.title.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                      .sort((a,b) => a.title.localeCompare(b.title, "cs"))
                      .map(recipe => {
                        const currentCat = recipe.category || getRecipeCategory(recipe);
                        return (
                          <div key={recipe.id} className="p-3 flex items-center justify-between hover:bg-[#FDFCF7] transition-all text-xs">
                            <div className="min-w-0 pr-4">
                              <p className="font-bold text-slate-800 truncate">{recipe.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Aktuální druh: <span className="font-medium text-[#1B4332]">{currentCat}</span>
                                {recipe.category ? (
                                  <span className="ml-2 px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">Ručně</span>
                                ) : (
                                  <span className="ml-2 px-1 py-0.2 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[9px] font-bold">Automaticky</span>
                                )}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={currentCat}
                                onChange={(e) => {
                                  const targetCat = e.target.value;
                                  const updatedList = recipes.map(r => r.id === recipe.id ? { ...r, category: targetCat } : r);
                                  saveRecipesToStorage(updatedList);
                                }}
                                className="text-xs p-2 bg-white border border-[#E8E8E1] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] font-semibold cursor-pointer"
                              >
                                {allUsedCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>

                              {recipe.category && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedRecipe = { ...recipe };
                                    delete updatedRecipe.category;
                                    const updatedList = recipes.map(r => r.id === recipe.id ? updatedRecipe : r);
                                    saveRecipesToStorage(updatedList);
                                  }}
                                  className="px-2.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold rounded-lg transition-colors cursor-pointer"
                                  title="Obnovit na automatickou kategorii"
                                >
                                  Obnovit automatiku
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-[#F4F3EA] p-4 border-t border-[#E8E8E1] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowCategoryEditorModal(false)}
                className="px-5 py-2 bg-[#1B4332] hover:bg-[#153528] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Hotovo / Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OKNO: VYTVOŘIT NOVÝ RECEPT */}
      {showAddRecipeModal && (
        <div className="fixed inset-0 z-[9980] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs no-print animate-fade-in overflow-y-auto">
          <div className="bg-[#FDFCF7] border border-[#E8E8E1] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] my-auto overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-[#1B4332] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D97706] rounded-xl text-white shadow-xs">
                  <Plus className="h-5 w-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg tracking-tight font-serif">
                    Vytvořit nový recept
                  </h3>
                  <p className="text-xs text-emerald-100/80 font-sans">
                    Ruční zadání ingrediencí a kroků nebo automatická AI syntéza
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRecipeModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all cursor-pointer"
                title="Zavřít okno"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#E8E8E1] bg-[#F4F3EA] px-4 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAddRecipeTab("manual");
                  setAddFormError(null);
                }}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
                  addRecipeTab === "manual"
                    ? "bg-[#FDFCF7] text-[#1B4332] border-t border-x border-[#E8E8E1] -mb-[1px] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ChefHat className="h-4 w-4 text-[#D97706]" />
                <span>Ruční vložení (Formulář)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAddRecipeTab("ai");
                  setAddFormError(null);
                }}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 ${
                  addRecipeTab === "ai"
                    ? "bg-[#FDFCF7] text-[#1B4332] border-t border-x border-[#E8E8E1] -mb-[1px] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="h-4 w-4 text-[#D97706]" />
                <span>Pomocí AI (Generátor)</span>
              </button>
            </div>

            {/* Error Banner */}
            {addFormError && (
              <div className="bg-red-50 border-b border-red-200 text-red-800 p-3.5 px-6 text-xs font-bold flex items-center gap-2 shrink-0 animate-fade-in">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{addFormError}</span>
              </div>
            )}

            {/* Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              
              {/* TAB 1: MANUAL FORM */}
              {addRecipeTab === "manual" && (
                <form id="add-recipe-manual-form" onSubmit={handleSaveManualRecipe} className="space-y-6">
                  
                  {/* Basic Information Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Název receptu <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addTitle}
                        onChange={(e) => setAddTitle(e.target.value)}
                        placeholder="Např. Pečené kuře na divoko s pórkem"
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                        required
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Kategorie pokrmu
                      </label>
                      <select
                        value={addCategory}
                        onChange={(e) => setAddCategory(e.target.value)}
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      >
                        {Array.from(allUsedCategories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Appliance */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Cílový spotřebič
                      </label>
                      <select
                        value={addAppliance}
                        onChange={(e) => setAddAppliance(e.target.value)}
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      >
                        <option value="Sporák">Sporák / Rendlík / Pánev</option>
                        <option value="Horkovzdušná fritéza">Horkovzdušná fritéza</option>
                        <option value="Tlakový hrnec / Multifunkční hrnec">Tlakový / Multifunkční hrnec</option>
                        <option value="Klasická trouba">Klasická trouba</option>
                        <option value="Remoska">Remoska</option>
                        <option value="Pomalý hrnec">Pomalý hrnec</option>
                        <option value="Pekárna chleba">Pekárna chleba</option>
                      </select>
                    </div>

                    {/* Cooking Time */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Celková doba celého procesu <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addCookingTime}
                        onChange={(e) => setAddCookingTime(e.target.value)}
                        placeholder="Např. 2 h marinování, 45 min pečení"
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                        required
                      />
                      <p className="text-[11px] text-amber-800 font-medium">
                        Vždy uveďte přesné časové údaje (např. '30 min kynutí, 40 min pečení').
                      </p>
                    </div>

                    {/* Estimated Active Time */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Čas aktivního vaření
                      </label>
                      <input
                        type="text"
                        value={addEstimatedTime}
                        onChange={(e) => setAddEstimatedTime(e.target.value)}
                        placeholder="Např. 20 min"
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      />
                    </div>

                    {/* Difficulty */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Náročnost
                      </label>
                      <select
                        value={addDifficulty}
                        onChange={(e) => setAddDifficulty(e.target.value as any)}
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      >
                        <option value="Snadné">Snadné</option>
                        <option value="Střední">Střední</option>
                        <option value="Složité">Složité</option>
                      </select>
                    </div>

                    {/* Portions */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Počet porcí
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={addPortions}
                        onChange={(e) => setAddPortions(parseInt(e.target.value) || 1)}
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      />
                    </div>

                    {/* Summary */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Stručné shrnutí receptu
                      </label>
                      <textarea
                        rows={2}
                        value={addSummary}
                        onChange={(e) => setAddSummary(e.target.value)}
                        placeholder="Např. Šťavnatý bůček s křupavou kůrkou (35 min pečení na 160 °C, 20 min do křupava na 200 °C)."
                        className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      />
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <div className="space-y-3 bg-[#F0F4F1]/60 p-4 sm:p-5 rounded-2xl border border-[#2D6A4F]/20">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-[#1B4332] uppercase tracking-wider flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-[#D97706]" />
                        <span>Suroviny & Ingredience <span className="text-red-500">*</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setUseRawIngredientsInput(!useRawIngredientsInput)}
                        className="text-[11px] font-bold text-[#D97706] hover:underline cursor-pointer"
                      >
                        {useRawIngredientsInput ? "Zpět na položkový seznam" : "Vložit jako souvislý text"}
                      </button>
                    </div>

                    {useRawIngredientsInput ? (
                      <div className="space-y-1.5">
                        <textarea
                          rows={6}
                          value={addRawIngredients}
                          onChange={(e) => setAddRawIngredients(e.target.value)}
                          placeholder="Každý řádek = jedna surovina, např:&#10;500 g hladká mouka&#10;200 ml smetana&#10;2 ks žloutky"
                          className="w-full text-sm p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332] font-mono"
                        />
                        <p className="text-[10px] text-[#5C5C50]">
                          Formát: [množství] [jednotka] [název suroviny]
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {addIngredients.map((ing, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={ing.amount}
                              onChange={(e) => handleUpdateIngredientRow(idx, "amount", e.target.value)}
                              placeholder="Množství (500)"
                              className="w-24 text-xs p-2.5 border border-[#E8E8E1] rounded-lg bg-white text-[#2C2C2C] focus:outline-hidden"
                            />
                            <input
                              type="text"
                              value={ing.unit}
                              onChange={(e) => handleUpdateIngredientRow(idx, "unit", e.target.value)}
                              placeholder="Jednotka (g/ml/ks)"
                              className="w-28 text-xs p-2.5 border border-[#E8E8E1] rounded-lg bg-white text-[#2C2C2C] focus:outline-hidden"
                            />
                            <input
                              type="text"
                              value={ing.name}
                              onChange={(e) => handleUpdateIngredientRow(idx, "name", e.target.value)}
                              placeholder="Název suroviny (např. mouka)"
                              className="flex-1 text-xs p-2.5 border border-[#E8E8E1] rounded-lg bg-white text-[#2C2C2C] focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              disabled={addIngredients.length <= 1}
                              className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer transition-colors"
                              title="Odebrat surovinu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={handleAddIngredientRow}
                          className="mt-2 text-xs font-bold text-[#1B4332] hover:text-[#2D6A4F] bg-white border border-[#2D6A4F]/30 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <Plus className="h-3.5 w-3.5 text-[#D97706]" />
                          <span>Přidat další surovinu</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Instructions Section */}
                  <div className="space-y-3 bg-[#FDFCF7] p-4 sm:p-5 rounded-2xl border border-[#E8E8E1]">
                    <label className="text-xs font-extrabold text-[#1B4332] uppercase tracking-wider flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#2D6A4F]" />
                      <span>Kroky postupu přípravy <span className="text-red-500">*</span></span>
                    </label>

                    <div className="space-y-2.5">
                      {addInstructions.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#1B4332] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-2">
                            {idx + 1}
                          </span>
                          <textarea
                            rows={2}
                            value={step}
                            onChange={(e) => handleUpdateInstructionRow(idx, e.target.value)}
                            placeholder={`Popište krok ${idx + 1}...`}
                            className="flex-1 text-xs p-2.5 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveInstructionRow(idx)}
                            disabled={addInstructions.length <= 1}
                            className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer transition-colors mt-1"
                            title="Odebrat krok"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddInstructionRow}
                        className="mt-2 text-xs font-bold text-[#1B4332] hover:text-[#2D6A4F] bg-white border border-[#1B4332]/30 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#D97706]" />
                        <span>Přidat další krok postupu</span>
                      </button>
                    </div>
                  </div>

                  {/* Extra Tips & Food Science */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Tip pro vybraný spotřebič
                      </label>
                      <textarea
                        rows={2}
                        value={addApplianceTips}
                        onChange={(e) => setAddApplianceTips(e.target.value)}
                        placeholder="Tipy pro nastavení teploty, programu či nádoby..."
                        className="w-full text-xs p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Vědecké zdůvodnění (Food Science)
                      </label>
                      <textarea
                        rows={2}
                        value={addExpertJustification}
                        onChange={(e) => setAddExpertJustification(e.target.value)}
                        placeholder="Vysvětlení fyziky/chemie přípravy..."
                        className="w-full text-xs p-3 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden"
                      />
                    </div>
                  </div>

                </form>
              )}

              {/* TAB 2: AI GENERATOR */}
              {addRecipeTab === "ai" && (
                <form id="add-recipe-ai-form" onSubmit={handleGenerateAiModalRecipe} className="space-y-5">
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 sm:p-5 text-amber-900 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-[#D97706]">
                      <Sparkles className="h-4 w-4" />
                      <span>Kulinářský AI generátor receptů</span>
                    </div>
                    <p className="leading-relaxed text-slate-700">
                      Napište jakékoliv neuspořádané zápisky, seznam surovin nebo myšlenku. Umělá inteligence z nich vytvoří kompletní, vědecky ověřený recept se všemi náležitostmi a časovými údaji.
                    </p>
                  </div>

                  {isGeneratingAiModal ? (
                    <div className="bg-[#1B4332] text-white border border-[#2D6A4F] rounded-2xl p-6 shadow-lg space-y-4 text-center my-2 animate-fadeIn">
                      <div className="relative mx-auto w-14 h-14 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full border-4 border-emerald-900 border-t-amber-400 animate-spin absolute inset-0" />
                        <ChefHat className="h-6 w-6 text-amber-400 animate-pulse relative z-10" />
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-emerald-200 uppercase tracking-wider">
                          Probíhá generování receptu přes AI
                        </h4>
                        <p className="text-xs text-emerald-100/80 mt-1 font-medium max-w-sm mx-auto">
                          Kulinářský model Gemini 3.6 Flash zpracovává zadání a dopočítává časy u všech kroků postupu.
                        </p>
                      </div>

                      {/* Live Step Text */}
                      <div className="bg-emerald-950/80 border border-emerald-800/80 rounded-xl p-3 text-xs text-amber-300 font-semibold flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400 animate-bounce shrink-0" />
                        <span>{aiModalProgressText || "Generuji recept..."}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-emerald-300 font-mono font-bold px-1">
                          <span>Průběh zpracování:</span>
                          <span className="text-amber-400">{aiModalProgressPercent}%</span>
                        </div>
                        <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden border border-emerald-800">
                          <div
                            className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full transition-all duration-300 ease-out"
                            style={{ width: `${aiModalProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
                        Zadejte popis nebo zápisky receptu
                      </label>
                      <textarea
                        rows={6}
                        value={addAiText}
                        onChange={(e) => setAddAiText(e.target.value)}
                        placeholder="Např.: 'Mám vepřovou panenku, sušenou šunku, šalvěj a bílé víno. Chci připravit rychlou večeři v remosce nebo na pánvi.'"
                        className="w-full text-sm p-4 border border-[#E8E8E1] rounded-xl bg-white text-[#2C2C2C] focus:outline-hidden focus:ring-1 focus:ring-[#1B4332]"
                      />
                    </div>
                  )}
                </form>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="bg-[#F4F3EA] p-4 border-t border-[#E8E8E1] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddRecipeModal(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-[#E8E8E1] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Zrušit
              </button>

              {addRecipeTab === "manual" ? (
                <button
                  type="submit"
                  form="add-recipe-manual-form"
                  className="px-6 py-2.5 bg-[#D97706] hover:bg-[#C26405] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Uložit nový recept</span>
                </button>
              ) : (
                <button
                  type="submit"
                  form="add-recipe-ai-form"
                  disabled={isGeneratingAiModal}
                  className="px-6 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:bg-slate-300 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  {isGeneratingAiModal ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-spin text-amber-400" />
                      <span>Generuji recept přes AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span>Vygenerovat a uložit recept</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Premium Toast Notification System */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-md w-[350px] bg-[#1B4332] text-white border-l-4 border-[#D97706] rounded-xl shadow-2xl p-4 flex items-start gap-3 pointer-events-auto transition-all duration-300 transform translate-y-0 scale-100 font-sans">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-ping"></span>
              {toast.title}
            </p>
            <p className="text-xs text-[#E8F5E9] mt-1 leading-relaxed font-medium">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/60 hover:text-white text-xs font-bold px-1.5 py-0.5 hover:bg-white/10 rounded-md cursor-pointer transition-colors shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
