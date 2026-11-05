// A self-contained version of the app's backend that runs in the browser.
// Used only when the app has no Supabase keys (for previews and testing).
import week1 from "../../menus/2026-11-01.json";
import week2 from "../../menus/2026-11-08.json";
import type { Api, GroceryItem, Meal, MenuImport, Snapshot } from "./types";

const KEY = "mps-demo-v2";
const uid = () => Math.random().toString(36).slice(2, 10);

type State = Omit<Snapshot, "me"> & { signedIn: string | null };

function buildGroceries(state: State, weekId: string): GroceryItem[] {
  const chosen = state.weekMeals.filter(
    (w) => w.week_id === weekId && w.chosen,
  );
  const groups = new Map<string, GroceryItem>();
  for (const wm of chosen) {
    const meal = state.meals.find((m) => m.id === wm.meal_id);
    if (!meal) continue;
    for (const s of meal.shopping) {
      const unit = s.unit ?? "";
      const key = `${s.name.trim().toLowerCase()}|${unit}`;
      const g = groups.get(key);
      if (g) {
        if (s.qty != null) g.qty = (g.qty ?? 0) + s.qty;
        if (s.pantry) {
          g.pantry = true;
          g.section = "Pantry";
        }
        if (s.note && !g.note?.includes(s.note))
          g.note = g.note ? `${g.note}; ${s.note}` : s.note;
        if (!g.meals.includes(meal.name)) g.meals.push(meal.name);
      } else {
        groups.set(key, {
          id: uid(),
          week_id: weekId,
          section: s.pantry ? "Pantry" : s.section || "Other",
          name: s.name.trim(),
          qty: s.qty ?? null,
          unit,
          note: s.note ?? null,
          pantry: !!s.pantry,
          meals: [meal.name],
          checked: false,
          checked_by: null,
          position: 0,
        });
      }
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g, i) => ({ ...g, position: i }));
}

function importWeek(state: State, p: MenuImport) {
  let week = state.weeks.find((w) => w.starts_on === p.week.starts_on);
  if (!week) {
    week = {
      id: uid(),
      label: p.week.label,
      starts_on: p.week.starts_on,
      pick_by: p.week.pick_by ?? null,
      status: "picking",
      extras: p.extras ?? {},
    };
    state.weeks.push(week);
  } else {
    week.label = p.week.label;
    week.pick_by = p.week.pick_by ?? null;
    week.extras = p.extras ?? {};
  }
  state.weekMeals = state.weekMeals.filter((w) => w.week_id !== week.id);
  p.meals.forEach((m, i) => {
    let meal = state.meals.find((x) => x.slug === m.slug);
    if (meal)
      Object.assign(meal, m, { image_url: m.image_url ?? meal.image_url });
    else {
      meal = {
        ...(m as Meal),
        tips: m.tips ?? [],
        learn: m.learn ?? null,
        id: uid(),
      };
      state.meals.push(meal);
    }
    state.weekMeals.push({
      week_id: week.id,
      meal_id: meal.id,
      position: i,
      chosen: false,
      cook_order: null,
      cooked_at: null,
    });
  });
  state.groceries = state.groceries.filter((g) => g.week_id !== week.id);
  if (p.chosen?.length) {
    const ids = state.meals
      .filter((m) => p.chosen!.includes(m.slug))
      .map((m) => m.id);
    lock(state, week.id, ids);
    if (p.cook_order) {
      for (const wm of state.weekMeals.filter(
        (w) => w.week_id === week.id && w.chosen,
      )) {
        const slug = state.meals.find((m) => m.id === wm.meal_id)?.slug ?? "";
        const i = p.cook_order.indexOf(slug);
        if (i >= 0) wm.cook_order = i + 1;
      }
    }
    if (p.groceries) setGroceries(state, week.id, p.groceries);
  } else week.status = "picking";
  state.weeks.sort((a, b) => b.starts_on.localeCompare(a.starts_on));
}

