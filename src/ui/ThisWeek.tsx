import { useEffect, useMemo, useState } from "react";
import { useApp } from "./context";
import {
  Avatar,
  Empty,
  HeroCard,
  Icon,
  MealMeta,
  Photo,
  Sheet,
  Stars,
} from "./bits";
import { QuestionnaireCard } from "./Questionnaire";
import {
  cookingWeek,
  firstName,
  formatDate,
  pickingWeek,
  sharedWithGroceries,
  weekMeals,
} from "../lib/util";
import type { Meal, Snapshot, Week } from "../lib/types";

type View = "cooking" | "picking";

export function ThisWeek() {
  const { s } = useApp();
  const cooking = cookingWeek(s);
  const picking = pickingWeek(s);
  const iPicked =
    !!picking &&
    s.picks.some(
      (p) => p.week_id === picking.id && p.member_email === s.me.email,
    );
  const [view, setView] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem("mps-week-view") as View | null;
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return picking && !iPicked ? "picking" : "cooking";
  });
  const choose = (v: View) => {
    setView(v);
    try {
      sessionStorage.setItem("mps-week-view", v);
    } catch {
      /* ignore */
    }
  };

  if (!cooking && !picking)
    return (
      <>
        <Header title="This week" />
        <Empty title="No menu yet">
          <p>
            {s.me.role === "admin"
              ? "Load the first menu from the Kitchen tab."
              : "This week's menu will show up here as soon as it's ready."}
          </p>
        </Empty>
      </>
    );

  const both = !!cooking && !!picking;
  const active = !cooking ? "picking" : !picking ? "cooking" : view;

  const switcher = both && (
    <div className="segmented tabs week-switch" role="tablist">
      <button
        role="tab"
        aria-selected={active === "cooking"}
        className={active === "cooking" ? "on" : ""}
        onClick={() => choose("cooking")}
      >
        Cooking now
      </button>
      <button
        role="tab"
        aria-selected={active === "picking"}
        className={active === "picking" ? "on" : ""}
        onClick={() => choose("picking")}
      >
        Next week's menu
        {!iPicked && <span className="dot" aria-label="needs your picks" />}
      </button>
    </div>
  );

  return active === "picking" ? (
    <Picking week={picking!} switcher={switcher} />
  ) : (
    <Locked
      week={cooking!}
      switcher={switcher}
      hasNext={!!picking}
      onGoNext={() => choose("picking")}
    />
  );
}

