import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { createLiveApi } from "./lib/liveApi";
import { createDemoApi } from "./lib/demoApi";
import "./styles.css";

// The Supabase URL and publishable key are safe to ship in the app:
// row-level security in the database decides who can read or change anything.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://griwcdrwnoayazmooylk.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Tmz4b7SjBOr427DvBjgsUw_97wAc5QI";

const api =
  import.meta.env.VITE_DEMO === "1"
    ? createDemoApi()
    : createLiveApi(SUPABASE_URL, SUPABASE_KEY);

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
);
