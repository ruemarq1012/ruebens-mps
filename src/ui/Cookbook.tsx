import { useState } from "react";
import { useApp } from "./context";
import { Avatar, Empty, Icon, Photo, Stars } from "./bits";

type Filter = "favorites" | "made" | "untried";

export function Cookbook() {
  const { s, openMeal, openRate } = useApp();
  const [filter, setFilter] = useState<Filter>(() =>
    s.favorites.length ? "favorites" : "made",
  );

  const doneWeeks = new Set(
    s.weeks.filter((w) => w.status === "done").map((w) => w.id),
  );
  const madeIds = new Set(
    s.weekMeals
      .filter((w) => w.cooked_at || (w.chosen && doneWeeks.has(w.week_id)))
      .map((w) => w.meal_id),
  );
  const favIds = new Set(s.favorites.map((f) => f.meal_id));

  const rows = s.meals
    .filter((m) =>
      filter === "favorites"
        ? favIds.has(m.id)
        : filter === "made"
          ? madeIds.has(m.id)
          : !madeIds.has(m.id),
    )
    .map((m) => {
      const rs = s.ratings.filter((r) => r.meal_id === m.id);
      const avg = rs.length
        ? rs.reduce((a, r) => a + r.stars, 0) / rs.length
        : 0;
      const times = s.weekMeals.filter(
        (w) => w.meal_id === m.id && w.cooked_at,
      ).length;
      const cookedNotRated = s.weekMeals.find(
        (w) =>
          w.meal_id === m.id &&
          w.cooked_at &&
          !rs.some(
            (r) => r.week_id === w.week_id && r.member_email === s.me.email,
          ),
      );
      return { m, rs, avg, times, cookedNotRated };
    })
    .sort((a, b) => b.avg - a.avg || a.m.name.localeCompare(b.m.name));

  const counts = {
    favorites: favIds.size,
    made: madeIds.size,
    untried: s.meals.length - madeIds.size,
  };

  return (
    <>
      <header className="page-head">
        <div className="wordmark">
          Rueben's <span>MPS</span>
        </div>
        <h1>Cookbook</h1>
        <p className="lede">
          Every dinner you've tried, with both of your ratings, so the winners
          come back.
        </p>
      </header>

      <div className="segmented tabs" role="tablist">
        {(
          [
            ["favorites", "Favorites"],
            ["made", "We've made"],
            ["untried", "Not tried yet"],
          ] as Array<[Filter, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "on" : ""}
            onClick={() => setFilter(id)}
          >
            {label} <span className="count">{counts[id]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty
          title={
            filter === "favorites"
              ? "No favorites yet"
              : filter === "made"
                ? "Nothing cooked yet"
                : "You’ve tried everything"
          }
        >
          <p>
            {filter === "favorites"
              ? "Tap the heart on any meal, or when you rate a dinner, to keep it here."
              : filter === "made"
                ? "Meals show up here once they are locked in for a week."
                : "Every meal offered so far has made it onto the table."}
          </p>
        </Empty>
      ) : (
        <ul className="book-list">
          {rows.map(({ m, rs, avg, times, cookedNotRated }) => (
            <li key={m.id}>
              <button className="book-row" onClick={() => openMeal(m.id)}>
                <Photo meal={m} className="thumb-lg" />
                <span className="book-info">
                  <span className="book-name">
                    {m.name}
                    {favIds.has(m.id) && <Icon name="heart" size={16} filled />}
                  </span>
                  <span className="muted small">
                    {m.cook_minutes} min
                    {times
                      ? `, made ${times === 1 ? "once" : `${times} times`}`
                      : ""}
                  </span>
                  {rs.length > 0 ? (
                    <span className="book-ratings">
                      {s.members.map((mem) => {
                        const latest = rs
                          .filter((r) => r.member_email === mem.email)
                          .sort((a, b) =>
                            b.updated_at.localeCompare(a.updated_at),
                          )[0];
                        return latest ? (
                          <span key={mem.email} className="who-rated">
                            <Avatar s={s} email={mem.email} size={20} />
                            <Stars value={latest.stars} size={13} />
                          </span>
                        ) : null;
                      })}
                      <span className="muted small">
                        {avg.toFixed(1)} average
                      </span>
                    </span>
                  ) : (
                    <span className="muted small">No ratings yet</span>
                  )}
                </span>
              </button>
              {cookedNotRated && (
                <button
                  className="btn btn-small"
                  onClick={() => openRate(cookedNotRated.week_id, m.id)}
                >
                  Rate
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
