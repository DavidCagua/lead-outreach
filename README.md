# 🧠 AI Sales & Outreach Agent

Ekos is an AI-powered system that automates **prospect discovery, qualification, and personalized outreach** for dental and medical clinics.

It combines real-world data (Google Places), website intelligence (Firecrawl), and LLM-based agents to help sales teams **identify high-quality leads and generate tailored outreach messages** — with human oversight built into the workflow.

---

# 🚀 Overview

Sales reps typically spend hours:

* searching for clinics
* analyzing websites
* deciding if they are good prospects
* writing personalized emails

Ekos automates this entire pipeline:

```text
Discover → Enrich → Analyze → Score → Select → Generate Outreach
```

---

# 🧩 Architecture

Ekos is designed as a **multi-stage agent system with asynchronous processing**.

```text
User (Next.js UI)
   ↓
API Routes (enqueue jobs)
   ↓
Redis (BullMQ queues)
   ↓
Worker (background processing)
   ↓
AI Agents + External APIs
   ↓
Results stored + UI updates
```

---

## 🔧 Monorepo Structure

```text
apps/
  web/        → Next.js UI + API routes
packages/
  core/       → agents, services, orchestrator, types
  worker/     → BullMQ workers
```

---

# ⚙️ Core Pipeline

## 1. Discovery

* Uses **Google Places API**
* Finds clinics based on user query
* Deduplicates via `place_id`

---

## 2. Enrichment

* Retrieves website via Place Details API
* Uses **Firecrawl** to extract clean, structured content

**Rate limiting (free tier):** The Firecrawl free tier allows ~3 requests/minute. The integration includes:
* **429 retry with backoff** — On rate limit, waits per API "retry after Xs" hint and retries (max 5)
* **Sequential processing** — Lead worker concurrency is 1 to avoid burst traffic
* Consider upgrading at [firecrawl.dev/pricing](https://firecrawl.dev/pricing) for higher throughput

---

## 3. Intelligence Layer (AI Agents)

### 🔎 Extraction Agent

Extracts structured data from website content:

* services
* clinic size
* pain points
* online booking
* confidence score

---

### 📊 Scoring Agent

Evaluates lead quality:

* score (1–10)
* priority
* reasoning

---

### ✍️ Outreach Agent

Generates personalized email drafts based on insights.

---

## 4. Adaptive Refinement Loop

Ekos improves lead quality through **iterative search refinement**:

```text
Search → Process → Evaluate → Refine → Repeat (max 3)
```

Enhancements:

* Query expansion (LLM generates multiple search variations)
* LLM-based refinement using previous results
* Deduplication across attempts

---

## 5. Human-in-the-loop (Critical)

Ekos includes two review stages:

### ✅ Lead Selection

Users review and approve high-quality leads:

* score
* reasoning
* extracted insights

---

### ✉️ Outreach Review

Users review/edit generated emails before sending.

---

# 🔄 Asynchronous Processing

Heavy tasks (crawling + LLM calls) are handled using:

* **BullMQ**
* **Redis**

Queues:

* `lead-processing` → enrichment + scoring
* `outreach` → email generation

Features:

* concurrency control
* retries with exponential backoff
* progressive UI updates

---

# 🧠 Key Design Decisions

## 1. No Agent Framework (LangChain)

The system uses a **custom orchestration layer** instead of frameworks.

Reason:

* workflow is deterministic
* improves clarity and control
* avoids unnecessary abstraction

---

## 2. Adaptive Query Strategy

Instead of fixed rules:

* initial query is expanded using LLM
* subsequent queries are refined based on results

This improves both:

* recall (more leads)
* precision (better leads)

---

## 3. Hybrid Sync + Async Architecture

* UI + API → Next.js
* heavy processing → background workers

This ensures:

* fast user experience
* scalable processing

---

## 4. Progressive UX

The UI updates in real time as jobs complete:

* no blocking
* visible system activity
* better user trust

---

## 5. Human-in-the-loop Design

The system prioritizes:

* control
* transparency
* trust

instead of full automation.

---

# 🖥️ UI Overview

The dashboard provides:

### 🔍 Search

* input query (e.g. "dental clinics Austin")

### 📋 Lead List

* score (color-coded)
* reasoning
* insights
* processing state

### 🧠 Insight Panel

* AI summary
* services
* pain points
* website link

### ✍️ Outreach Editor

* generated email
* edit / regenerate
* approve

---

# 🧪 Running Locally

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Start Redis

```bash
docker run -p 6379:6379 redis
```

---

## 3. Environment variables

Create `.env` in root:

```env
REDIS_URL=redis://localhost:6379
GOOGLE_PLACES_API_KEY=your_key
FIRECRAWL_API_KEY=your_key
OPENAI_API_KEY=your_key
```

---

## 4. Run apps

```bash
pnpm dev       # Next.js app
pnpm worker    # background worker
```

---

## 🌍 Deployment

* Frontend/API → Vercel
* Worker → Railway / Render
* Redis → Upstash / Redis Cloud

---

# 🚧 Limitations & Future Work

* Email sending is stubbed (can integrate Resend/SendGrid)
* Query refinement can be further improved with evaluation agents
* Add lead persistence (DB instead of in-memory/Redis)
* Introduce analytics (conversion tracking)
* **Firecrawl rate limiting** — Built-in retry and concurrency=1 work around free tier (~3 req/min); upgrade for faster processing

---

# 💡 Future Improvements

* LLM-based lead evaluator (CRAG-style)
* Smart crawl escalation (scrape → crawl)
* CRM integration (HubSpot)
* Feedback loop from sales reps

---

# 🎯 Summary

Ekos demonstrates how AI agents can be used to:

* automate sales workflows
* improve lead quality
* generate personalized outreach
* balance automation with human control

It is designed as a **practical, production-oriented system**, not just a demo.

---

# 👤 Author

David Caguazango
Full-stack developer focused on AI systems and scalable architectures
