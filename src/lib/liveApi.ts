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
      const [weeks, weekMeals, meals, ratings, favorites, settings] =
        await Promise.all([
          sb.from("weeks").select("*").order("starts_on", { ascending: false }),
          sb.from("week_meals").select("*"),
          sb.from("meals").select("*"),
          sb.from("ratings").select("*"),
          sb.from("favorites").select("meal_id, member_email"),
          sb.from("member_settings").select("*"),
        ]);
      const weekList = must(weeks) as Snapshot["weeks"];
      // Picks, notes and questionnaires matter for the newest couple of weeks;
      // groceries and cook-mode ticks belong to the week being cooked.
      const recent = weekList.slice(0, 3).map((w) => w.id);
      const cooking = weekList.find((w) => w.status === "locked");
      const none = { data: [], error: null };
      const [picks, notes, questionnaires, groceries, cookChecks] =
        await Promise.all([
          recent.length
            ? sb
                .from("picks")
                .select("week_id, meal_id, member_email")
                .in("week_id", recent)
            : none,
          recent.length
            ? sb
                .from("notes")
                .select("week_id, member_email, body")
                .in("week_id", recent)
            : none,
          recent.length
            ? sb.from("questionnaires").select("*").in("week_id", recent)
            : none,
          cooking
            ? sb
                .from("grocery_items")
                .select("*")
                .eq("week_id", cooking.id)
                .order("position")
            : none,
          cooking
            ? sb
                .from("cook_checks")
                .select("week_id, meal_id, key, member_email")
                .eq("week_id", cooking.id)
            : none,
        ]);
      return {
        me,
        members,
        weeks: weekList.map((w) => ({ ...w, extras: w.extras ?? {} })),
        weekMeals: must(weekMeals) as Snapshot["weekMeals"],
        meals: (must(meals) as Snapshot["meals"]).map((m) => ({
          ...m,
          tips: m.tips ?? [],
        })),
        picks: must(picks) as Snapshot["picks"],
        ratings: must(ratings) as Snapshot["ratings"],
        favorites: must(favorites) as Snapshot["favorites"],
        notes: must(notes) as Snapshot["notes"],
        questionnaires: must(questionnaires) as Snapshot["questionnaires"],
        settings: must(settings) as Snapshot["settings"],
        cookChecks: must(cookChecks) as Snapshot["cookChecks"],
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
        "cook_checks",
        "questionnaires",
        "member_settings",
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

    async setCookCheck(weekId, mealId, key, on) {
      if (on)
        must(
          await sb.from("cook_checks").upsert({
            week_id: weekId,
            meal_id: mealId,
            key,
            member_email: myEmail(),
            updated_at: new Date().toISOString(),
          }),
        );
      else
        must(
          await sb
            .from("cook_checks")
            .delete()
            .match({ week_id: weekId, meal_id: mealId, key }),
        );
    },
    async setCookOrder(weekId, mealIds) {
      must(
        await sb.rpc("set_cook_order", { p_week: weekId, p_meals: mealIds }),
      );
    },
    async saveQuestionnaire(weekId, answers) {
      must(
        await sb.from("questionnaires").upsert({
          week_id: weekId,
          member_email: myEmail(),
          answers,
          updated_at: new Date().toISOString(),
        }),
      );
    },
    async setInstacart(connected, zip) {
      must(
        await sb.from("member_settings").upsert({
          member_email: myEmail(),
          instacart_connected_at: connected ? new Date().toISOString() : null,
          instacart_zip: zip,
          updated_at: new Date().toISOString(),
        }),
      );
    },
    async instacartLink(title, items) {
      const { data, error } = await sb.functions.invoke("instacart-list", {
        body: { title, items },
      });
      if (error)
        throw new Error("Instacart didn't respond. Try again in a minute.");
      return (data as { url?: string | null })?.url ?? null;
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
