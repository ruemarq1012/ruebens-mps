import { useRef, useState } from "react";
import { useApp } from "./context";
import { Avatar, Icon, Photo } from "./bits";
import {
  currentWeek,
  exportForClaude,
  parseMenu,
  weekMeals,
} from "../lib/util";
import type { MenuImport } from "../lib/types";

export function Kitchen() {
  const { s } = useApp();
  return s.me.role === "admin" ? <AdminKitchen /> : <Profile />;
}

function Head({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="page-head">
      <div className="wordmark">
        Rueben's <span>MPS</span>
      </div>
      <h1>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

function Profile() {
  const { s, api } = useApp();
  return (
    <>
      <Head title="Profile" />
      <section className="card profile">
        <Avatar s={s} email={s.me.email} size={56} />
        <div>
          <h2>{s.me.display_name}</h2>
          <p className="muted">{s.me.email}</p>
        </div>
      </section>
      <section className="card">
        <h3>Add the app to your home screen</h3>
        <p className="muted">
          On iPhone, open this page in Safari, tap <b>Share</b>, then{" "}
          <b>Add to Home Screen</b>. On Android, tap the menu and choose{" "}
          <b>Install app</b>.
        </p>
      </section>
      <button className="btn btn-block" onClick={() => api.signOut()}>
        Sign out
      </button>
    </>
  );
}

function AdminKitchen() {
  const { s, api, run, toast } = useApp();
  const week = currentWeek(s);
  const [copied, setCopied] = useState(false);

  async function copyExport() {
    const text = exportForClaude(s);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copied. Paste it to Claude.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast(
        "Your browser blocked copying. Long-press the text below to copy it.",
      );
      setCopied(true);
    }
  }

  const status = !week
    ? "No menu loaded yet."
    : week.status === "picking"
      ? `${week.label} is open for picks.`
      : `${week.label} is locked in. The grocery list is live.`;

  return (
    <>
      <Head title="Kitchen" lede={status} />

      <section className="card">
        <h3 className="h-icon">
          <Icon name="copy" size={20} /> Send picks and ratings to Claude
        </h3>
        <p className="muted">
          Copies this week's picks, requests, ratings and favorites, ready to
          paste into your chat with Claude.
        </p>
        <button className="btn btn-primary" onClick={copyExport}>
          {copied ? "Copied" : "Copy for Claude"}
        </button>
        {copied && (
          <textarea
            className="export"
            readOnly
            rows={6}
            value={exportForClaude(s)}
          />
        )}
      </section>

      <LoadMenu />

      {week && (
        <section className="card">
          <h3>This week</h3>
          {week.status === "picking" ? (
            <p className="muted">
              Lock in the final four from the This week tab once you've both
              picked.
            </p>
          ) : (
            <>
              <p className="muted">
                Need to change the lineup? Reopening clears the grocery list and
                lets you both pick again.
              </p>
              <button
                className="btn"
                onClick={() => {
                  if (
                    confirmAction(
                      "Reopen picking? This clears the grocery list and anything marked as cooked this week.",
                    )
                  )
                    run(() => api.reopenWeek(week.id), "Picking is open again");
                }}
              >
                Reopen picking
              </button>
              <ReplaceGroceries weekId={week.id} />
            </>
          )}
        </section>
      )}

      {week && <Photos weekId={week.id} />}

      <Household />

      <button className="btn btn-block" onClick={() => api.signOut()}>
        Sign out
      </button>
    </>
  );
}

function confirmAction(msg: string) {
  // A native confirm keeps this simple and works in the installed app.
  return window.confirm(msg);
}

function LoadMenu() {
  const { api, run } = useApp();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<MenuImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function check(t: string) {
    setText(t);
    if (!t.trim()) {
      setPreview(null);
      setError(null);
      return;
    }
    const { menu, error } = parseMenu(t);
    setPreview(menu ?? null);
    setError(error ?? null);
  }

  return (
    <section className="card">
      <h3 className="h-icon">
        <Icon name="menu" size={20} /> Load a new week
      </h3>
      <p className="muted">
        Paste the menu block Claude gives you, or choose the .json file.
      </p>
      <textarea
        rows={4}
        placeholder='{"week": {"label": "Week of Nov 8", ...'
        value={text}
        onChange={(e) => check(e.target.value)}
      />
      <div className="row">
        <button
          className="btn btn-small"
          onClick={() => fileRef.current?.click()}
        >
          Choose file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) check(await f.text());
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {preview && (
        <div className="preview">
          <p>
            <b>{preview.week.label}</b>: {preview.meals.length} meals
            {preview.chosen?.length
              ? `, ${preview.chosen.length} already locked in`
              : ""}
          </p>
          <ul>
            {preview.meals.map((m) => (
              <li key={m.slug}>{m.name}</li>
            ))}
          </ul>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (
                await run(
                  () => api.loadWeek(preview),
                  `${preview.week.label} is live`,
                )
              )
                check("");
            }}
          >
            Publish {preview.week.label}
          </button>
        </div>
      )}
    </section>
  );
}