function lock(state: State, weekId: string, mealIds: string[]) {
  const wms = state.weekMeals
    .filter((w) => w.week_id === weekId)
    .sort((a, b) => a.position - b.position);
  let n = 1;
  for (const wm of wms) {
    wm.chosen = mealIds.includes(wm.meal_id);
    wm.cook_order = wm.chosen ? n++ : null;
  }
  const w = state.weeks.find((x) => x.id === weekId);
  if (w) {
    w.status = "locked";
    for (const o of state.weeks)
      if (o.id !== w.id && o.status === "locked" && o.starts_on < w.starts_on)
        o.status = "done";
  }
  state.groceries = state.groceries
    .filter((g) => g.week_id !== weekId)
    .concat(buildGroceries(state, weekId));
}

function setGroceries(
  state: State,
  weekId: string,
  items: MenuImport["groceries"],
) {
  state.groceries = state.groceries
    .filter((g) => g.week_id !== weekId)
    .concat(
      (items ?? []).map((i, n) => ({
        id: uid(),
        week_id: weekId,
        section: i.pantry ? "Pantry" : i.section || "Other",
        name: i.name,
        qty: i.qty ?? null,
        unit: i.unit ?? "",
        note: i.note ?? null,
        pantry: !!i.pantry,
        meals: i.meals ?? [],
        checked: false,
        checked_by: null,
        position: n,
      })),
    );
}

function fresh(): State {
  const s: State = {
    signedIn: null,
    members: [
      { email: "you@example.com", display_name: "You", role: "admin" },
      { email: "partner@example.com", display_name: "Partner", role: "member" },
    ],
    weeks: [],
    weekMeals: [],
    meals: [],
    picks: [],
    ratings: [],
    favorites: [],
    notes: [],
    groceries: [],
    cookChecks: [],
    questionnaires: [],
    settings: [],
  };
  importWeek(s, week1 as unknown as MenuImport);
  importWeek(s, week2 as unknown as MenuImport);
  return s;
}

