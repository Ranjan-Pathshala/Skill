# RP Skill | Ranjan Pathshala — Stenography, Typing & CBT Portal

Modular Vite + TypeScript / ES Module frontend for the **RP Skill (Ranjan Pathshala)** Stenography, Pitman Shorthand, Courtroom Dictation, Touch-Typing, and Bilingual TCS-iON CBT Examination Portal.

Refactored from a ~53,600-line single-file HTML monolith (with 3 stacked `<style>` blocks and 5 layered `<script>` monkey-patch blocks) into clean, conflict-free Vite ES modules, modular stylesheets, raw-imported view/modal HTML templates, and unit-tested pure-logic utilities.

---

## Architecture Overview

```text
├── index.html                      # Lean ~50-line entry point
├── vite.config.ts                  # Vite config with domain-level ES code splitting
├── public/
│   ├── manifest.json               # Web App Manifest
│   └── icon.svg                    # Portal brand icon
└── src/
    ├── main.ts                     # Deterministic ES module bootstrap
    ├── styles/                     # Conflict-free modular CSS cascade
    │   ├── index.css               # Master CSS import barrel
    │   ├── tokens.css              # Light/dark theme tokens & keyframes
    │   ├── layout.css              # App shell, frosted header, sidebar & viewport
    │   ├── components.css          # Cards, modals, forms, toasts & tables
    │   ├── views.css               # Auth, Dashboard, Profile, Fees & Leaderboards
    │   ├── exams.css               # Typing, Dictation, CBT Arena & Print rules
    │   ├── admin.css               # Admin Control Center & Attendance Matrix
    │   └── theme-polish.css        # Elevation, glassmorphism & dark-mode polish
    ├── templates/                  # Modular HTML templates (Vite ?raw imports)
    │   ├── mountShell.ts           # Deterministic shell, view & modal mounter
    │   ├── shell.html              # Header, nav drawer, notifications & footer
    │   ├── views/                  # 18 per-view HTML partials
    │   └── modals/                 # Core & enterprise modal suites
    ├── core/                       # Strictly-typed runtime foundation
    │   ├── storageShim.ts          # Safe storage / BroadcastChannel shims & theme boot
    │   ├── config.ts               # Environment endpoint & portal constants
    │   ├── hooks.ts                # Typed lifecycle hook bus (eliminates monkey-patching)
    │   └── state.ts                # Centralized reactive state store
    ├── utils/                      # Decoupled pure TypeScript logic + node:test specs
    │   ├── formatting.ts           # HTML escaping, URL sanitization, dates & clips
    │   ├── evaluationEngine.ts     # LCS diff, homophone detector & WPM/accuracy math
    │   ├── permissions.ts          # Batch normalization, scoping & maintenance guards
    │   ├── feeMath.ts              # Coupons, installments, UPI URI & expiry math
    │   ├── pitman.ts               # Pitman stroke SVG generator & hard-word extractor
    │   └── portalLogic.test.ts     # Automated node:test verification suite
    ├── bridge/
    │   └── globals.ts              # Typed inline DOM handler bridge (window.*)
    └── features/                   # 11 conflict-free domain ES feature modules
        ├── apiAndCore.js           # API client, read cache, retry queues & streaming
        ├── authAndNavigation.js    # Auth, 2FA, single-device sessions & router
        ├── dashboardAndProfile.js  # Command center, carousels, profile & help desk
        ├── typingAndEvaluation.js  # Typing wizard, active test & comparison analytics
        ├── adminPanel.js           # Admin control center, batches, banners & rules
        ├── mediaAndDictation.js    # Media viewer, PDF reader, dictation & audio FX
        ├── videoAndTutor.js        # Video courses, 10-finger tutor & latency heatmap
        ├── cbtArena.js             # Bilingual TCS-iON CBT arena & SRS revision
        ├── weakVaultAndPlanner.js  # Weak outlines vault, Pitman SVG & 7-day planner
        ├── communityAndAnalytics.js# Batch hub, doubt wall, polls, leaderboard & DRM
        └── feesAndBilling.js       # Plans catalog, UPI checkout, receipts & ledgers
```

### Key Improvements Over the Single-File Monolith
- **Zero Override Conflicts**: Eliminated all 33 cross-script function overrides — replaced 11 shadowed base definitions with their single authoritative implementation and migrated 22 layered `window.*` monkey-patch chains onto the typed `portalHooks` lifecycle event bus (`src/core/hooks.ts`).
- **Faster Initial Load via Code Splitting**: Vite splits heavy domains (`chunk-admin`, `chunk-cbt`, `chunk-media-dictation`, `chunk-typing-eval`, `chunk-video-tutor`, `chunk-fees`, `chunk-engagement`, `chunk-templates`, `chunk-core`) into cacheable, minified ES bundles.
- **Maintainable Views & Styles**: 18 HTML views, 2 modal suites, and 7 domain CSS modules replace 53,600 lines of mixed inline markup, styles, and scripts.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Optional: configure your Google Apps Script Web App URL
cp .env.example .env

# 3. Run local development server (http://localhost:3000)
npm run dev

# 4. Run unit & structural integrity tests
npm test

# 5. Type-check & build production bundles
npm run lint
npm run build
```

## Deploying to GitHub Pages / Vercel / Netlify

Build output is written to `dist/`:
- **Vercel / Netlify**: Connect the repository, set build command to `npm run build` and output directory to `dist`, and optionally set `VITE_APPS_SCRIPT_URL`.
- **GitHub Pages**: Publish the `dist/` directory using GitHub Actions (`actions/deploy-pages`).
