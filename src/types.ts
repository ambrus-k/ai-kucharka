export interface Recipe {
  id: string;
  title: string;
  summary: string;
  ingredients: string[];
  instructions: string[];
  applianceTips: string;
  expertJustification: string;
  applianceType: string; // e.g. "Horkovzdušná fritéza", "Thermomix", "Pomalý hrnec", "Domácí pekárna", "Klasická trouba"
  cookingTime: string; // e.g. "45 min"
  estimatedCookingTime?: string; // e.g. "20 min" (expert estimated active heating/cooking time)
  difficulty: "Snadné" | "Střední" | "Složité";
  category?: string;
  isDefault?: boolean;
  updatedAt?: string; // ISO timestamp to track modifications and resolve merge conflicts
}
