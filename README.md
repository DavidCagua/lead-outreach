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

## Project Structure

```
ekos/
├── apps/web/          # Next.js frontend + API routes
├── packages/core/     # Agents, integrations, queue, store
├── packages/worker/   # BullMQ worker process
└── pnpm-workspace.yaml
```
