import type { Meal, MenuImport, Snapshot, Style, Week } from "./types";

export const STYLE_LABEL: Record<Style, string> = {
  oven: "Oven-ready",
  express: "Express",
  involved: "A little more involved",
};

export const SECTION_ORDER = [
  "Produce",
  "Meat & seafood",
  "Dairy",
  "Bread & tortillas",
  "Canned & jarred",
  "Frozen",
  "Spice on the side",
  "Other",
];

export function sectionRank(s: string) {
  const i = SECTION_ORDER.indexOf(s);
  return i < 0 ? SECTION_ORDER.length - 1 : i;
}

const FRACTIONS: Array<[number, string]> = [
  [0.25, "¼"],
  [0.5, "½"],
  [0.75, "¾"],
];

export function formatQty(qty: number | null, unit: string) {
  if (qty == null) return unit;
  const whole = Math.floor(qty);
  const frac = FRACTIONS.find(([v]) => Math.abs(qty - whole - v) < 0.01)?.[1];
  let n: string;
  if (qty === whole) n = String(whole);
  else if (frac) n = whole ? `${whole}${frac}` : frac;
  else n = String(Math.round(qty * 10) / 10);
  return unit ? `${n} ${unit}` : n;
}

export function firstName(s: Snapshot, email: string | null | undefined) {
  if (!email) return "";
  return (
    s.members.find((m) => m.email === email)?.display_name ??
    email.split("@")[0]
  );
}

export function currentWeek(s: Snapshot): Week | undefined {
  return s.weeks[0];
}

export function weekMeals(s: Snapshot, weekId: string) {
  return s.weekMeals
    .filter((w) => w.week_id === weekId)
    .map((w) => ({ wm: w, meal: s.meals.find((m) => m.id === w.meal_id)! }))
    .filter((x) => x.meal)
    .sort((a, b) => a.wm.position - b.wm.position);
}

export function hasRecipe(m: Meal) {
  return m.steps.length > 0;
}

export function formatDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString(undefined, opts);
}

/** Validates pasted menu JSON and returns a readable error, or the parsed menu. */
export function parseMenu(text: string): { menu?: MenuImport; error?: string } {
  let data: MenuImport;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      error:
        "That isn't valid menu data. Paste the whole block Claude gave you, from the first { to the last }.",
    };
  }
  if (!data?.week?.label || !data.week.starts_on)
    return { error: "The menu is missing its week label or start date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.week.starts_on))
    return { error: "The week start date should look like 2026-11-08." };
  if (!Array.isArray(data.meals) || data.meals.length === 0)
    return { error: "The menu has no meals in it." };
  for (const m of data.meals) {
    if (!m.slug || !m.name)
      return { error: "Every meal needs a name and a slug." };
    if (m.style && !["oven", "express", "involved"].includes(m.style))
      return { error: `${m.name} has an unknown style "${m.style}".` };
    m.included ??= [];
    m.ingredients ??= [];
    m.steps ??= [];
    m.shopping ??= [];
  }
  return { menu: data };
}

/** Plain-text summary Rueben pastes to Claude when planning the next menu. */
export function exportForClaude(s: Snapshot) {
  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`Rueben's MPS export for Claude (${today})`, "");
  const week = currentWeek(s);
  if (week) {
    const list = weekMeals(s, week.id);
    lines.push(`Current week: ${week.label} (${week.status})`);
    for (const m of s.members) {
      const picked = s.picks
        .filter((p) => p.member_email === m.email)
        .map((p) => s.meals.find((x) => x.id === p.meal_id)?.name);
      lines.push(
        `- ${m.display_name} picked: ${picked.length ? picked.join(", ") : "nothing yet"}`,
      );
    }
    const chosen = list.filter((x) => x.wm.chosen).map((x) => x.meal.name);
    if (chosen.length) lines.push(`- Locked in: ${chosen.join(", ")}`);
    for (const n of s.notes.filter((n) => n.body.trim()))
      lines.push(
        `- Request from ${firstName(s, n.member_email)}: ${n.body.trim()}`,
      );
    lines.push("");
  }
  lines.push("Ratings (newest first):");
  const ratings = [...s.ratings].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  if (!ratings.length) lines.push("- none yet");
  for (const r of ratings) {
    const meal = s.meals.find((m) => m.id === r.meal_id)?.name;
    const wk = s.weeks.find((w) => w.id === r.week_id)?.label;
    const again =
      r.make_again == null
        ? ""
        : r.make_again
          ? ", make again"
          : ", skip next time";
    const comment = r.comment?.trim() ? ` — "${r.comment.trim()}"` : "";
    lines.push(
      `- ${meal} (${wk}): ${firstName(s, r.member_email)} ${r.stars}/5${again}${comment}`,
    );
  }
  lines.push("", "Favorites:");
  for (const m of s.members) {
    const favs = s.favorites
      .filter((f) => f.member_email === m.email)
      .map((f) => s.meals.find((x) => x.id === f.meal_id)?.name);
    lines.push(
      `- ${m.display_name}: ${favs.length ? favs.join(", ") : "none yet"}`,
    );
  }
  lines.push(
    "",
    `Meals already served: ${[...new Set(s.weekMeals.filter((w) => w.chosen).map((w) => s.meals.find((m) => m.id === w.meal_id)?.name))].join(", ")}`,
  );
  return lines.join("\n");
}
