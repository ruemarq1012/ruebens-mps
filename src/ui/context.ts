import { createContext, useContext } from "react";
import type { Api, Snapshot } from "../lib/types";

export interface AppCtx {
  api: Api;
  s: Snapshot;
  refresh: () => Promise<void>;
  patch: (fn: (s: Snapshot) => Snapshot) => void;
  toast: (msg: string) => void;
  run: (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;
  openMeal: (mealId: string, weekId?: string) => void;
  openRate: (weekId: string, mealId: string) => void;
  openCook: (weekId: string, mealId: string) => void;
  go: (tab: Tab) => void;
}

export type Tab = "week" | "groceries" | "cookbook" | "kitchen";

export const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("No app context");
  return c;
}
