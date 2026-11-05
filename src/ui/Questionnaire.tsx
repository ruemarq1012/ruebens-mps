import { useState } from "react";
import { useApp } from "./context";
import { Avatar, Sheet } from "./bits";
import type { QuestionnaireAnswers, Week } from "../lib/types";

const CUISINES = [
  "Mexican",
  "Italian",
  "Asian",
  "Mediterranean",
  "American comfort",
  "Surprise us",
];
const PROTEINS = [
  "Beef",
  "Pork",
  "Shrimp",
  "Salmon or fish",
  "Chicken",
  "Vegetarian",
];
const FLAVOR = ["Bold and saucy", "Balanced", "Simple and comforting"];
const ADVENTURE = ["Teach us something new", "Keep it familiar"];
const NEW_INGREDIENT = [
  "Happy to buy one new sauce or spice if we'll use it twice",
  "Only things we already have",
];

/** Card on the cooking week that asks both people how to shape next week's menu. */
export function QuestionnaireCard({ week }: { week: Week }) {
  const { s } = useApp();
  const [open, setOpen] = useState(false);
  const mine = s.questionnaires.find(
    (q) => q.week_id === week.id && q.member_email === s.me.email,
  );
  const done = s.questionnaires.filter((q) => q.week_id === week.id);
  return (
    <section className="card quiz-card">
      <h3>Help plan next week's menu</h3>
      <p className="muted small">
        Five quick taps on what you're in the mood for. Claude reads both of
        your answers before writing the next menu.
      </p>
      <p className="picked-by quiz-who">
        {s.members.map((m) => {
          const answered = done.some((q) => q.member_email === m.email);
          return (
            <span key={m.email} className={answered ? "" : "pending"}>
              <Avatar s={s} email={m.email} size={22} />{" "}
              {m.email === s.me.email ? "You" : m.display_name}:{" "}
              {answered ? "done" : "not yet"}
            </span>
          );
        })}
      </p>
      <button
        className={`btn ${mine ? "" : "btn-primary"}`}
        onClick={() => setOpen(true)}
      >
        {mine ? "Edit my answers" : "Answer (1 minute)"}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Plan next week">
        {open && (
          <QuizForm
            week={week}
            initial={mine?.answers ?? {}}
            onDone={() => setOpen(false)}
          />
        )}
      </Sheet>
    </section>
  );
}

function QuizForm({
  week,
  initial,
  onDone,
}: {
  week: Week;
  initial: QuestionnaireAnswers;
  onDone: () => void;
}) {
  const { api, run } = useApp();
  const [a, setA] = useState<QuestionnaireAnswers>(initial);
  const toggleIn = (key: "cuisines" | "proteins", v: string) =>
    setA((cur) => {
      const list = cur[key] ?? [];
      return {
        ...cur,
        [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v],
      };
    });

  return (
    <div className="quiz">
      <h2>Plan next week</h2>

      <fieldset>
        <legend>What are you in the mood for?</legend>
        <div className="chip-pick">
          {CUISINES.map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={a.cuisines?.includes(c) ?? false}
              className={a.cuisines?.includes(c) ? "on" : ""}
              onClick={() => toggleIn("cuisines", c)}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Which proteins sound good?</legend>
        <div className="chip-pick">
          {PROTEINS.map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={a.proteins?.includes(c) ?? false}
              className={a.proteins?.includes(c) ? "on" : ""}
              onClick={() => toggleIn("proteins", c)}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      {(
        [
          ["flavor", "How much flavor?", FLAVOR],
          ["adventure", "Try something new this week?", ADVENTURE],
          ["new_ingredient", "Buying a new ingredient?", NEW_INGREDIENT],
        ] as Array<[keyof QuestionnaireAnswers, string, string[]]>
      ).map(([key, label, opts]) => (
        <fieldset key={key}>
          <legend>{label}</legend>
          <div className="chip-pick stack">
            {opts.map((o) => (
              <button
                type="button"
                key={o}
                aria-pressed={a[key] === o}
                className={a[key] === o ? "on" : ""}
                onClick={() => setA((cur) => ({ ...cur, [key]: o }))}
              >
                {o}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="field">
        <span>Anything in the fridge or pantry to use up?</span>
        <input
          value={a.use_up ?? ""}
          placeholder="Half a bottle of oyster sauce, tortillas…"
          onChange={(e) => setA((cur) => ({ ...cur, use_up: e.target.value }))}
        />
      </label>
      <label className="field">
        <span>Anything to skip next week?</span>
        <input
          value={a.avoid ?? ""}
          placeholder="No salmon, nothing too heavy…"
          onChange={(e) => setA((cur) => ({ ...cur, avoid: e.target.value }))}
        />
      </label>

      <button
        className="btn btn-primary btn-block"
        onClick={async () => {
          if (
            await run(
              () => api.saveQuestionnaire(week.id, a),
              "Thanks. Claude will use this for next week.",
            )
          )
            onDone();
        }}
      >
        Save my answers
      </button>
    </div>
  );
}
