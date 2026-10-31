import { useEffect, useState } from "react";
import { useApp } from "./context";
import { Icon, MealMeta } from "./bits";

/** Full-screen recipe view: big steps, tick-off ingredients, screen stays on. */
export function CookMode({
  weekId,
  mealId,
  onClose,
}: {
  weekId: string;
  mealId: string;
  onClose: () => void;
}) {
  const { s, api, run, openRate } = useApp();
  const meal = s.meals.find((m) => m.id === mealId);
  const storeKey = `mps-cook-${weekId}-${mealId}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || "{}");
    } catch {
      return {};
    }
  });
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(done));
    } catch {
      /* ignore */
    }
  }, [done, storeKey]);

  // Keep the screen on while cooking, where the phone supports it.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
        setAwake(!!lock);
      } catch {
        setAwake(false);
      }
    };
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
      document.body.style.overflow = "";
    };
  }, []);

  if (!meal) return null;
  const toggle = (k: string) => setDone((d) => ({ ...d, [k]: !d[k] }));
  const stepsDone = meal.steps.filter((_, i) => done[`s${i}`]).length;

  return (
    <div
      className="cook"
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${meal.name}`}
    >
      <header className="cook-head">
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Leave cook mode"
        >
          <Icon name="back" />
        </button>
        <div>
          <h1>{meal.name}</h1>
          <MealMeta meal={meal} />
        </div>
      </header>

      <div className="cook-scroll">
        {awake && (
          <p className="fineprint">
            Your screen will stay on while this is open.
          </p>
        )}

        <section>
          <h2>Get it ready</h2>
          {meal.ingredients.map((g, gi) => (
            <div key={gi} className="cook-group">
              {g.group && <h3>{g.group}</h3>}
              <ul className="tick-list">
                {g.items.map((it, ii) => {
                  const k = `i${gi}-${ii}`;
                  return (
                    <li key={k}>
                      <label className={done[k] ? "done" : ""}>
                        <input
                          type="checkbox"
                          checked={!!done[k]}
                          onChange={() => toggle(k)}
                        />
                        <span>{it}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2>
            Cook it{" "}
            <span className="muted small">
              {stepsDone} of {meal.steps.length} done
            </span>
          </h2>
          <ol className="cook-steps">
            {meal.steps.map((st, i) => {
              const k = `s${i}`;
              return (
                <li key={k}>
                  <button
                    className={done[k] ? "done" : ""}
                    onClick={() => toggle(k)}
                    aria-pressed={!!done[k]}
                  >
                    <span className="step-num">
                      {done[k] ? <Icon name="check" size={20} /> : i + 1}
                    </span>
                    <span>{st}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {meal.on_the_side && (
          <p className="side-note">
            <Icon name="chili" size={18} />
            <span>
              <b>Spice on the side:</b> {meal.on_the_side}
            </span>
          </p>
        )}
        {meal.leftovers && (
          <p className="side-note">
            <Icon name="leftovers" size={18} />
            <span>
              <b>Leftovers:</b> {meal.leftovers}
            </span>
          </p>
        )}
        {meal.source_url && (
          <p className="source">
            <Icon name="link" size={16} />
            <a href={meal.source_url} target="_blank" rel="noreferrer">
              Original recipe from {meal.source_name ?? "the web"}
            </a>
          </p>
        )}
      </div>

      <footer className="cook-foot">
        <button
          className="btn btn-primary btn-block"
          onClick={async () => {
            if (await run(() => api.markCooked(weekId, mealId, true))) {
              try {
                localStorage.removeItem(storeKey);
              } catch {
                /* ignore */
              }
              openRate(weekId, mealId);
            }
          }}
        >
          Done cooking, rate it
        </button>
      </footer>
    </div>
  );
}
