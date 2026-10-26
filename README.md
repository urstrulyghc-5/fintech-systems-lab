# FinTech Systems Lab

**G Hari Charan · Design & Curator**

An interactive educational platform that explains financial technology from the fundamentals through architecture, products, payments, global transfers, risk, regulation, operations, innovation and terminology.

## Run locally

Keep these files in the same folder:

- `index.html` — page structure and learning content
- `styles.css` — responsive UI, animation and accessibility styling
- `app.js` — navigation, detailed learning panels, system map, simulator UI, glossary, risk scenarios and FX teaching calculator
- `engine.js` — the original local payment simulation engine

Because JavaScript uses ES modules, serve the folder over HTTP rather than opening `index.html` as a `file://` URL. With Python installed:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Deploy with GitHub Pages

1. Keep the four files above at the repository root.
2. Commit and push the updated files to the branch used by GitHub Pages.
3. In repository **Settings → Pages**, confirm the correct branch and `/ (root)` directory.
4. Open the published site after the deployment completes.

The site is static and uses no build step. The optional Google Fonts stylesheet falls back to system fonts if external font loading is unavailable.

## Test the payment engine

Requires Node.js. Run:

```bash
node --test
```

The included tests exercise validation, successful and declined transactions, uncertain timeouts, duplicate request keys and reconciliation exceptions.

## What is included

- Animated introduction with a skip control and reduced-motion support.
- Persistent top navigation across ten learning areas: Start here, Evolution, Architecture, Payments, Global flows, Risk & rules, Operations, Innovation, Terminology and References.
- Clickable overview cards and an animated architecture map; node clicks open detailed learning panels.
- Payment simulation using the existing engine, with animated stage tracing, timestamped events, transaction register, example cases, CSV export and reconciliation.
- Illustrative cross-border cost calculator with adjustable amount, currencies, rate, fee and margin.
- Scenario-based risk lab, searchable terminology dictionary and official-source library.
- Dated factual snapshot and clearly labelled policy targets.
- Credit: **G Hari Charan · Design & Curator**.

## Accuracy and scope

This is an educational simulation only. It does not connect to UPI, banks, card networks, wallets, payment gateways, blockchain networks or any live financial infrastructure. All simulated transaction outcomes and records are fictional. Cross-border exchange-rate values are examples, not live rates or financial quotes.

Payment rails differ. The diagrams are illustrative rather than a claim that every transaction follows the same sequence. Authorisation, clearing, settlement and reconciliation are explained as distinct concepts, with system-specific variation noted.

The home-page data snapshot links to the Government of India's cited 2026 update. It reports UPI as 84% of India's digital payments in FY 2025–26 and 2,366 crore UPI transactions in July 2026. The cross-border figures are FSB G20 targets for end-2027, not claims of current achievement. Always follow the source link and check the source's reporting period, definitions and later updates.

Regulatory descriptions are orientation only, not legal advice. Requirements depend on the product, regulated entity, activity and jurisdiction and can change. Consult the current primary rules.

## Known limitations

- Transaction records are kept in page memory and reset when the page session reloads.
- The FX calculator uses editable illustrative values and is not connected to live market data.
- The simulated payment stages simplify real production systems; they do not reproduce a specific provider's implementation.
- The architecture map is an explanatory model, not a network topology diagram for any particular institution.
- This deliverable has not been connected to or deployed on the user's live GitHub repository. Deploy it only after reviewing and testing it in the target environment.


## Interactive Playground

The Playground adds four short, fictional decision missions: payment rescue, fraud detection, reconciliation and cross-border route selection. Each mission updates the system-flow visual, reveals decision consequences, awards a simple score and recommends a next step based on the choice. All activity runs locally in the browser; no real accounts, payments or customer data are connected.
