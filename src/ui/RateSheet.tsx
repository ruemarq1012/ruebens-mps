import { useEffect, useState } from "react";
import { useApp } from "./context";
import { Icon, Photo, Sheet, Stars } from "./bits";

const STAR_WORDS = [
  "",
  "Not for us",
  "It was okay",
  "Pretty good",
  "Really good",
  "Make this again soon",
];

export function RateSheet({
  state,
  onClose,
}: {
  state: { weekId: string; mealId: string } | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!state} onClose={onClose} label="Rate this dinner">
      {state && <RateForm {...state} onDone={onClose} />}
    </Sheet>
  );
}

function RateForm({
  weekId,
  mealId,
  onDone,
}: {
  weekId: string;
  mealId: string;
  onDone: () => void;
}) {
  const { s, api, run } = useApp();
  const meal = s.meals.find((m) => m.id === mealId);
  const existing = s.ratings.find(
    (r) =>
      r.week_id === weekId &&
      r.meal_id === mealId &&
      r.member_email === s.me.email,
  );
  const isFav = s.favorites.some(
    (f) => f.meal_id === mealId && f.member_email === s.me.email,
  );
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [again, setAgain] = useState<boolean | null>(
    existing?.make_again ?? null,
  );
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [fav, setFav] = useState(isFav);
  useEffect(() => {
    if (stars === 5 && again === null) setAgain(true);
  }, [stars]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!meal) return null;

  async function save() {
    const ok = await run(async () => {
      await api.saveRating({
        week_id: weekId,
        meal_id: mealId,
        stars,
        make_again: again,
        comment: comment.trim() || null,
      });
      if (fav !== isFav) await api.setFavorite(mealId, fav);
    }, "Rating saved");
    if (ok) onDone();
  }

  return (
    <div className="rate">
      <div className="rate-head">
        <Photo meal={meal} className="thumb-lg" />
        <h2>How was the {meal.name.toLowerCase()}?</h2>
      </div>

      <div className="rate-stars">
        <Stars value={stars} onChange={setStars} size={40} />
        <p className="muted">{STAR_WORDS[stars] || "Tap a star"}</p>
      </div>

      <fieldset className="segmented">
        <legend>Would you make it again?</legend>
        <div className="seg-buttons">
          <button
            type="button"
            className={again === true ? "on" : ""}
            aria-pressed={again === true}
            onClick={() => setAgain(true)}
          >
            Yes, again
          </button>
          <button
            type="button"
            className={again === false ? "on" : ""}
            aria-pressed={again === false}
            onClick={() => setAgain(false)}
          >
            Skip it
          </button>
        </div>
      </fieldset>

      <label className="field">
        <span>Anything to remember? (optional)</span>
        <textarea
          rows={3}
          placeholder="Needed more sauce, great for lunch the next day…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      <label className="toggle-row">
        <span>
          <Icon name="heart" size={20} filled={fav} /> Save to favorites
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={fav}
          onChange={(e) => setFav(e.target.checked)}
        />
      </label>

      <button
        className="btn btn-primary btn-block"
        disabled={stars === 0}
        onClick={save}
      >
        Save rating
      </button>
    </div>
  );
}
