import { useState } from "react";
import { useApp } from "./context";
import { Avatar, Empty } from "./bits";
import { currentWeek, formatQty, sectionRank } from "../lib/util";
import type { GroceryItem } from "../lib/types";

export function Groceries() {
  const { s, api, patch, run } = useApp();
  const [hideDone, setHideDone] = useState(() => {
    try {
      return localStorage.getItem("mps-hide-done") === "1";
    } catch {
      return false;
    }
  });
  const week = currentWeek(s);
  const items = s.groceries;

  const head = (
    <header className="page-head">
      <div className="wordmark">
        Rueben's <span>MPS</span>
      </div>
      <h1>Groceries</h1>
    </header>
  );

  if (!week || items.length === 0)
    return (
      <>
        {head}
        <Empty title="No list yet">
          <p>
            The grocery list builds itself as soon as this week's four meals are
            locked in.
          </p>
        </Empty>
      </>
    );

  const shop = items.filter((i) => !i.pantry);
  const pantry = items.filter((i) => i.pantry);
  const doneCount = shop.filter((i) => i.checked).length;
  const sections = [...new Set(shop.map((i) => i.section))].sort(
    (a, b) => sectionRank(a) - sectionRank(b),
  );

  function toggle(item: GroceryItem) {
    const checked = !item.checked;
    patch((cur) => ({
      ...cur,
      groceries: cur.groceries.map((g) =>
        g.id === item.id
          ? { ...g, checked, checked_by: checked ? cur.me.email : null }
          : g,
      ),
    }));
    run(() => api.setChecked(item.id, checked));
  }

  const setHide = (v: boolean) => {
    setHideDone(v);
    try {
      localStorage.setItem("mps-hide-done", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const Row = ({ item }: { item: GroceryItem }) => (
    <li className={item.checked ? "done" : ""}>
      <label>
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => toggle(item)}
        />
        <span className="g-main">
          <span className="g-name">{item.name}</span>
          {(item.qty != null || item.unit) && (
            <span className="g-qty">{formatQty(item.qty, item.unit)}</span>
          )}
          <span className="g-for">
            {item.note ? `${item.note}. ` : ""}For {item.meals.join(", ")}
          </span>
        </span>
        {item.checked && item.checked_by && (
          <Avatar s={s} email={item.checked_by} size={22} />
        )}
      </label>
    </li>
  );

  return (
    <>
      {head}
      <div className="progress-wrap">
        <p>
          <b>{doneCount}</b> of {shop.length} in the cart for{" "}
          {week.label.replace(/^Week of /, "the week of ")}
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={shop.length}
          aria-valuenow={doneCount}
        >
          <span
            style={{
              width: `${(doneCount / Math.max(1, shop.length)) * 100}%`,
            }}
          />
        </div>
        <label className="toggle-row small">
          <span>Hide items in the cart</span>
          <input
            type="checkbox"
            role="switch"
            checked={hideDone}
            onChange={(e) => setHide(e.target.checked)}
          />
        </label>
      </div>

      {pantry.length > 0 && (
        <details className="g-section pantry">
          <summary>
            <div>
              <h2>Check your pantry first</h2>
              <span className="muted small">
                {pantry.filter((p) => !p.checked).length} staples to check. Tick
                what you have; buy the rest.
              </span>
            </div>
            <span className="summary-toggle" aria-hidden="true" />
          </summary>
          <ul className="g-list">
            {pantry
              .filter((i) => !(hideDone && i.checked))
              .map((i) => (
                <Row key={i.id} item={i} />
              ))}
          </ul>
        </details>
      )}

      {sections.map((sec) => {
        const list = shop.filter(
          (i) => i.section === sec && !(hideDone && i.checked),
        );
        if (!list.length) return null;
        return (
          <section className="g-section" key={sec}>
            <h2>{sec}</h2>
            <ul className="g-list">
              {list.map((i) => (
                <Row key={i.id} item={i} />
              ))}
            </ul>
          </section>
        );
      })}
      {doneCount === shop.length && (
        <p className="center muted">Everything's in the cart.</p>
      )}
    </>
  );
}
