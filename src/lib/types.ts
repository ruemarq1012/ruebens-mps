export type Style = "oven" | "express" | "involved";
export type WeekStatus = "picking" | "locked" | "done";

export interface Member {
  email: string;
  display_name: string;
  role: "admin" | "member";
}

export interface IngredientGroup {
  group?: string | null;
  /** What this part (usually a sauce) does for the dish. */
  note?: string | null;
  items: string[];
}

export type TipKind =
  "make-extra" | "builds-on" | "frozen" | "prep-ahead" | "tip";
export interface Tip {
  kind: TipKind;
  text: string;
}

export interface FlavorHero {
  name: string;
  why: string;
  used_in: string[]; // meal slugs
  more_uses: string[];
}

export interface WeekExtras {
  hero?: FlavorHero | null;
  notes?: string[];
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
  tips: Tip[];
  /** Set on the week's "learn something new" meal. */
  learn: string | null;
}

export interface Week {
  id: string;
  label: string;
  starts_on: string;
  pick_by: string | null;
  status: WeekStatus;
  extras: WeekExtras;
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

export interface CookCheck {
  week_id: string;
  meal_id: string;
  key: string;
  member_email: string;
}

export interface Questionnaire {
  week_id: string;
  member_email: string;
  answers: QuestionnaireAnswers;
  updated_at: string;
}

export interface QuestionnaireAnswers {
  cuisines?: string[];
  proteins?: string[];
  flavor?: string;
  adventure?: string;
  new_ingredient?: string;
  use_up?: string;
  avoid?: string;
}

export interface MemberSettings {
  member_email: string;
  instacart_connected_at: string | null;
  instacart_zip: string | null;
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
  cookChecks: CookCheck[];
  questionnaires: Questionnaire[];
  settings: MemberSettings[];
}

/** The JSON a weekly menu is delivered in (see docs/menu-format.md). */
export interface MenuImport {
  week: { label: string; starts_on: string; pick_by?: string | null };
  extras?: WeekExtras;
  meals: Array<Omit<Meal, "id">>;
  chosen?: string[];
  cook_order?: string[];
  groceries?: Array<ShoppingItem & { meals?: string[] }>;
}

export type AccountStatus = "not_member" | "new" | "existing";

export interface Api {
  mode: "live" | "demo";
  // auth
  currentEmail(): Promise<string | null>;
  onAuthChange(cb: (email: string | null) => void): () => void;
  accountStatus(email: string): Promise<AccountStatus>;
  signIn(email: string, password: string): Promise<void>;
  createAccount(email: string, password: string): Promise<void>;
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
  setCookCheck(
    weekId: string,
    mealId: string,
    key: string,
    on: boolean,
  ): Promise<void>;
  setCookOrder(weekId: string, mealIds: string[]): Promise<void>;
  saveQuestionnaire(
    weekId: string,
    answers: QuestionnaireAnswers,
  ): Promise<void>;
  setInstacart(connected: boolean, zip: string | null): Promise<void>;
  /** Returns an Instacart shopping-list link, or null when Instacart isn't switched on yet. */
  instacartLink(
    title: string,
    items: Array<{ name: string; display: string }>,
  ): Promise<string | null>;
  // kitchen admin
  loadWeek(menu: MenuImport): Promise<void>;
  lockWeek(weekId: string, mealIds: string[]): Promise<void>;
  reopenWeek(weekId: string): Promise<void>;
  setGroceries(weekId: string, items: MenuImport["groceries"]): Promise<void>;
  uploadPhoto(mealId: string, file: File): Promise<void>;
  addMember(m: Member): Promise<void>;
  removeMember(email: string): Promise<void>;
}
