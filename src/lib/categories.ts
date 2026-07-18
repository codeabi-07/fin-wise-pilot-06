import { Utensils, Car, ShoppingBag, Receipt, Film, Wallet, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const CATEGORIES = [
  "food",
  "transport",
  "shopping",
  "bills",
  "entertainment",
  "salary",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; color: string }> = {
  food: { label: "Food", icon: Utensils, color: "oklch(0.72 0.15 165)" },
  transport: { label: "Transport", icon: Car, color: "oklch(0.65 0.18 200)" },
  shopping: { label: "Shopping", icon: ShoppingBag, color: "oklch(0.7 0.18 260)" },
  bills: { label: "Bills", icon: Receipt, color: "oklch(0.72 0.17 60)" },
  entertainment: { label: "Entertainment", icon: Film, color: "oklch(0.7 0.2 20)" },
  salary: { label: "Salary", icon: Wallet, color: "oklch(0.68 0.15 155)" },
  other: { label: "Other", icon: Sparkles, color: "oklch(0.55 0.02 250)" },
};
