export type Style = "oven" | "express" | "involved";
export type WeekStatus = "picking" | "locked" | "done";

export interface Member {
  email: string;
  display_name: string;
  role: "admin" | "member";
}

export interface IngredientGroup {
  group?: string | null;
  items: string[];
}

export interface ShoppingItem {
  name: string;
  qty?: number | null;
  unit?: string | null;
  note?: string | null;
  section?: string | null;
  pantry?: boolean;
}

export interface Meal {
  id: string;
  slug: string;
  name: string;
  style: Style;
  cook_minutes: number;
  servings: number;
  description: string;
  included: string[];
  on_the_side: string | null;
  image_url: string | null;
  image_credit: string | null;
  source_name: string | null;
  source_url: string | null;
  ingredients: IngredientGroup[];
  steps: string[];
  shopping: ShoppingItem[];
  leftovers: string | null;
}

export interface Week {
  id: string;
  label: string;
  starts_on: string;
  pick_by: string | null;
  status: WeekStatus;
}

export interface WeekMeal {
  week_id: string;
  meal_id: string;
  position: number;
  chosen: boolean;
  cook_order: number | null;
  cooked_at: string | null;
}

export interface Pick {
  week_id: string;
  meal_id: string;
  member_email: string;
}

export interface Rating {
  week_id: string;
  meal_id: string;
  member_email: string;
  stars: number;
  make_again: boolean | null;
  comment: string | null;
  updated_at: string;
}

export interface Favorite {
  meal_id: string;
  member_email: string;
}

export interface Note {
  week_id: string;
  member_email: string;
  body: string;
}

export interface GroceryItem {
  id: string;
  week_id: string;
  section: string;
  name: string;
  qty: number | null;
  unit: string;
  note: string | null;
  pantry: boolean;
  meals: string[];
  checked: boolean;
  checked_by: string | null;
  position: number;
}

export interface Snapshot {
  me: Member;
  members: Member[];
  weeks: Week[];
  weekMeals: WeekMeal[];
  meals: Meal[];
  picks: Pick[];
  ratings: Rating[];
  favorites: Favorite[];
  notes: Note[];
  groceries: GroceryItem[];
}

/** The JSON a weekly menu is delivered in (see docs/menu-format.md). */
export interface MenuImport {
  week: { label: string; starts_on: string; pick_by?: string | null };
  meals: Array<Omit<Meal, "id">>;
  chosen?: string[];
  cook_order?: string[];
  groceries?: Array<ShoppingItem & { meals?: string[] }>;
}

export interface Api {
  mode: "live" | "demo";
  // auth
  currentEmail(): Promise<string | null>;
  onAuthChange(cb: (email: string | null) => void): () => void;
  canSignIn(email: string): Promise<boolean>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  // data
  snapshot(email: string): Promise<Snapshot | null>;
  subscribe(onChange: () => void): () => void;
  // everyone
  setPick(weekId: string, mealId: string, on: boolean): Promise<void>;
  saveRating(r: Omit<Rating, "member_email" | "updated_at">): Promise<void>;
  setFavorite(mealId: string, on: boolean): Promise<void>;
  saveNote(weekId: string, body: string): Promise<void>;
  setChecked(itemId: string, checked: boolean): Promise<void>;
  markCooked(weekId: string, mealId: string, cooked: boolean): Promise<void>;
  // kitchen admin
  loadWeek(menu: MenuImport): Promise<void>;
  lockWeek(weekId: string, mealIds: string[]): Promise<void>;
  reopenWeek(weekId: string): Promise<void>;
  setGroceries(weekId: string, items: MenuImport["groceries"]): Promise<void>;
  uploadPhoto(mealId: string, file: File): Promise<void>;
  addMember(m: Member): Promise<void>;
  removeMember(email: string): Promise<void>;
}
