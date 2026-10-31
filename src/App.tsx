import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Api, Snapshot } from "./lib/types";
import { Ctx, type AppCtx, type Tab } from "./ui/context";
import { Icon } from "./ui/bits";
import { SignIn, NotInvited } from "./ui/SignIn";
import { ThisWeek } from "./ui/ThisWeek";
import { Groceries } from "./ui/Groceries";
import { Cookbook } from "./ui/Cookbook";
import { Kitchen } from "./ui/Kitchen";
import { MealSheet } from "./ui/MealSheet";
import { RateSheet } from "./ui/RateSheet";
import { CookMode } from "./ui/CookMode";
import { InstallHint } from "./ui/InstallHint";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "week", label: "This week", icon: "menu" },
  { id: "groceries", label: "Groceries", icon: "cart" },
  { id: "cookbook", label: "Cookbook", icon: "book" },
  { id: "kitchen", label: "Kitchen", icon: "kitchen" },
];

function readTab(): Tab {
  const h = location.hash.replace("#", "") as Tab;
  return TABS.some((t) => t.id === h) ? h : "week";
}

export default function App({ api }: { api: Api }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(readTab);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [mealOpen, setMealOpen] = useState<{
    mealId: string;
    weekId?: string;
  } | null>(null);
  const [rateOpen, setRateOpen] = useState<{
    weekId: string;
    mealId: string;
  } | null>(null);
  const [cookOpen, setCookOpen] = useState<{
    weekId: string;
    mealId: string;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api.currentEmail().then(setEmail);
    return api.onAuthChange(setEmail);
  }, [api]);

  const refresh = useCallback(async () => {
    if (!email) return;
    try {
      setSnap(await api.snapshot(email));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [api, email]);

  useEffect(() => {
    if (!email) {
      setSnap(undefined);
      return;
    }
    refresh();
    return api.subscribe(refresh);
  }, [api, email, refresh]);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const ctx: AppCtx | null = useMemo(() => {
    if (!snap) return null;
    return {
      api,
      s: snap,
      refresh,
      patch: (fn) => setSnap((cur) => (cur ? fn(cur) : cur)),
      toast,
      run: async (fn, done) => {
        try {
          await fn();
          if (done) toast(done);
          await refresh();
          return true;
        } catch (e) {
          toast(
            (e as Error).message ||
              "That didn't save. Check your connection and try again.",
          );
          await refresh();
          return false;
        }
      },
      openMeal: (mealId, weekId) => setMealOpen({ mealId, weekId }),
      openRate: (weekId, mealId) => {
        setMealOpen(null);
        setCookOpen(null);
        setRateOpen({ weekId, mealId });
      },
      openCook: (weekId, mealId) => {
        setMealOpen(null);
        setCookOpen({ weekId, mealId });
      },
      go: (t) => {
        location.hash = t;
        window.scrollTo(0, 0);
      },
    };
  }, [api, snap, refresh, toast]);

  if (email === undefined) return <Splash />;
  if (email === null) return <SignIn api={api} />;
  if (snap === undefined)
    return loadError ? (
      <Splash error={loadError} onRetry={refresh} />
    ) : (
      <Splash />
    );
  if (snap === null) return <NotInvited api={api} email={email} />;
  if (!ctx) return <Splash />;

  const tabs = TABS.map((t) =>
    t.id === "kitchen" && snap.me.role !== "admin"
      ? { ...t, label: "Profile", icon: "user" }
      : t,
  );

  return (
    <Ctx.Provider value={ctx}>
      {api.mode === "demo" && (
        <div className="demo-banner">
          Preview mode with sample data. Nothing here is saved to your account.
        </div>
      )}
      <main className="screen" key={tab}>
        {tab === "week" && <ThisWeek />}
        {tab === "groceries" && <Groceries />}
        {tab === "cookbook" && <Cookbook />}
        {tab === "kitchen" && <Kitchen />}
      </main>
      <InstallHint />
      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className={tab === t.id ? "active" : ""}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <MealSheet state={mealOpen} onClose={() => setMealOpen(null)} />
      <RateSheet state={rateOpen} onClose={() => setRateOpen(null)} />
      {cookOpen && <CookMode {...cookOpen} onClose={() => setCookOpen(null)} />}
      <div
        className={`toast ${toastMsg ? "show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </Ctx.Provider>
  );
}

function Splash({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div className="splash">
      <div className="wordmark big">
        Rueben's <span>MPS</span>
      </div>
      {error ? (
        <>
          <p className="muted">Couldn't load your kitchen: {error}</p>
          <button className="btn" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        <p className="muted">Setting the table…</p>
      )}
    </div>
  );
}