function Header({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="wordmark">
        Rueben's <span>MPS</span>
      </div>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

function pickersOf(s: Snapshot, weekId: string, mealId: string) {
  return s.picks
    .filter((p) => p.week_id === weekId && p.meal_id === mealId)
    .map((p) => p.member_email);
}

/* ---------------- Picking ---------------- */

function Picking({
  week,
  switcher,
}: {
  week: Week;
  switcher: React.ReactNode;
}) {
  const { s, api, patch, run, openMeal } = useApp();
  const [lockOpen, setLockOpen] = useState(false);
  const list = weekMeals(s, week.id);
  const admin = s.members.find((m) => m.role === "admin");
  const myPicks = s.picks.filter(
    (p) => p.week_id === week.id && p.member_email === s.me.email,
  ).length;
  const cooking = cookingWeek(s);

  function toggle(meal: Meal, on: boolean) {
    patch((cur) => ({
      ...cur,
      picks: on
        ? [
            ...cur.picks,
            { week_id: week.id, meal_id: meal.id, member_email: cur.me.email },
          ]
        : cur.picks.filter(
            (p) =>
              !(
                p.week_id === week.id &&
                p.meal_id === meal.id &&
                p.member_email === cur.me.email
              ),
          ),
    }));
    run(() => api.setPick(week.id, meal.id, on));
  }

  return (
    <>
      <Header title={week.label}>
        {switcher}
        <p className="lede">
          Pick the dinners you'd like.{" "}
          {admin?.email === s.me.email
            ? "You lock"
            : `${admin?.display_name ?? "Rueben"} locks`}{" "}
          in the final four
          {week.pick_by
            ? ` on ${formatDate(week.pick_by, { weekday: "long", month: "short", day: "numeric" })}`
            : ""}
          .
        </p>
        <ul className="pick-tally" aria-label="Picks so far">
          {s.members.map((m) => {
            const n = s.picks.filter(
              (p) => p.week_id === week.id && p.member_email === m.email,
            ).length;
            return (
              <li key={m.email}>
                <Avatar s={s} email={m.email} />
                <span>
                  {m.email === s.me.email ? "You" : m.display_name} picked{" "}
                  {n === 0 ? "nothing yet" : n}
                </span>
              </li>
            );
          })}
        </ul>
      </Header>

      <HeroCard s={s} week={week} />

      <div className="meal-list">
        {list.map(({ meal }) => {
          const pickers = pickersOf(s, week.id, meal.id);
          const mine = pickers.includes(s.me.email);
          const shared = cooking ? sharedWithGroceries(s, meal) : [];
          const isHero = week.extras?.hero?.used_in.includes(meal.slug);
          return (
            <article
              className={`meal-card ${mine ? "is-picked" : ""}`}
              key={meal.id}
            >
              <div className="meal-card-photo">
                <button
                  className="photo-btn"
                  onClick={() => openMeal(meal.id, week.id)}
                  aria-label={`See details for ${meal.name}`}
                >
                  <Photo meal={meal} />
                </button>
                <button
                  className={`sticker pick-sticker ${mine ? "on" : ""}`}
                  aria-pressed={mine}
                  aria-label={
                    mine ? `Unpick ${meal.name}` : `Pick ${meal.name}`
                  }
                  onClick={() => toggle(meal, !mine)}
                >
                  {mine ? <Icon name="check" size={30} /> : "Pick"}
                </button>
              </div>
              <button
                className="meal-card-body"
                onClick={() => openMeal(meal.id, week.id)}
              >
                <h2>{meal.name}</h2>
                <MealMeta meal={meal} />
                <p className="clamp">{meal.description}</p>
                {(isHero || shared.length > 0) && (
                  <p className="card-chips">
                    {isHero && (
                      <span className="chip chip-hero">
                        Uses {week.extras.hero!.name.toLowerCase()}
                      </span>
                    )}
                    {shared.length > 0 && (
                      <span className="chip chip-have">
                        You already have{" "}
                        {shared.slice(0, 2).join(", ").toLowerCase()}
                        {shared.length > 2 ? ` +${shared.length - 2}` : ""}
                      </span>
                    )}
                  </p>
                )}
                {pickers.length > 0 && (
                  <p className="picked-by">
                    {pickers.map((e) => (
                      <Avatar key={e} s={s} email={e} size={22} />
                    ))}
                    <span>
                      {pickers.length === s.members.length &&
                      s.members.length > 1
                        ? "You both want this"
                        : `${pickers.map((e) => (e === s.me.email ? "You" : firstName(s, e))).join(" and ")} picked this`}
                    </span>
                  </p>
                )}
              </button>
            </article>
          );
        })}
      </div>

      <NoteBox week={week} />

      {s.me.role === "admin" ? (
        <div className="sticky-cta">
          <button
            className="btn btn-primary btn-block"
            onClick={() => setLockOpen(true)}
          >
            Lock in {week.label.replace(/^Week of /, "")}'s 4 meals
          </button>
        </div>
      ) : (
        <p className="fineprint center">
          {myPicks >= 4
            ? "You're all set. Rueben will lock in the final four."
            : "Pick at least four so there’s room to agree."}
        </p>
      )}

      <LockSheet
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        week={week}
      />
    </>
  );
}

function NoteBox({ week }: { week: Week }) {
  const { s, api, run } = useApp();
  const saved =
    s.notes.find((n) => n.week_id === week.id && n.member_email === s.me.email)
      ?.body ?? "";
  const [body, setBody] = useState(saved);
  useEffect(() => setBody(saved), [saved]);
  const others = s.notes.filter(
    (n) =>
      n.week_id === week.id && n.member_email !== s.me.email && n.body.trim(),
  );
  return (
    <section className="card note-box">
      <label htmlFor="note">
        <h3>Anything to swap, skip or request?</h3>
      </label>
      {others.map((n) => (
        <p key={n.member_email} className="other-note">
          <Avatar s={s} email={n.member_email} size={22} /> {n.body}
        </p>
      ))}
      <textarea
        id="note"
        rows={2}
        placeholder="More pasta, no salmon this week…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {body !== saved && (
        <button
          className="btn btn-small"
          onClick={() => run(() => api.saveNote(week.id, body), "Note saved")}
        >
          Save note
        </button>
      )}
    </section>
  );
}

