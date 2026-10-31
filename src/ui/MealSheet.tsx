import { useApp } from "./context";
import { Avatar, Icon, MealMeta, Photo, Sheet, Stars } from "./bits";
import { currentWeek, firstName, hasRecipe } from "../lib/util";

export function MealSheet({
  state,
  onClose,
}: {
  state: { mealId: string; weekId?: string } | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!state} onClose={onClose} label="Meal details" tall>
      {state && (
        <MealDetail
          mealId={state.mealId}
          weekId={state.weekId}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function MealDetail({
  mealId,
  weekId,
  onClose,
}: {
  mealId: string;
  weekId?: string;
  onClose: () => void;
}) {
  const { s, api, run, patch, openCook } = useApp();
  const meal = s.meals.find((m) => m.id === mealId);
  if (!meal) return null;
  const week = currentWeek(s);
  const wm =
    week &&
    s.weekMeals.find((w) => w.week_id === week.id && w.meal_id === meal.id);
  const isCurrent = !!wm && (!weekId || weekId === week?.id);
  const picking = isCurrent && week?.status === "picking";
  const mine = s.picks.some(
    (p) => p.meal_id === meal.id && p.member_email === s.me.email,
  );
  const fav = s.favorites.some(
    (f) => f.meal_id === meal.id && f.member_email === s.me.email,
  );
  const favBy = s.favorites
    .filter((f) => f.meal_id === meal.id)
    .map((f) => f.member_email);
  const ratings = s.ratings
    .filter((r) => r.meal_id === meal.id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const setFav = (on: boolean) => {
    patch((cur) => ({
      ...cur,
      favorites: on
        ? [...cur.favorites, { meal_id: meal.id, member_email: cur.me.email }]
        : cur.favorites.filter(
            (f) => !(f.meal_id === meal.id && f.member_email === cur.me.email),
          ),
    }));
    run(
      () => api.setFavorite(meal.id, on),
      on ? "Saved to favorites" : "Removed from favorites",
    );
  };

  return (
    <article className="detail">
      <div className="detail-photo">
        <Photo meal={meal} />
        {picking && (
          <button
            className={`sticker pick-sticker ${mine ? "on" : ""}`}
            aria-pressed={mine}
            onClick={() => {
              patch((cur) => ({
                ...cur,
                picks: mine
                  ? cur.picks.filter(
                      (p) =>
                        !(
                          p.meal_id === meal.id &&
                          p.member_email === cur.me.email
                        ),
                    )
                  : [
                      ...cur.picks,
                      {
                        week_id: week!.id,
                        meal_id: meal.id,
                        member_email: cur.me.email,
                      },
                    ],
              }));
              run(() => api.setPick(week!.id, meal.id, !mine));
            }}
          >
            {mine ? <Icon name="check" size={30} /> : "Pick"}
          </button>
        )}
      </div>

      <div className="detail-body">
        <div className="row-between">
          <h2 className="detail-title">{meal.name}</h2>
          <button
            className={`heart ${fav ? "on" : ""}`}
            aria-pressed={fav}
            aria-label={fav ? "Remove from favorites" : "Save to favorites"}
            onClick={() => setFav(!fav)}
          >
            <Icon name="heart" size={26} filled={fav} />
          </button>
        </div>
        <MealMeta meal={meal} />
        {favBy.length > 0 && (
          <p className="picked-by">
            {favBy.map((e) => (
              <Avatar key={e} s={s} email={e} size={20} />
            ))}
            <span>
              {favBy
                .map((e) => (e === s.me.email ? "You" : firstName(s, e)))
                .join(" and ")}{" "}
              saved this as a favorite
            </span>
          </p>
        )}
        <p className="detail-desc">{meal.description}</p>

        {meal.included.length > 0 && (
          <section>
            <h3 className="h-icon">
              <Icon name="box" size={18} /> What's included
            </h3>
            <ul className="chips">
              {meal.included.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        )}

        {meal.on_the_side && (
          <p className="side-note">
            <Icon name="chili" size={18} />
            <span>
              <b>Spice on the side:</b> {meal.on_the_side}
            </span>
          </p>
        )}

        {isCurrent && wm?.chosen && !wm.cooked_at && hasRecipe(meal) && (
          <button
            className="btn btn-primary btn-block"
            onClick={() => openCook(week!.id, meal.id)}
          >
            <Icon name="play" size={18} filled /> Start cooking
          </button>
        )}

        {hasRecipe(meal) ? (
          <section className="recipe">
            <h3>Ingredients</h3>
            {meal.ingredients.map((g, i) => (
              <div key={i}>
                {g.group && <h4>{g.group}</h4>}
                <ul>
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
            <h3>Steps</h3>
            <ol className="steps">
              {meal.steps.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ol>
            {meal.leftovers && (
              <p className="side-note">
                <Icon name="leftovers" size={18} />
                <span>
                  <b>Leftovers:</b> {meal.leftovers}
                </span>
              </p>
            )}
          </section>
        ) : (
          <p className="muted">
            The full recipe and shopping list arrive if this meal gets locked
            in.
          </p>
        )}

        {(meal.source_url || meal.source_name) && (
          <p className="source">
            <Icon name="link" size={16} />
            {meal.source_url ? (
              <a href={meal.source_url} target="_blank" rel="noreferrer">
                Original recipe from {meal.source_name ?? "the web"}
              </a>
            ) : (
              <span>Recipe by {meal.source_name}</span>
            )}
          </p>
        )}

        {ratings.length > 0 && (
          <section>
            <h3>What you thought</h3>
            <ul className="rating-list">
              {ratings.map((r) => (
                <li key={`${r.week_id}-${r.member_email}`}>
                  <Avatar s={s} email={r.member_email} size={28} />
                  <div>
                    <p>
                      <Stars value={r.stars} size={15} />{" "}
                      <span className="muted small">
                        {s.weeks.find((w) => w.id === r.week_id)?.label}
                        {r.make_again === true
                          ? ", would make again"
                          : r.make_again === false
                            ? ", skip next time"
                            : ""}
                      </span>
                    </p>
                    {r.comment && <p className="comment">{r.comment}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <button className="btn btn-block detail-done" onClick={onClose}>
          Back
        </button>
        {meal.image_credit && <p className="credit">{meal.image_credit}</p>}
      </div>
    </article>
  );
}
