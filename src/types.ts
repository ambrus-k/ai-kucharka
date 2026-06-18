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
  difficulty: "Snadné" | "Střední" | "Složité";
  category?: string;
  isDefault?: boolean;
}
