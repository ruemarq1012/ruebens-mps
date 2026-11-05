// Turns the app's grocery list into an Instacart shopping-list page.
// Needs the INSTACART_API_KEY secret (from the Instacart Developer Platform).
// Without it, the function answers { url: null } and the app falls back to
// per-item Instacart searches.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("INSTACART_API_KEY");
  if (!key) return json({ url: null, configured: false });

  let payload: { title?: string; items?: Array<{ name: string; display?: string }> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Send JSON" }, 400);
  }
  const items = (payload.items ?? []).filter((i) => i?.name?.trim()).slice(0, 100);
  if (!items.length) return json({ error: "No items" }, 400);

  const base = Deno.env.get("INSTACART_BASE_URL") ?? "https://connect.instacart.com";
  const res = await fetch(`${base}/idp/v1/products/products_link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: (payload.title ?? "Grocery list").slice(0, 120),
      link_type: "shopping_list",
      expires_in: 30,
      line_items: items.map((i) => ({
        name: i.name.slice(0, 100),
        display_text: (i.display ?? i.name).slice(0, 140),
      })),
    }),
  });
  if (!res.ok) {
    console.error("Instacart error", res.status, await res.text());
    return json({ error: "Instacart rejected the list" }, 502);
  }
  const data = await res.json();
  return json({ url: data.products_link_url ?? null, configured: true });
});
