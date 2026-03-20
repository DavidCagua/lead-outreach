# Ekos - AI-Powered Sales & Outreach Agent

An MVP system that discovers clinics via Google Places, enriches them with Firecrawl, uses AI agents for extraction, scoring, and outreach, and provides a human-in-the-loop dashboard.

## Quick Start

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

   Required:

   - `REDIS_URL` - Redis connection (e.g. `redis://localhost:6379`)
   - `GOOGLE_PLACES_API_KEY` - Google Cloud Places API key
   - `FIRECRAWL_API_KEY` - Firecrawl API key
   - `OPENAI_API_KEY` - OpenAI API key

3. **Start Redis**

   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

4. **Run the app**

   Terminal 1 (Next.js):

   ```bash
   pnpm dev
   ```

   Terminal 2 (Worker):

   ```bash
   pnpm worker
   ```

5. **Open**

   http://localhost:3000/dashboard

## Usage

1. **Search** - Enter a query like "dental clinics in Austin" and click Search.
2. **Review leads** - Leads are processed in the background. Filter by score and select leads to approve.
3. **Generate emails** - Click "Generate emails for selected" to create personalized outreach.
4. **Edit & approve** - Review each email, edit if needed, regenerate, or approve.

## Architecture

### High-Level Flow

```
User Search → expandQuery (3 queries) → Google Places → Create leads → Enqueue
                    ↓
         Discovery Loop (attempt 1: wait | attempts 2-3: refineQueryLLM → search)
                    ↓
         Lead worker (crawl, extract, score) → Redis store
                    ↓
         Outreach worker (generate emails) → Redis store
                    ↓
         Dashboard polls, human reviews
```

### Refinement Layer

The system uses an **adaptive, LLM-driven** refinement strategy instead of fixed rules:

| Phase | Strategy | Purpose |
|-------|----------|---------|
| **Attempt 1** | `expandQuery` | LLM generates 2–3 query variations from the user input. Increases recall by exploring multiple search angles. |
| **Attempts 2–3** | `refineQueryLLM` | LLM refines based on feedback: good leads (score, services, pain points) vs bad leads (failure reasons). Returns a single improved query. |

- **Fallback:** If the LLM fails, a deterministic `fallbackRefineQuery` is used (quality signals + niche terms).
- **Stopping:** Loop stops when there are ≥5 good leads or 3 attempts are reached.
- **Good lead criteria:** `confidence ≥ 0.6`, `score ≥ 9`, has services.

### Components

| Component | Role |
|-----------|------|
| **Search API** | Calls `expandQuery`, searches each query via Google Places, dedupes by `place_id`, creates leads, enqueues to `lead-processing`, starts discovery loop. |
| **Discovery loop** | Runs in background. Attempt 1 waits for initial batch. Attempts 2–3 call `refineQueryLLM` with `previousResultsSummary`, search, enqueue. Writes refinement status to Redis for UI. |
| **Lead worker** | Concurrency 1. Crawls website (Firecrawl), runs extraction agent, scoring agent, optionally outreach agent. Updates lead in Redis. |
| **Outreach worker** | Concurrency 5. Generates personalized emails for completed leads. |
| **ProcessingStatus** | Polls `GET /api/leads/refinement-status` every 2s, shows "Refining results (Attempt X / 3)". |

### Data Flow

- **Redis:** Lead store (`lead:*`), refinement status (`refinement:status`), BullMQ queues.
- **Polling:** Dashboard polls `GET /api/leads` every 3s for progressive updates.

## Project Structure

```
ekos/
├── apps/web/          # Next.js frontend + API routes
├── packages/core/     # Agents, integrations, queue, store, orchestrator
├── packages/worker/   # BullMQ worker process
└── pnpm-workspace.yaml
```