export function createDemoApi(): Api {
  let state: State;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || "") as State;
    if (!state?.weeks) throw new Error();
  } catch {
    state = fresh();
  }
  const listeners = new Set<() => void>();
  const authListeners = new Set<(e: string | null) => void>();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep in memory */
    }
    listeners.forEach((l) => l());
  };
  const me = () => state.signedIn ?? "you@example.com";
  const cookingWeekId = () =>
    [...state.weeks]
      .sort((a, b) => b.starts_on.localeCompare(a.starts_on))
      .find((w) => w.status === "locked")?.id;

  return {
    mode: "demo",
    async currentEmail() {
      return state.signedIn;
    },
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    async accountStatus(e) {
      return state.members.some((m) => m.email === e.toLowerCase())
        ? "existing"
        : "not_member";
    },
    async signIn(e) {
      state.signedIn = e.toLowerCase();
      save();
      authListeners.forEach((l) => l(state.signedIn));
    },
    async createAccount(e) {
      state.signedIn = e.toLowerCase();
      save();
      authListeners.forEach((l) => l(state.signedIn));
    },
    async signOut() {
      state.signedIn = null;
      save();
      authListeners.forEach((l) => l(null));
    },
    async snapshot(e) {
      const meM = state.members.find((m) => m.email === e);
      if (!meM) return null;
      const wk = cookingWeekId();
      return structuredClone({
        ...state,
        me: meM,
        weeks: [...state.weeks].sort((a, b) =>
          b.starts_on.localeCompare(a.starts_on),
        ),
        cookChecks: state.cookChecks.filter((c) => c.week_id === wk),
        groceries: state.groceries
          .filter((g) => g.week_id === wk)
          .sort((a, b) => a.position - b.position),
      });
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async setPick(weekId, mealId, on) {
      state.picks = state.picks.filter(
        (p) =>
          !(
            p.week_id === weekId &&
            p.meal_id === mealId &&
            p.member_email === me()
          ),
      );
      if (on)
        state.picks.push({
          week_id: weekId,
          meal_id: mealId,
          member_email: me(),
        });
      save();
    },
    async saveRating(r) {
      state.ratings = state.ratings.filter(
        (x) =>
          !(
            x.week_id === r.week_id &&
            x.meal_id === r.meal_id &&
            x.member_email === me()
          ),
      );
      state.ratings.push({
        ...r,
        member_email: me(),
        updated_at: new Date().toISOString(),
      });
      save();
    },
    async setFavorite(mealId, on) {
      state.favorites = state.favorites.filter(
        (f) => !(f.meal_id === mealId && f.member_email === me()),
      );
      if (on) state.favorites.push({ meal_id: mealId, member_email: me() });
      save();
    },
    async saveNote(weekId, body) {
      state.notes = state.notes.filter(
        (n) => !(n.week_id === weekId && n.member_email === me()),
      );
      state.notes.push({ week_id: weekId, member_email: me(), body });
      save();
    },
    async setChecked(id, checked) {
      const g = state.groceries.find((x) => x.id === id);
      if (g) {
        g.checked = checked;
        g.checked_by = checked ? me() : null;
      }
      save();
    },
    async setCookCheck(weekId, mealId, key, on) {
      state.cookChecks = state.cookChecks.filter(
        (c) => !(c.week_id === weekId && c.meal_id === mealId && c.key === key),
      );
      if (on)
        state.cookChecks.push({
          week_id: weekId,
          meal_id: mealId,
          key,
          member_email: me(),
        });
      save();
    },
    async setCookOrder(weekId, mealIds) {
      mealIds.forEach((id, i) => {
        const wm = state.weekMeals.find(
          (w) => w.week_id === weekId && w.meal_id === id,
        );
        if (wm) wm.cook_order = i + 1;
      });
      save();
    },
    async saveQuestionnaire(weekId, answers) {
      state.questionnaires = state.questionnaires.filter(
        (q) => !(q.week_id === weekId && q.member_email === me()),
      );
      state.questionnaires.push({
        week_id: weekId,
        member_email: me(),
        answers,
        updated_at: new Date().toISOString(),
      });
      save();
    },
    async setInstacart(connected, zip) {
      state.settings = state.settings.filter((x) => x.member_email !== me());
      state.settings.push({
        member_email: me(),
        instacart_connected_at: connected ? new Date().toISOString() : null,
        instacart_zip: zip,
      });
      save();
    },
    async instacartLink() {
      return null;
    },
    async markCooked(weekId, mealId, cooked) {
      const wm = state.weekMeals.find(
        (w) => w.week_id === weekId && w.meal_id === mealId,
      );
      if (wm)
        wm.cooked_at = cooked
          ? (wm.cooked_at ?? new Date().toISOString())
          : null;
      save();
    },
    async loadWeek(menu) {
      importWeek(state, menu);
      save();
    },
    async lockWeek(weekId, mealIds) {
      lock(state, weekId, mealIds);
      save();
    },
    async reopenWeek(weekId) {
      for (const wm of state.weekMeals.filter((w) => w.week_id === weekId)) {
        wm.chosen = false;
        wm.cook_order = null;
        wm.cooked_at = null;
      }
      state.groceries = state.groceries.filter((g) => g.week_id !== weekId);
      const w = state.weeks.find((x) => x.id === weekId);
      if (w) w.status = "picking";
      save();
    },
    async setGroceries(weekId, items) {
      setGroceries(state, weekId, items);
      save();
    },
    async uploadPhoto(mealId, file) {
      const url = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.readAsDataURL(file);
      });
      const m = state.meals.find((x) => x.id === mealId);
      if (m) m.image_url = url;
      save();
    },
    async addMember(m) {
      state.members.push({ ...m, email: m.email.toLowerCase() });
      save();
    },
    async removeMember(e) {
      state.members = state.members.filter((m) => m.email !== e);
      save();
    },
  };
}
