import { useState } from "react";
import { useApp } from "./context";
import { Icon, Sheet } from "./bits";
import { formatQty } from "../lib/util";
import type { GroceryItem, Week } from "../lib/types";

const searchUrl = (name: string) =>
  `https://www.instacart.com/store/s?k=${encodeURIComponent(name)}`;

/** "Order with Instacart": connect once, then send the week's list to Instacart. */
export function InstacartCard({
  week,
  items,
}: {
  week: Week;
  items: GroceryItem[];
}) {
  const { s, api, run } = useApp();
  const mine = s.settings.find((x) => x.member_email === s.me.email);
  const connected = !!mine?.instacart_connected_at;
  const [connectOpen, setConnectOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  return (
    <section className="instacart-card">
      <div className="ic-head">
        <span className="ic-logo" aria-hidden="true">
          <Icon name="cart" size={20} />
        </span>
        <div>
          <h3>Order with Instacart</h3>
          <p className="small">
            {connected
              ? "Send this week's list to Instacart and pick a store and delivery time there."
              : "Skip the store: send this list to Instacart for delivery or pickup."}
          </p>
        </div>
      </div>
      {connected ? (
        <div className="row">
          <button className="btn btn-ic" onClick={() => setOrderOpen(true)}>
            Send list to Instacart
          </button>
          <button
            className="link"
            onClick={() =>
              run(() => api.setInstacart(false, null), "Instacart disconnected")
            }
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button className="btn btn-ic" onClick={() => setConnectOpen(true)}>
          Connect Instacart
        </button>
      )}

      <Sheet
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        label="Connect Instacart"
      >
        {connectOpen && (
          <ConnectForm
            zip={mine?.instacart_zip ?? ""}
            onDone={() => {
              setConnectOpen(false);
              setOrderOpen(true);
            }}
          />
        )}
      </Sheet>
      <Sheet
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        label="Send list to Instacart"
        tall
      >
        {orderOpen && (
          <OrderForm
            week={week}
            items={items}
            onDone={() => setOrderOpen(false)}
          />
        )}
      </Sheet>
    </section>
  );
}

function ConnectForm({ zip, onDone }: { zip: string; onDone: () => void }) {
  const { api, run } = useApp();
  const [z, setZ] = useState(zip);
  return (
    <div className="ic-connect">
      <h2>Connect Instacart</h2>
      <ol className="ic-steps">
        <li>
          <b>Choose what to order.</b> Your grocery list is already sorted;
          leave out anything you have.
        </li>
        <li>
          <b>Send it to Instacart.</b> It opens with every item searched and
          ready to add to a cart.
        </li>
        <li>
          <b>Check out on Instacart.</b> Sign in or create a free account, pick
          a store, then delivery or pickup. Payment happens on Instacart, never
          in this app.
        </li>
      </ol>
      <label className="field">
        <span>ZIP code (optional, helps pick nearby stores)</span>
        <input
          inputMode="numeric"
          maxLength={5}
          value={z}
          onChange={(e) => setZ(e.target.value.replace(/\D/g, ""))}
          placeholder="22201"
        />
      </label>
      <button
        className="btn btn-ic btn-block"
        onClick={async () => {
          if (
            await run(
              () => api.setInstacart(true, z || null),
              "Instacart connected",
            )
          )
            onDone();
        }}
      >
        Connect
      </button>
    </div>
  );
}

function OrderForm({
  week,
  items,
  onDone,
}: {
  week: Week;
  items: GroceryItem[];
  onDone: () => void;
}) {
  const { api, run, toast } = useApp();
  // Default: everything still to buy. Pantry staples start unticked.
  const [sel, setSel] = useState<Set<string>>(
    () =>
      new Set(items.filter((i) => !i.checked && !i.pantry).map((i) => i.id)),
  );
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<GroceryItem[] | null>(null);
  const toggle = (id: string) =>
    setSel((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const chosen = items.filter((i) => sel.has(i.id));

  if (fallback)
    return (
      <div className="ic-order">
        <h2>Shop these on Instacart</h2>
        <p className="muted small">
          One-tap lists aren't switched on yet, so each item opens its own
          Instacart search. Add them to your cart as you go.
        </p>
        <ul className="ic-links">
          {fallback.map((i) => (
            <li key={i.id}>
              <a href={searchUrl(i.name)} target="_blank" rel="noreferrer">
                <span>
                  {i.name}
                  <small>{formatQty(i.qty, i.unit)}</small>
                </span>
                <Icon name="link" size={18} />
              </a>
            </li>
          ))}
        </ul>
        <MarkInCart ids={fallback.map((i) => i.id)} onDone={onDone} />
      </div>
    );

  const sendable = [...items].sort(
    (a, b) => Number(a.pantry) - Number(b.pantry),
  );
  return (
    <div className="ic-order">
      <h2>Send list to Instacart</h2>
      <p className="muted small">
        Untick anything you already have. Pantry staples are left off unless you
        tick them.
      </p>
      <ul className="g-list ic-pick">
        {sendable.map((i) => (
          <li key={i.id} className={i.checked ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={sel.has(i.id)}
                onChange={() => toggle(i.id)}
              />
              <span className="g-main">
                <span className="g-name">{i.name}</span>
                {(i.qty != null || i.unit) && (
                  <span className="g-qty">{formatQty(i.qty, i.unit)}</span>
                )}
                <span className="g-for">
                  {i.pantry ? "Pantry staple" : i.section}
                  {i.checked ? ", already in the cart" : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="sheet-cta">
        <button
          className="btn btn-ic btn-block"
          disabled={busy || chosen.length === 0}
          onClick={async () => {
            setBusy(true);
            let url: string | null = null;
            const ok = await run(async () => {
              url = await api.instacartLink(
                `Rueben's MPS: ${week.label}`,
                chosen.map((i) => ({
                  name: i.name,
                  display: [i.name, formatQty(i.qty, i.unit)]
                    .filter(Boolean)
                    .join(", "),
                })),
              );
            });
            setBusy(false);
            if (!ok) return;
            if (url) {
              window.open(url, "_blank", "noopener");
              toast("Opened your list on Instacart");
              setFallback(null);
              onDone();
            } else setFallback(chosen);
          }}
        >
          {busy
            ? "Sending…"
            : `Send ${chosen.length} item${chosen.length === 1 ? "" : "s"} to Instacart`}
        </button>
      </div>
    </div>
  );
}

function MarkInCart({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { api, run } = useApp();
  return (
    <button
      className="btn btn-block"
      onClick={async () => {
        await run(
          () => Promise.all(ids.map((id) => api.setChecked(id, true))),
          "Ticked off on the grocery list",
        );
        onDone();
      }}
    >
      Done: tick these off the list
    </button>
  );
}
