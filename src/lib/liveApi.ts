import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccountStatus, Api, Member, Snapshot } from "./types";

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function createLiveApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  let email: string | null = null;
  const myEmail = () => {
    if (!email) throw new Error("Sign in first");
    return email;
  };

  return {
    mode: "live",

    async currentEmail() {
      const { data } = await sb.auth.getSession();
      email = data.session?.user.email?.toLowerCase() ?? null;
      return email;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        email = session?.user.email?.toLowerCase() ?? null;
        cb(email);
      });
      return () => data.subscription.unsubscribe();
    },
    async accountStatus(e) {
      return must(
        await sb.rpc("sign_in_status", { p_email: e }),
      ) as AccountStatus;
    },
    async signIn(e, password) {
      const { error } = await sb.auth.signInWithPassword({
        email: e,
        password,
      });
      if (error)
        throw new Error(
          /invalid/i.test(error.message)
            ? "That password doesn't match. Try again, or ask Rueben to reset it."
            : error.message,
        );
    },
    async createAccount(e, password) {
      const { data, error } = await sb.auth.signUp({ email: e, password });
      if (error) throw new Error(error.message);
      if (!data.session)
        throw new Error(
          "Your account was created, but Supabase is waiting for an email confirmation. Turn off Confirm email in Supabase, then sign in.",
        );
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async snapshot(e) {
      email = e;
      const members = must(
        await sb.from("members").select("email, display_name, role"),
      ) as Member[];
      const me = members.find((m) => m.email === e);
      if (!me) return null;
      const [weeks, weekMeals, meals, ratings, favorites] = await Promise.all([
        sb.from("weeks").select("*").order("starts_on", { ascending: false }),
        sb.from("week_meals").select("*"),
        sb.from("meals").select("*"),
        sb.from("ratings").select("*"),
        sb.from("favorites").select("meal_id, member_email"),
      ]);
      const weekList = must(weeks) as Snapshot["weeks"];
      const current = weekList[0];
      const [picks, notes, groceries] = current
        ? await Promise.all([
            sb
              .from("picks")
              .select("week_id, meal_id, member_email")
              .eq("week_id", current.id),
            sb
              .from("notes")
              .select("week_id, member_email, body")
              .eq("week_id", current.id),
            sb
              .from("grocery_items")
              .select("*")
              .eq("week_id", current.id)
              .order("position"),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];
      return {
        me,
        members,
        weeks: weekList,
        weekMeals: must(weekMeals) as Snapshot["weekMeals"],
        meals: must(meals) as Snapshot["meals"],
        picks: must(picks) as Snapshot["picks"],
        ratings: must(ratings) as Snapshot["ratings"],
        favorites: must(favorites) as Snapshot["favorites"],
        notes: must(notes) as Snapshot["notes"],
        groceries: (must(groceries) as Snapshot["groceries"]).map((g) => ({
          ...g,
          qty: g.qty == null ? null : Number(g.qty),
        })),
      };
    },

    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ping = () => {
        clearTimeout(timer);
        timer = setTimeout(onChange, 250);
      };
      const channel = sb.channel("household");
      for (const table of [
        "grocery_items",
        "picks",
        "ratings",
        "week_meals",
        "weeks",
        "notes",
        "favorites",
      ]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          ping,
        );
      }
      channel.subscribe();
      const onFocus = () => document.visibilityState === "visible" && ping();
      document.addEventListener("visibilitychange", onFocus);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", onFocus);
        sb.removeChannel(channel);
      };
    },

    async setPick(weekId, mealId, on) {
      const row = { week_id: weekId, meal_id: mealId, member_email: myEmail() };
      if (on) must(await sb.from("picks").upsert(row));
      else must(await sb.from("picks").delete().match(row));
    },
    async saveRating(r) {
      must(
        await sb.from("ratings").upsert({
          ...r,
          member_email: myEmail(),
          updated_at: new Date().toISOString(),
        }),
      );
    },
    async setFavorite(mealId, on) {
      const row = { meal_id: mealId, member_email: myEmail() };
      if (on) must(await sb.from("favorites").upsert(row));
      else must(await sb.from("favorites").delete().match(row));
    },
    async saveNote(weekId, body) {
      must(
        await sb.from("notes").upsert({
          week_id: weekId,
          member_email: myEmail(),
          body,
          updated_at: new Date().toISOString(),
        }),
      );
    },
    async setChecked(itemId, checked) {
      must(
        await sb
          .from("grocery_items")
          .update({ checked, checked_by: checked ? myEmail() : null })
          .eq("id", itemId),
      );
    },
    async markCooked(weekId, mealId, cooked) {
      must(
        await sb.rpc("mark_cooked", {
          p_week: weekId,
          p_meal: mealId,
          p_cooked: cooked,
        }),
      );
    },

    async loadWeek(menu) {
      must(await sb.rpc("load_week", { p: menu }));
    },
    async lockWeek(weekId, mealIds) {
      must(await sb.rpc("lock_week", { p_week: weekId, p_meals: mealIds }));
    },
    async reopenWeek(weekId) {
      must(await sb.rpc("reopen_week", { p_week: weekId }));
    },
    async setGroceries(weekId, items) {
      must(
        await sb.rpc("set_groceries", { p_week: weekId, p_items: items ?? [] }),
      );
    },
    async uploadPhoto(mealId, file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${mealId}/${Date.now()}.${ext}`;
      must(
        await sb.storage
          .from("meal-photos")
          .upload(path, file, { contentType: file.type, upsert: false }),
      );
      const { data } = sb.storage.from("meal-photos").getPublicUrl(path);
      must(
        await sb
          .from("meals")
          .update({ image_url: data.publicUrl, image_credit: "Our kitchen" })
          .eq("id", mealId),
      );
    },
    async addMember(m) {
      must(
        await sb
          .from("members")
          .insert({ ...m, email: m.email.trim().toLowerCase() }),
      );
    },
    async removeMember(e) {
      must(await sb.from("members").delete().eq("email", e));
    },
  };
}
