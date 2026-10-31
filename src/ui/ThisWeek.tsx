import { useEffect, useMemo, useState } from "react";
import { useApp } from "./context";
import { Avatar, Empty, Icon, MealMeta, Photo, Sheet, Stars } from "./bits";
import { currentWeek, firstName, formatDate, weekMeals } from "../lib/util";
import type { Meal, Snapshot, Week } from "../lib/types";

export function ThisWeek() {
  const { s } = useApp();
  const week = currentWeek(s);
  if (!week)
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
  return week.status === "picking" ? (
    <Picking week={week} />
  ) : (
    <Locked week={week} />
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

function pickersOf(s: Snapshot, mealId: string) {
  return s.picks.filter((p) => p.meal_id === mealId).map((p) => p.member_email);
}

/* ---------------- Picking ---------------- */

function Picking({ week }: { week: Week }) {
  const { s, api, patch, run, openMeal } = useApp();
  const [lockOpen, setLockOpen] = useState(false);
  const list = weekMeals(s, week.id);
  const admin = s.members.find((m) => m.role === "admin");
  const myPicks = s.picks.filter((p) => p.member_email === s.me.email).length;

  function toggle(meal: Meal, on: boolean) {
    patch((cur) => ({
      ...cur,
      picks: on
        ? [
            ...cur.picks,
            { week_id: week.id, meal_id: meal.id, member_email: cur.me.email },
          ]
        : cur.picks.filter(
            (p) => !(p.meal_id === meal.id && p.member_email === cur.me.email),
          ),
    }));
    run(() => api.setPick(week.id, meal.id, on));
  }

  return (
    <>
      <Header title={week.label}>
        <p className="lede">
          Pick the dinners you'd like this week.{" "}
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
            const n = s.picks.filter((p) => p.member_email === m.email).length;
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

      <div className="meal-list">
        {list.map(({ meal }) => {
          const pickers = pickersOf(s, meal.id);
          const mine = pickers.includes(s.me.email);
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
            Lock in this week's 4 meals
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
  const saved = s.notes.find((n) => n.member_email === s.me.email)?.body ?? "";
  const [body, setBody] = useState(saved);
  useEffect(() => setBody(saved), [saved]);
  const others = s.notes.filter(
    (n) => n.member_email !== s.me.email && n.body.trim(),
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
      .map((x) => ({ ...x, votes: pickersOf(s, x.meal.id).length }))
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

  return (
    <Sheet open={open} onClose={onClose} label="Lock in meals">
      <h2>Lock in the week</h2>
      <p className="muted">
        The most-picked meals are selected. Locking builds the grocery list for
        both of you.
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
          )
            onClose();
        }}
      >
        Lock in {sel.length} meal{sel.length === 1 ? "" : "s"}
      </button>
    </Sheet>
  );
}

/* ---------------- Locked ---------------- */

function Locked({ week }: { week: Week }) {
  const { s, openMeal, openCook, openRate, go } = useApp();
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

  return (
    <>
      <Header title={week.label}>
        <p className="lede">
          Your four dinners, in the order to cook them. Seafood goes first while
          it's freshest.
        </p>
      </Header>

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
                <span className="night-num">
                  Night {wm.cook_order ?? i + 1}
                </span>
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
                  {wm.cooked_at && (
                    <span className="cooked-tag">
                      <Icon name="check" size={16} /> Cooked{" "}
                      {formatDate(wm.cooked_at, { weekday: "short" })}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

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