function ReplaceGroceries({ weekId }: { weekId: string }) {
  const { api, run } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        Replace the grocery list with one from Claude
      </button>
    );
  return (
    <div className="preview">
      <textarea
        rows={4}
        placeholder='{"groceries": [ ... ]}'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-small"
        onClick={async () => {
          try {
            const data = JSON.parse(text);
            const items = Array.isArray(data) ? data : data.groceries;
            if (!Array.isArray(items)) throw new Error();
            if (
              await run(
                () => api.setGroceries(weekId, items),
                "Grocery list replaced",
              )
            ) {
              setOpen(false);
              setText("");
            }
          } catch {
            setError(
              "Paste the grocery block from Claude, including the outer { }.",
            );
          }
        }}
      >
        Replace list
      </button>
    </div>
  );
}

function Photos({ weekId }: { weekId: string }) {
  const { s, api, run } = useApp();
  const list = weekMeals(s, weekId);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <section className="card">
      <h3 className="h-icon">
        <Icon name="camera" size={20} /> Meal photos
      </h3>
      <p className="muted">
        Swap in your own photo of what you cooked. It shows up for both of you.
      </p>
      <ul className="photo-list">
        {list.map(({ meal }) => (
          <li key={meal.id}>
            <Photo meal={meal} className="thumb" />
            <span>{meal.name}</span>
            <label className="btn btn-small">
              {busy === meal.id ? "Uploading…" : "Change"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(meal.id);
                  await run(() => api.uploadPhoto(meal.id, f), "Photo updated");
                  setBusy(null);
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Household() {
  const { s, api, run } = useApp();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <section className="card">
      <h3 className="h-icon">
        <Icon name="people" size={20} /> Household
      </h3>
      <ul className="member-list">
        {s.members.map((m) => (
          <li key={m.email}>
            <Avatar s={s} email={m.email} size={32} />
            <span>
              <b>{m.display_name}</b>
              <small className="muted">
                {m.email}
                {m.role === "admin" ? ", kitchen admin" : ""}
              </small>
            </span>
            {m.email !== s.me.email && (
              <button
                className="link danger"
                onClick={() => {
                  if (
                    confirmAction(
                      `Remove ${m.display_name}? Their picks and ratings will be deleted.`,
                    )
                  )
                    run(
                      () => api.removeMember(m.email),
                      `${m.display_name} removed`,
                    );
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="form inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () =>
                api.addMember({
                  email,
                  display_name: name.trim(),
                  role: "member",
                }),
              `${name.trim()} can sign in now`,
            )
          ) {
            setEmail("");
            setName("");
          }
        }}
      >
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-label="Name"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Email"
        />
        <button className="btn btn-small">Add person</button>
      </form>
    </section>
  );
}
