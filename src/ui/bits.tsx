import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Meal, Snapshot, Tip, Week } from "../lib/types";

/* ---------- Icons (24px line icons) ---------- */

const paths: Record<string, ReactNode> = {
  menu: (
    <>
      <path d="M4 11h16a8 8 0 0 1-16 0Z" />
      <path d="M9 7c0-1.2 1-1.6 1-2.8M13 7c0-1.2 1-1.6 1-2.8" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M12 7.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2Z" />
    </>
  ),
  kitchen: (
    <>
      <path d="M6 10h12v8.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18.5V10Z" />
      <path d="M4 10h16M9 6.5c0-1 .8-1.4.8-2.5M14.2 6.5c0-1 .8-1.4.8-2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chili: (
    <>
      <path d="M8 8c-2.5 3-2.6 8.6 4.5 12 1.2.6 2.4-.4 1.9-1.6C12.8 14.6 14 11 16 9.3" />
      <path d="M8 8c2.2-1.5 5.8-1.3 8 1.3M14 6.5c0-1.5.8-2.5 2-3" />
    </>
  ),
  box: (
    <>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" />
    </>
  ),
  link: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4" />
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.8c1.7.6 2.7 2 3 4.2" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="12" rx="2" />
      <path d="M5 15.5V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  share: <path d="M12 4v11M8 7.5 12 4l4 3.5M6 11v8h12v-8" />,
  back: <path d="M15 5 8 12l7 7" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  snow: (
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />
  ),
  spark: (
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5ZM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  ),
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  leftovers: (
    <>
      <path d="M5 9h14l-1.5 10h-11L5 9Z" />
      <path d="M8 9 9.5 4h5L16 9" />
    </>
  ),
};

export function Icon({
  name,
  size = 22,
  filled = false,
}: {
  name: keyof typeof paths | string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/* ---------- Photo with an illustrated fallback ---------- */

const FALLBACK_TINTS = [
  "#E7B49A",
  "#A9D3C9",
  "#8FB8DE",
  "#C9DCE8",
  "#B9D6C2",
  "#E3CDB0",
];

export function Photo({
  meal,
  className = "",
}: {
  meal: Pick<Meal, "name" | "image_url" | "slug">;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!meal.image_url || failed) {
    const tint =
      FALLBACK_TINTS[
        [...meal.slug].reduce((a, c) => a + c.charCodeAt(0), 0) %
          FALLBACK_TINTS.length
      ];
    return (
      <div
        className={`photo photo-fallback ${className}`}
        style={{ background: tint }}
        role="img"
        aria-label={meal.name}
      >
        <svg viewBox="0 0 120 80" aria-hidden="true">
          <ellipse
            cx="60"
            cy="52"
            rx="44"
            ry="14"
            fill="rgba(255,255,255,.55)"
          />
          <path d="M22 46h76a38 26 0 0 1-76 0Z" fill="rgba(30,58,70,.18)" />
          <path
            d="M50 30c0-5 4-6 4-11M62 30c0-5 4-6 4-11M74 30c0-5 4-6 4-11"
            stroke="rgba(30,58,70,.35)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }
  return (
    <img
      className={`photo ${className}`}
      src={meal.image_url}
      alt={meal.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/* ---------- Small pieces ---------- */

export function MealMeta({ meal }: { meal: Meal }) {
  return (
    <p className="meta">
      <span className="meta-item">
        <Icon name="clock" size={16} />
        {meal.cook_minutes} min
      </span>
      <span className="meta-item">
        <Icon name="people" size={16} />
        {meal.servings} servings
      </span>
      {meal.learn && <span className="learn-tag">Learn something new</span>}
    </p>
  );
}

const TIP_LABEL: Record<Tip["kind"], { icon: string; label: string }> = {
  "make-extra": { icon: "leftovers", label: "Make extra" },
  "builds-on": { icon: "cart", label: "Uses what you have" },
  frozen: { icon: "snow", label: "Using frozen?" },
  "prep-ahead": { icon: "clock", label: "Prep ahead" },
  tip: { icon: "spark", label: "Tip" },
};

export function Tips({ tips }: { tips: Tip[] }) {
  if (!tips?.length) return null;
  return (
    <ul className="tips">
      {tips.map((t, i) => {
        const l = TIP_LABEL[t.kind] ?? TIP_LABEL.tip;
        return (
          <li key={i} className={`tip tip-${t.kind}`}>
            <Icon name={l.icon} size={18} />
            <span>
              <b>{l.label}:</b> {t.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Learn({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="learn-box">
      <span className="learn-tag">Learn something new</span>
      <p>{text}</p>
    </div>
  );
}

export function HeroCard({
  s,
  week,
  compact = false,
}: {
  s: Snapshot;
  week: Week;
  compact?: boolean;
}) {
  const hero = week.extras?.hero;
  if (!hero) return null;
  const used = hero.used_in
    .map((slug) => s.meals.find((m) => m.slug === slug)?.name)
    .filter(Boolean);
  return (
    <section className="hero-card">
      <p className="hero-kicker">This week's flavor hero</p>
      <h3>{hero.name}</h3>
      <p>{hero.why}</p>
      {used.length > 0 && (
        <p className="small">
          <b>Used in:</b> {used.join(", ")}
        </p>
      )}
      {!compact && hero.more_uses.length > 0 && (
        <>
          <p className="small">
            <b>After this week, try it in:</b>
          </p>
          <ul className="small">
            {hero.more_uses.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function Avatar({
  s,
  email,
  size = 26,
}: {
  s: Snapshot;
  email: string;
  size?: number;
}) {
  const member = s.members.find((m) => m.email === email);
  const name = member?.display_name ?? email;
  const idx = Math.max(
    0,
    s.members.findIndex((m) => m.email === email),
  );
  return (
    <span
      className={`avatar avatar-${idx % 3}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      title={name}
      aria-label={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Stars({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  return (
    <span
      className={`stars ${onChange ? "stars-input" : ""}`}
      role={onChange ? "radiogroup" : "img"}
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={n <= value ? "on" : ""}
            onClick={() => onChange(n)}
          >
            <Star size={size} />
          </button>
        ) : (
          <span key={n} className={n <= value ? "on" : ""}>
            <Star size={size} />
          </span>
        ),
      )}
    </span>
  );
}

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </svg>
  );
}

/* ---------- Bottom sheet ---------- */

export function Sheet({
  open,
  onClose,
  children,
  label,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  tall?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.scrollTop = 0;
    }
    if (!open && d.open) d.close();
  }, [open]);
  // Only treat the dialog's own close (Escape key) as a request to close,
  // not the close that happens when the app has already hidden it.
  const requestClose = () => {
    if (openRef.current) onClose();
  };
  return (
    <dialog
      ref={ref}
      className={`sheet ${tall ? "sheet-tall" : ""}`}
      aria-label={label}
      onClose={requestClose}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => e.target === ref.current && requestClose()}
    >
      {open && (
        <div className="sheet-body">
          <div className="sheet-bar">
            {tall ? (
              <button className="sheet-back" onClick={requestClose}>
                <Icon name="back" size={20} />
                Back
              </button>
            ) : (
              <button
                className="sheet-close"
                onClick={requestClose}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
