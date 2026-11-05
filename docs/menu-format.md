# Weekly menu format

Each week Claude delivers one JSON file (saved in `menus/YYYY-MM-DD.json`). Load it in the app under **Kitchen → Load a new week**. Loading a new week closes the previous one.

```jsonc
{
  "week": { "label": "Week of Nov 8", "starts_on": "2026-11-08", "pick_by": "2026-11-07" },
  "extras": {
    "hero": {                                         // one special ingredient used in 2+ meals
      "name": "Oyster sauce",
      "why": "What it adds and why it's worth buying",
      "used_in": ["slug-a", "slug-b"],
      "more_uses": ["Other ways to use the bottle after this week"]
    },
    "notes": ["Week-level notes"]
  },
  "meals": [
    {
      "slug": "sheet-pan-gnocchi-sausage",          // unique, stable id: the same meal keeps the same slug forever
      "name": "Sheet Pan Gnocchi with Sausage",
      "style": "oven",                                // kept for history; not shown in the app
      "cook_minutes": 30,
      "servings": 3,
      "learn": null,                                  // text on the week's one "learn something new" meal
      "tips": [                                        // kinds: make-extra, builds-on, frozen, prep-ahead, tip
        { "kind": "make-extra", "text": "Cook double rice tonight for Thursday's fried rice." }
      ],
      "description": "One or two sentences that sell the dish.",
      "included": ["Gnocchi", "Italian sausage", "..."],
      "on_the_side": "Chili flakes",                 // the spice that stays optional
      "image_url": "https://images.pexels.com/photos/ID/pexels-photo-ID.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "image_credit": "Photo from Pexels",
      "source_name": "Budget Bytes",                 // where the recipe is based on
      "source_url": "https://www.budgetbytes.com/...",
      "ingredients": [
        { "group": null, "items": ["1 lb shelf-stable gnocchi", "..."] },
        { "group": "Sauce", "note": "What the sauce does and why each part is there", "items": ["..."] }
      ],
      "steps": ["Heat the oven to 425°F...", "..."],
      "leftovers": "How to store and reheat for lunch.",
      "shopping": [
        { "name": "Italian sausage", "qty": 1, "unit": "lb", "section": "Meat & seafood" },
        { "name": "Garlic", "qty": 3, "unit": "cloves", "section": "Produce" },
        { "name": "Olive oil", "pantry": true }
      ]
    }
  ],
  "chosen": [],        // optional: slugs to lock in immediately (used for history imports)
  "cook_order": [],    // optional: slugs in the order to cook them
  "groceries": []      // optional: a hand-made list that replaces the automatic one
}
```

## House rules for every meal

- 3 servings (dinner for two plus one lunch), 30–40 minutes.
- No raw onion, no cilantro. Mild by default; heat goes in `on_the_side`.
- Go light on chicken (one chicken dish a week at most).
- Bold flavor: every meal has a sauce, glaze, crema or finish with its own ingredient group and a `note` explaining it.
- Steps are descriptive: heat level, time, and what "done" looks like.
- One meal per week is the "learn something new" meal (`learn`), still easy.
- One flavor hero (`extras.hero`) used in 2+ meals, with other uses listed.
- Mix cuisines; read the household's questionnaire answers and ratings first.
- Use `make-extra` and `builds-on` tips when a staple (rice, a sauce, a can) carries across meals.
- Mark shared bottles/cans with no `qty` and a note like "1 bottle covers the week" so they don't add up.
- Base recipes on Home Chef, Budget Bytes, Serious Eats or similar well-reviewed sites, adjust them to the rules above, and link the original in `source_url`.
- Photos: free-to-use (Pexels) or the household's own uploads.

## How the grocery list is built

When the week is locked, the app combines the `shopping` lists of the chosen meals. Items with the same `name` and `unit` are added together (so 4 + 3 cloves of garlic becomes 7 cloves). Use identical names and units across meals so they merge. Items marked `"pantry": true` go into the "Check your pantry first" group.

Sections: `Produce`, `Meat & seafood`, `Dairy`, `Bread & tortillas`, `Canned & jarred`, `Frozen`, `Spice on the side`.
