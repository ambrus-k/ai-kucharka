export interface Nutrition {
  calories: number; // kcal
  proteins: number; // g
  carbohydrates: number; // g
  sugars: number; // g
  fats: number; // g
  saturatedFats: number; // g
  fiber: number; // g
  salt: number; // g
}

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
  nutritionPer100g?: Nutrition;
}