function LockSheet({
  open,
  onClose,
  week,
}: {
  open: boolean;
  onClose: () => void;
  week: Week;
}) {
  const { s, api, run } = useApp();
  const ranked = useMemo(() => {
    return weekMeals(s, week.id)
      .map((x) => ({ ...x, votes: pickersOf(s, week.id, x.meal.id).length }))
      .sort((a, b) => b.votes - a.votes || a.wm.position - b.wm.position);
  }, [s, week.id]);
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (open) setSel(ranked.slice(0, 4).map((x) => x.meal.id));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setSel((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const cooking = cookingWeek(s);

  return (
    <Sheet open={open} onClose={onClose} label="Lock in meals">
      <h2>Lock in the week</h2>
      <p className="muted">
        The most-picked meals are selected. Locking builds the new grocery list
        {cooking && cooking.id !== week.id
          ? ` and moves ${cooking.label} to the Cookbook`
          : ""}
        .
      </p>
      <ul className="lock-list">
        {ranked.map(({ meal, votes }) => (
          <li key={meal.id}>
            <label className={sel.includes(meal.id) ? "on" : ""}>
              <input
                type="checkbox"
                checked={sel.includes(meal.id)}
                onChange={() => toggle(meal.id)}
              />
              <Photo meal={meal} className="thumb" />
              <span className="lock-name">
                {meal.name}
                <small>
                  {votes === 0
                    ? "No picks"
                    : votes === 1
                      ? "1 pick"
                      : `${votes} picks`}
                </small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        className="btn btn-primary btn-block"
        disabled={sel.length === 0}
        onClick={async () => {
          if (
            await run(
              () => api.lockWeek(week.id, sel),
              "Locked in. The grocery list is ready.",
            )
          ) {
            try {
              sessionStorage.setItem("mps-week-view", "cooking");
            } catch {
              /* ignore */
            }
            onClose();
          }
        }}
      >
        Lock in {sel.length} meal{sel.length === 1 ? "" : "s"}
      </button>
    </Sheet>
  );
}

/* ---------------- Cooking (locked) ---------------- */

function Locked({
  week,
  switcher,
  hasNext,
  onGoNext,
}: {
  week: Week;
  switcher: React.ReactNode;
  hasNext: boolean;
  onGoNext: () => void;
}) {
  const { s, api, run, patch, openMeal, openCook, openRate, go } = useApp();
  const [reorder, setReorder] = useState(false);
  const list = weekMeals(s, week.id);
  const chosen = list
    .filter((x) => x.wm.chosen)
    .sort((a, b) => (a.wm.cook_order ?? 99) - (b.wm.cook_order ?? 99));
  const others = list.filter((x) => !x.wm.chosen);
  const myRating = (mealId: string) =>
    s.ratings.find(
      (r) =>
        r.week_id === week.id &&
        r.meal_id === mealId &&
        r.member_email === s.me.email,
    );
  const toRate = chosen.filter((x) => x.wm.cooked_at && !myRating(x.meal.id));
  const left = s.groceries.filter((g) => !g.checked && !g.pantry).length;

  function move(index: number, dir: -1 | 1) {
    const ids = chosen.map((x) => x.meal.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    patch((cur) => ({
      ...cur,
      weekMeals: cur.weekMeals.map((wm) =>
        wm.week_id === week.id && ids.includes(wm.meal_id)
          ? { ...wm, cook_order: ids.indexOf(wm.meal_id) + 1 }
          : wm,
      ),
    }));
    run(() => api.setCookOrder(week.id, ids));
  }

  return (
    <>
      <Header title={week.label}>
        {switcher}
        <p className="lede">
          Your dinners for the week. Cook them in any order, and reorder the
          nights whenever plans change.
        </p>
      </Header>

      {hasNext && !switcher && (
        <button className="nudge" onClick={onGoNext}>
          <Icon name="menu" />
          <span>
            <b>Next week's menu is ready</b>
            <small>Pick your dinners</small>
          </span>
        </button>
      )}

      {toRate.slice(0, 1).map(({ meal }) => (
        <button
          key={meal.id}
          className="nudge"
          onClick={() => openRate(week.id, meal.id)}
        >
          <Photo meal={meal} className="thumb" />
          <span>
            <b>How was the {meal.name.toLowerCase()}?</b>
            <small>Rate it so the good ones come back.</small>
          </span>
          <Stars value={0} size={16} />
        </button>
      ))}

      {left > 0 && (
        <button className="nudge nudge-quiet" onClick={() => go("groceries")}>
          <Icon name="cart" />
          <span>
            <b>{left} items left to buy</b>
            <small>Open the shared grocery list</small>
          </span>
        </button>
      )}

      {!hasNext && <QuestionnaireCard week={week} />}

      <div className="row-between list-head">
        <h2 className="section-title">The nights</h2>
        <button
          className={`btn btn-small ${reorder ? "btn-primary" : ""}`}
          onClick={() => setReorder((r) => !r)}
        >
          {reorder ? "Done" : "Change order"}
        </button>
      </div>

      {reorder ? (
        <ol className="reorder-list">
          {chosen.map(({ meal, wm }, i) => (
            <li key={meal.id}>
              <span className="night-num static">Night {i + 1}</span>
              <Photo meal={meal} className="thumb" />
              <span className="reorder-name">
                {meal.name}
                {wm.cooked_at && <small>Cooked</small>}
              </span>
              <span className="reorder-btns">
                <button
                  className="icon-btn"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${meal.name} earlier`}
                >
                  <Icon name="up" />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === chosen.length - 1}
                  aria-label={`Move ${meal.name} later`}
                >
                  <Icon name="down" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="night-list">
          {chosen.map(({ meal, wm }, i) => {
            const r = myRating(meal.id);
            return (
              <li
                key={meal.id}
                className={`night ${wm.cooked_at ? "is-cooked" : ""}`}
              >
                <button
                  className="night-photo"
                  onClick={() => openMeal(meal.id, week.id)}
                  aria-label={`See details for ${meal.name}`}
                >
                  <Photo meal={meal} />
                  <span className="night-num">Night {i + 1}</span>
                </button>
                <div className="night-body">
                  <button
                    className="plain"
                    onClick={() => openMeal(meal.id, week.id)}
                  >
                    <h2>{meal.name}</h2>
                  </button>
                  <MealMeta meal={meal} />
                  <div className="night-actions">
                    {!wm.cooked_at ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => openCook(week.id, meal.id)}
                      >
                        <Icon name="play" size={18} filled /> Start cooking
                      </button>
                    ) : r ? (
                      <button
                        className="btn btn-ghost"
                        onClick={() => openRate(week.id, meal.id)}
                      >
                        <Stars value={r.stars} size={16} /> Edit rating
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => openRate(week.id, meal.id)}
                      >
                        Rate this dinner
                      </button>
                    )}
                    {wm.cooked_at ? (
                      <button
                        className="cooked-tag plain"
                        onClick={() =>
                          run(() => api.markCooked(week.id, meal.id, false))
                        }
                        title="Tap to mark as not cooked yet"
                      >
                        <Icon name="check" size={16} /> Cooked{" "}
                        {formatDate(wm.cooked_at, { weekday: "short" })}
                      </button>
                    ) : (
                      <button
                        className="link"
                        onClick={() =>
                          run(
                            () => api.markCooked(week.id, meal.id, true),
                            "Marked as cooked",
                          )
                        }
                      >
                        Already made it
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <HeroCard s={s} week={week} compact />

      {others.length > 0 && (
        <details className="also">
          <summary>Also on this week's menu ({others.length})</summary>
          <ul>
            {others.map(({ meal }) => (
              <li key={meal.id}>
                <button
                  className="plain row"
                  onClick={() => openMeal(meal.id, week.id)}
                >
                  <Photo meal={meal} className="thumb" />
                  <span>{meal.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
