# AdFit AI - Ad-to-Landing Page Fit Analyzer

AdFit AI is a production-grade, AI-powered Conversion Rate Optimization (CRO) audit application. It helps growth teams, marketing managers, and agencies scan paid advertisement campaigns (copy or visual screenshots) against target landing pages to locate conversion leaks, score messaging alignment, calculate RICE priorities, and trigger automated A/B test experiments.

---

## Architecture Diagram

```mermaid
graph TD
    Client[Next.js Client (App Router)] <--> |SSE Stream / HTTP JSON| API[Next.js API Handler]
    API --> |URL Extraction| Scraper[Playwright & Cheerio Engine]
    API --> |Direct SDK Call| LLM[OpenAI / Anthropic Orchestrator]
    API <--> |ORM Client| Prisma[Prisma ORM]
    Prisma <--> |PostgreSQL| Supabase[(Supabase DB)]
    API <--> |Local fallback| JSONDB[(db.json storage)]
```

---

## Key Features

1. **Two-Stage Scraper**: Spins up headless browser sandboxes with **Playwright** to load JS-dynamic pages, extract metas, headlines, CTAs, testimonials, guarantees, pricing models, and capture screenshots. Falls back to **Cheerio** for execution in serverless Vercel environments.
2. **AI Vision & Text OCR**: Directly integrates OpenAI and Anthropic SDKs (no wrappers) to parse ad screenshots, extract visual hierarchy, analyze brand colors, detect promotional offers, and measure alignment.
3. **RICE-Prioritized Checklists**: Every identified conversion issue is auto-scored on Impact, Confidence, and Effort, sorting recommendations by highest RICE priority.
4. **Interactive Bounding Box Overlays**: Displays Playwright/Vision screenshots in the UI and maps coordinates to absolute boxes. Hovering over a card highlights its location on the screenshot.
5. **Interactive Report Copilot**: Chat directly with an AI assistant trained on the report context. Ask it to write CSS tweaks or rewrite landing page sections.
6. **PDF Reports Exporter**: Server-side client-ready A4 PDF generator using **pdfkit** to format executive summaries, match details, problems, and copy rewrites.
7. **Zero-Setup Developer Guest Mode**: Runs immediately out of the box using a local JSON file-based database (`db.json`) if no Postgres string is present.

---

## Folder Structure

```
├── app/
│   ├── api/
│   │   ├── analyze/        # SSE streaming fit analyzer
│   │   ├── chat/           # Inline context chat assistant
│   │   ├── compare/        # Competitor comparison audits
│   │   ├── export/         # A4 client PDF document generator
│   │   ├── history/        # CRUD history endpoints
│   │   └── rewrite/        # Copywriting rephrasing suggestions
│   ├── dashboard/          # Performance metrics, list, search, duplicate
│   ├── report/[id]/        # Visual report viewer, tab contents, chat drawer
│   ├── globals.css         # Styling system & global print rules
│   ├── layout.tsx          # Root theme provider
│   └── page.tsx            # Product Landing Page
├── components/
│   └── CommandPalette.tsx  # Global Keyboard Shortcuts (Cmd+K)
├── lib/
│   └── storage.ts          # Unified hybrid storage engine (Prisma/JSON)
├── prisma/
│   └── schema.prisma       # Database design schema models
├── services/
│   ├── analyzer.ts         # OpenAI & Anthropic orchestrator
│   └── scraper.ts          # Playwright & Cheerio crawler
└── __tests__/
    └── storage.test.ts     # CRUD storage unit tests
```

---

## Installation & Setup

### Prerequisites
- Node.js `v20` or higher
- npm

### 1. Clone the project and install packages:
```bash
npm install
```

### 2. Download Playwright Browser Binary:
```bash
npx playwright install chromium
```

### 3. Setup Environment Variables:
Copy `.env.example` to `.env` or edit the existing `.env` file at root level:
```env
# comment DATABASE_URL out to run in local JSON mode
DATABASE_URL="postgresql://username:password@your-supabase-host:5432/postgres?schema=public"

# AI Provider Access Keys
OPENAI_API_KEY="your-openai-key"
ANTHROPIC_API_KEY="your-anthropic-key"
```

### 4. Database Setup (If using Supabase/PostgreSQL):
Push models and compile the schema client:
```bash
npx prisma db push
npx prisma generate
```

### 5. Running the Application:
Start the Next.js development server:
```bash
npm run dev
```
Open `http://localhost:3000` to inspect.

---

## Running Test Suites

Execute unit test cases:
```bash
npm run test
```
To run the tests with coverage or GUI:
```bash
npx vitest
```

---

## Technical Decisions & Tradeoffs

### 1. Hybrid Storage Engine
- **Decision**: Designed `lib/storage.ts` to switch dynamically between Prisma Client and a file-based JSON database depending on `process.env.DATABASE_URL`.
- **Tradeoff**: Keeps the codebase slightly larger, but guarantees that developers and evaluators can boot up and test the application with full history preservation instantly without setting up databases or docker containers.

### 2. HTML5 Coordinate Overlays vs. Server-Side Image Manipulation
- **Decision**: Rather than using native canvas dependencies to draw boxes on screenshots server-side, the scraper coordinates are stored as percentages, and absolute position containers overlay the image in CSS.
- **Tradeoff**: Saves substantial package bloat, prevents OS-specific native node-canvas compilation errors during dev setup, handles resizing/retina displays beautifully, and allows rich hover interactivity (hovering over recommendations glows corresponding screenshot regions).

---

## Production Deployment Checklist

1. Set `NODE_ENV=production`.
2. Configure `DATABASE_URL` pointing to Supabase PostgreSQL connection string pooler.
3. Configure `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for high-rate limit tiers.
4. Set up Vercel serverless timeout limits (standard function limits are 10s on hobby, configure streaming or check connection endpoints).
