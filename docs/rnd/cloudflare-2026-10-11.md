# Cloudflare for Loka: a learning study

Written 2026-10-11 for the owner. Facts cite URLs or repo files; fit-for-Loka judgments are marked as opinion. Prices are list prices at the time of writing and will change; check the linked pages before budgeting.

## 1. Cloudflare in one page

**What it is (facts).** Cloudflare runs a global network of data centres ("the edge") that sits between the internet and websites. It began as a reverse proxy: DNS, caching, DDoS protection and a web application firewall in front of someone else's server. The developer platform is the second act: your own code and data run *on* that network instead of on a server you rent. Code runs as **Workers** (small JavaScript/TypeScript or WebAssembly programs started in milliseconds in whichever data centre is near the request), state lives in **Durable Objects**, **D1**, **KV** and **R2**, and bigger jobs run in **Containers** or **Workflows**. The CLI the owner installed (`cf`) covers the whole catalogue; its command list is in `cf-help.txt` and it asks agents to discover commands with `cf cli search "<task>"`.

**How pricing works (facts, from https://developers.cloudflare.com/workers/platform/pricing/, page dated 2026-10-02).**

| Tier | What you get | Notes |
|---|---|---|
| Workers Free | 100,000 requests/day, 10 ms CPU per invocation, static assets free and unlimited, SQLite Durable Objects, D1 (5 GB), KV (1 GB), R2 (10 GB), Workflows (3,000 steps/day), Browser Rendering 10 min/day | No card needed. CPU is the binding limit: 10 ms is too little for anything but routing and small reads |
| Workers Paid | $5/month minimum per account: 10 M requests and 30 M CPU-ms/month included, then $0.30 per extra million requests and $0.02 per extra million CPU-ms; CPU per request up to 5 min; Containers, Pipelines, K2 and Workers Logpush unlock here | Most Loka uses fit inside the included amounts |
| Per-product overage | each product meters its own unit (rows read/written for D1 and DO SQLite, operations for R2 and Queues, GiB-seconds for Containers, neurons for Workers AI, steps for Workflows) and includes a free allowance | Egress is free on Workers and R2; Containers charge egress |
| Zone products (DNS, CDN, WAF, Access, Turnstile, Tunnels) | Free plan on a domain; Pro $20/month and up adds WAF rules and analytics | Access Free covers a small team (see §2) |

**The idea that matters for Loka (opinion).** Everything is metered on *work done*, not servers kept running, and idle costs nothing. A private preview site, a receipt-log sync endpoint and a per-world Durable Object all cost cents at Loka's scale. The limits that bite are CPU time per invocation (30 s default, 5 min max on Paid) and 128 MB memory per Worker: fine for the kernel's decisions, wrong for mutant sweeps or an Elixir compiler, which belong in Containers or stay on GitHub Actions.

## 2. Service catalogue

Plain English first, then the one-line Loka angle. Sources: the `cf` command descriptions in `cf-help.txt` and the product pages linked; limits from https://developers.cloudflare.com/workers/platform/limits/ and https://developers.cloudflare.com/workers/platform/pricing/.

### Compute

| Service | Plain English | Key facts | Loka angle |
|---|---|---|---|
| Workers | A small program that runs at the edge for each request, cron tick or queue message; starts in about a millisecond, no server to manage. Also serves static files (a built web app). | 128 MB memory; CPU 10 ms (Free) or 30 s default up to 5 min (Paid); static asset requests free and unlimited; version URLs per upload; Access can sit in front | the host for the web Book, the preview, Storybook and any small API |
| Pages | Cloudflare's older "deploy a static site from Git with a preview URL per branch" product. Cloudflare now says Workers "has a distinctly broader set of features"; Pages still exists and is not deprecated (https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) | Git builds, per-branch previews, partial branch controls on Workers Builds | either works for static hosting; start on Workers static assets to avoid a later migration |
| Containers | Run a real Linux container (any language, your toolchain) on demand; each container is attached to a Durable Object and billed only while running, per 10 ms | Paid plan only; instance types lite (1/16 vCPU, 256 MiB) to standard-4 (4 vCPU, 12 GiB, 20 GB disk); 375 vCPU-minutes and 25 GiB-hours included, then $0.000020 per vCPU-second and $0.0000025 per GiB-second; egress charged (https://developers.cloudflare.com/containers/pricing/) | the only Cloudflare place where Elixir, `mix`, Node test suites or a headless browser toolchain could run |
| Workflows | A durable multi-step program: each step's result is saved, failed steps retry, a step can sleep for days; survives restarts | Free 1,024 steps per instance and 3,000 steps/day; Paid 10,000 steps (up to 25,000), 30 s CPU per step (up to 5 min), 1 GB state, 30-day retention, 50,000 concurrent (https://developers.cloudflare.com/workflows/reference/limits/) | the generate, validate, simulate, commit loop of an AI world delta; long batch orchestration |
| Durable Objects | One named, single-threaded object with its own SQLite database; all requests to a name go to the same object, in order; it can hold WebSockets (hibernating them when idle so they cost nothing) and set alarms | SQLite-backed on Free; "each individual Object is inherently single-threaded", about 1,000 req/s soft limit per object; 10 GB storage per object on Paid; CPU 30 s per request, up to 5 min (https://developers.cloudflare.com/durable-objects/platform/limits/) | one authoritative world or shard for the online Realm; a per-save sync mailbox |
| Queues | Reliable message queue between Workers with batching and retries | Free 10,000 ops/day; Paid 1 M ops/month then $0.40/M | buffer playtest events or AI jobs; not needed early |
| Cron Triggers | Run a Worker on a schedule | Free 5 per account, 10 ms CPU; Paid 250, 15 min CPU for hourly-or-slower crons | nightly report generation |
| Browser Rendering (`browser-run`) | A headless Chrome you drive from a Worker or a REST call: screenshots, PDFs, crawling, Playwright/Puppeteer sessions | Free 10 min/day, 3 concurrent; Paid 10 hours/month then $0.09/hour, 10 concurrent then $2 per extra (https://developers.cloudflare.com/browser-rendering/platform/pricing/) | automated Book screenshots at phone width; a remote browser for blind AI playtests |
| Workers for Platforms | Let your customers upload their own Workers that run isolated under your account | dispatch namespaces, per-tenant limits | a future "players run their own cartridge scripts" product; not now |

### Storage and data

| Service | Plain English | Key facts | Loka angle |
|---|---|---|---|
| D1 | A hosted SQLite database with HTTP and Worker access, backups and point-in-time restore | Free 5 GB, 5 M rows read and 100 k rows written per day; Paid 25 B reads and 50 M writes per month included | cloud copy of saves; the same SQLite dialect as `expo-sqlite` |
| KV | A global key-value cache: fast reads everywhere, writes take a moment to spread | Free 1 GB, 100 k reads/day, 1,000 writes/day | compiled cartridge artifacts by content hash; config |
| R2 | S3-compatible object storage with no egress fees | Free 10 GB and 1 M writes, 10 M reads per month; $0.015/GB-month after | artifacts, screenshots, contact sheets, playtest logs, Parquet reports |
| Basin Catalog (was R2 Data Catalog) | An Apache Iceberg table catalog on top of R2 so SQL engines (Spark, PyIceberg, DuckDB, Trino) can query files as tables | GA; `cf r2-data-catalog` and `cf basin-catalog` | the diagnostics warehouse behind dashboards |
| Hyperdrive | A connection pool and query cache so Workers can talk to an existing Postgres/MySQL quickly | Free 100 k queries/day | only if a BEAM Realm keeps Postgres and Workers need to read it |
| Vectorize | A vector database for similarity search over embeddings | Free 5 M stored and 30 M queried dimensions per month | lore memory for an AI DM; small |
| Basin Pipelines (was Pipelines) | Ingest event streams over HTTP or a binding, transform with SQL, land them in R2 as Iceberg or Parquet, exactly once | GA; Paid plan | the opt-in playtest log's landing path |
| K2 | A durable, ordered event log built on R2 (like Kafka, serverless): producers append, subscribers read at their own pace, records retained up to 30 days | public beta, Paid; 10 GB/account in beta; announced $0.04/GB produced and consumed, $0.02/GB-month retained (https://blog.cloudflare.com/cloudflare-k2-streams/) | an append-only receipt or event stream for a shared Realm; too new to depend on |
| Analytics Engine | Write small data points (up to 20 text blobs, 20 numbers, one index) from Workers; query with SQL; three-month retention; samples under load | 250 data points per invocation (https://developers.cloudflare.com/analytics/analytics-engine/limits/) | counters for refusals, page views, latency; not a warehouse |

### AI

| Service | Plain English | Key facts | Loka angle |
|---|---|---|---|
| Workers AI | Open-weight models (Llama, Mistral, embeddings, image, speech) served by Cloudflare, paid in "neurons" | 10,000 neurons/day free; $0.011 per 1,000 after; Llama 3.3 70B about $0.29 in / $2.25 out per million tokens (https://developers.cloudflare.com/workers-ai/platform/pricing/) | cheap embeddings and small classifiers; not the author of world content |
| AI Gateway | A proxy in front of any model provider (Anthropic included): caches identical requests, rate-limits, logs every call, tracks tokens and cost, retries and falls back | available on all plans (https://developers.cloudflare.com/ai-gateway/) | put Claude calls for the AI DM behind it from day one |
| AI Search | Crawl and index content, query it with AI relevance and chat completions | managed service | docs search; low |
| Agents SDK | A library for long-lived agents (on Durable Objects): own SQL state, WebSockets, schedules, tool and MCP calling, human approval steps (https://developers.cloudflare.com/agents/) | TypeScript | a hosted "DM agent" per world later |
| agent-memory, ai-audit, ai-security | memory store for agents; audit of AI crawlers hitting your site; prompt-injection and PII detection on AI traffic (`cf-help.txt`) | new | ai-security for the Realm's free-text moderation (trap 9) |

### Realtime and media

| Service | Plain English | Loka angle |
|---|---|---|
| Realtime | Audio, video and data channels (WebRTC) on the network | voice in the Realm, far future |
| Stream | Video upload, encoding, live streaming, player | trailers; low |
| Images | Store, resize and serve images with variants and signed URLs | screenshot galleries; low |

### Network and security

| Service | Plain English | Key facts | Loka angle |
|---|---|---|---|
| DNS, registrar | Host a domain's records; buy domains at cost | Free DNS | own `loka.*` domain; needed for Access and custom hostnames |
| CDN and cache | Serve static files from the edge; purge, tiered cache, cache reserve | Free | automatic for Workers static assets |
| WAF, rate limiting, firewall rules | Block attacks and abusive traffic by rule | Free basic rules; Pro adds managed rules | later, when public |
| Turnstile | A CAPTCHA replacement that checks for bots without puzzles; works on any site | see §3 (plan page) | protect a public sign-up or feedback form |
| Access (Zero Trust) | A login screen in front of any hostname or Worker (Google, GitHub, one-time email codes); logs every visit | Free tier for small teams (seat count unconfirmed, see §3); Access can protect all Workers in an account including version URLs (https://developers.cloudflare.com/workers/configuration/previews/) | the private preview for playtesters |
| Tunnels (cloudflared) | An outbound connection from your machine to Cloudflare so a local port gets a public hostname without opening inbound ports | Free | expose the M1's running web preview to a remote tester or to Browser Rendering |
| Waiting rooms, load balancers, Argo | queue visitors at peak; spread traffic across origins; faster routing | Paid | not needed |
| Secrets Store | Account-level secret storage bound into Workers | `cf secrets-store` | API keys for Claude behind AI Gateway |
| Client-side security, content scan, leaked-credential checks | monitor page scripts; scan uploads; flag breached passwords at login | security add-ons | Realm era |

### Observability and the rest

| Service | Plain English | Loka angle |
|---|---|---|
| Workers Logs, o11y, Logpush | per-invocation logs (Free 200 k events/day, 3-day retention; Paid 20 M/month, 7 days); the new observability suite; push logs to R2 or a vendor | debugging the preview host; Logpush to R2 for long retention |
| Analytics, speed (Observatory) | zone traffic analytics; scheduled Lighthouse runs | a Lighthouse score for the Book per deployment |
| Email routing, email sending, email security | receive mail to a domain and forward or handle in a Worker; send transactional mail; inbound threat filtering | playtest invites and one-time codes |
| Radar, intel, abuse reports, cloudforce-one | internet-wide traffic data; threat lookups | none |
| Workers VPC, cloud connector, magic network monitoring | private links to other clouds; route to cloud storage without an origin | none |
| Builds, previews, deploy, dev, init, migrate | Git-connected builds for Workers, per-branch previews, local dev server with simulated resources (`--local`), migrate a Wrangler project to `cf` | the delivery path for the preview host |

## 3. Fit for Loka, ranked

Loka today (facts): everything runs locally. The web preview is `npm run web:preview` on http://localhost:19006 (docs/web-preview.md); the browser save lives in origin-scoped OPFS (`:19`); hosted CI is GitHub Actions (docs/CHECKS.md); the online Realm authority is planned as BEAM/Phoenix and "not built yet" (docs/system/architecture.md `:6`, `:20`); the kernel is pure TypeScript with no I/O (architecture.md "TypeScript kernel"). Nothing in the repo mentions Cloudflare or any host.

Scale assumption for costs (opinion): one owner, two to ten playtesters, a few hundred sessions a month, tens of thousands of commands. Every figure below is "within the included allowance" unless stated.

| Rank | Use | Service(s) | Why it fits | Concrete use | Cost at our scale |
|---|---|---|---|---|---|
| **High** | Private hosting of the web Book, web preview and Storybook | Workers static assets + Workers Builds previews + Access | The Book is a static bundle plus the in-browser authority; static requests are free and unlimited; Access puts a login in front of every Worker including version URLs; per-branch previews let a reviewer or Fable open a PR's Book without the M1 running | `cf deploy` of `mobile/app`'s web build and the Storybook build; one Access policy (owner's and testers' emails, one-time codes); PR previews for UI polish review | $0 on Free (Access has a Free tier for small teams; none of the pages fetched for this study states the seat count, so confirm it on https://www.cloudflare.com/plans/zero-trust-services/ before inviting testers). $5/month if Workers Paid is wanted for CPU headroom |
| **High** | Claude calls for the AI DM behind a gateway | AI Gateway + Secrets Store | Caching identical prompts, rate limits, per-call logs and cost tracking are exactly the guardrails the AI study asked for (record the model's output, never re-call on replay); Anthropic is a supported provider | route every model call in the AI world-shaping experiments through one gateway; keep the API key in Secrets Store; export logs | AI Gateway on all plans; model tokens billed by Anthropic |
| **High** | Automated Book screenshots and blind AI playtests at phone width | Browser Rendering (sessions) | A hosted headless Chrome with Playwright drives the deployed preview; no local Chrome, reproducible viewport; the Fable playtest harness (balance study X8) and the contact sheet (`mobile/app/.walkthrough`) can run against the hosted Book | a Worker or Workflow that opens the preview, plays a script, screenshots each page to R2 | Free 10 min/day; Paid 10 hours/month included then $0.09/hour |
| **High** | Cloud copy and sync of saves | Durable Objects (one per save lineage) or D1 | The save is an append-only receipt log plus head and state rows (save.md "The save file"); replay rebuilds state from receipts, so sync is "append receipts, pull receipts" with no merge logic; a single-threaded object per lineage orders appends; strong consistency matches the fence/reconcile model | a `SaveSync` object keyed by `lineage_id`: POST receipts after each local commit; GET since revision N on another device; D1 for a queryable index across saves | Free: 100 k requests/day, 5 GB; a save of 5,000 receipts is a few MB |
| **High** | Opt-in playtest log and diagnostics warehouse | Basin Pipelines -> R2 (Iceberg) + Basin Catalog; Analytics Engine for counters | The log is `loka-obs-v1` JSON lines already; Pipelines ingests over HTTP, lands Parquet/Iceberg in R2; DuckDB or PyIceberg query it for the balance-study reports; Analytics Engine gives cheap live counters (refusals per code, pages shown) with SQL | the Book posts batched records to a Pipelines endpoint when the dev-panel toggle is on; nightly Cron Worker writes `docs/*.gen.json` inputs from the catalog | Paid plan ($5); R2 storage pennies; Pipelines usage small |
| **Med** | Offloading heavy checks (loka-2of) | Containers (standard-2/3) orchestrated by Workflows | Containers run any toolchain, so Node sim seed batches (`kernel/ts/test/sim_batch.ts`) and TS test shards fit; billed per 10 ms while running. Honest limits: Paid plan only; 4 vCPU and 12 GiB max per instance; the Elixir toolchain (`mix loka.compile`, ExUnit) needs a custom image with Erlang/Elixir; no GitHub-native status checks, so results must be posted back by a Worker; cold image pulls add minutes; GitHub Actions already gates merges (docs/CHECKS.md) | mutant sweeps (`bin/mutate.sh`) and 10,000-seed sim runs as fan-out Containers on a nightly or on-demand Workflow, results to R2 and a PR comment | 375 vCPU-minutes included; a 2-hour 4-vCPU sweep is 480 vCPU-min, about $0.13 over the allowance plus memory, so a few dollars a month |
| **Med** | The online Realm later | Durable Objects (one per world or shard) + WebSocket hibernation + Workflows | One object per world is single-threaded and strongly consistent, which is precisely what a deterministic kernel's "one authority decides in order" needs; the TS kernel is pure and already runs on Node and Hermes, so it would run in a Worker; hibernating WebSockets make idle players free. The honest conflict: the repo's Realm decision is BEAM/Phoenix (architecture.md), with Elixir compose twins already written; choosing Durable Objects is a change of platform, not an add-on. Soft limit about 1,000 requests/s per object is ample for one world | a `World` object holding `State` in SQLite rows, receipts appended, players on WebSockets, `elapsed` on alarms; K2 or R2 for the receipt archive | Free tier for a prototype; Paid at launch |
| **Med** | AI world-shaping loop | Workflows + AI Gateway + Vectorize | A Workflow step per stage (summarise region, call model, compile, simulate, gate, commit) with retries and saved results matches the A5 plan; Vectorize can hold lore embeddings for prompts. Limit: the compile step is Elixir, so it runs in a Container or the loop uses the TS loader only | the experiment-5 closed loop as one Workflow | included allowances; model tokens dominate |
| **Low** | Workers AI as the author model | Workers AI | cheap and close, but the AI studies assume Claude-class authoring; keep Workers AI for embeddings and classifiers | embeddings for Vectorize; a cheap "is this prose consistent with these bindings" check | 10 k neurons/day free |
| **Low** | Turnstile | Turnstile | only once there is a public form (feedback, sign-up) | guard a public playtest sign-up | Free: 20 widgets, 10 hostnames each |
| **Low** | Tunnels | cloudflared | exposes the M1's local preview to one remote tester without deploying; useful for a day, not a plan | ad-hoc owner session with a remote tester | Free |
| **Not useful now** | Stream, Images, Realtime, waiting rooms, load balancers, Argo, Workers for Platforms, Hyperdrive, email security, radar/intel | | no video, media, public traffic or multi-tenant code today | | |

## 4. What not to use, and why

Opinion, grounded in the repo's decisions.

| Do not | Why |
|---|---|
| Run game decisions anywhere the kernel is not pure | The kernel forbids I/O, clocks and randomness (architecture.md "TypeScript kernel"; `lint/rules/ts-kernel-pure.yml`). A Worker may *host* the kernel, but no Cloudflare binding (KV, AI, fetch) may be read inside a decision. The same determinism rule as the AI study: outside inputs enter as receipted commands. |
| Use KV as authority for anything ordered | KV is eventually consistent; two writes can race. Receipts, heads and world state need Durable Objects or D1 transactions. |
| Replace GitHub Actions as the merge gate | Hosted CI on the exact head is the gate by owner decision (docs/CHECKS.md, two-lane CI). Cloudflare has no native status-check integration; use Containers for *extra* long runs that post results back, not for the gate. |
| Move the Elixir compiler's role to Cloudflare | Containers can run Elixir, but the cross-kernel parity tests (`test/loka/cartridge_cross_kernel_test.exs`) belong with the repo's CI. A hosted compile service is only worth it for AI authoring loops later. |
| Decide the Realm platform by convenience | The BEAM/Phoenix decision stands in the architecture doc; Durable Objects are an excellent alternative but that is an owner decision with a record, not a side effect of hosting the preview. Prototype both against the same receipt contract first. |
| Depend on beta products for durable data | K2 is public beta with a 10 GB cap; Basin Pipelines and Catalog were renamed this year. Land the playtest log in plain R2 (JSON lines, then Parquet) so a rename or retirement costs nothing. |
| Put player words in any log | `obs.ts` redacts player words; keep that rule in every Pipeline, Analytics Engine point and AI Gateway log (ids and text keys only). |
| Buy Workers Paid before a use needs it | The preview, Access, Browser Rendering minutes, a sync object and a few K AI Gateway calls all fit the Free plan. Pay the $5 when Containers, Pipelines or CPU over 10 ms are actually used. |
| Lock the save format to a Cloudflare type | Sync carries the existing `loka-save-v1` rows and receipts as JSON; D1 or DO SQLite schemas mirror `store.ts:50`, never replace it. Export to R2 as plain files keeps the exit open. |

## 5. Adoption path

Opinion. Each step is small, reversible and useful on its own.

| Step | What | Unlocks | Monthly cost |
|---|---|---|---|
| 1 | Domain on Cloudflare DNS; deploy the web Book preview and Storybook as Workers static assets; one Access policy for the owner and testers; PR previews via Workers Builds | playtesters and Fable open a URL instead of the M1; UI review on a PR's own preview; the AI playtest per district without local Chrome | $0 (domain cost aside) |
| 2 | Browser Rendering script that plays a district walk on the deployed preview at phone width and stores screenshots and a contact sheet in R2 | the blind Fable playtest harness and the balance study's X8 run hosted and repeatable | $0 to $1 |
| 3 | AI Gateway in front of Claude for the AI world-shaping experiments; Secrets Store for keys; logs exported | cached, rate-limited, costed model calls; receipts of model outputs for replay | $0 plus tokens |
| 4 | Opt-in playtest log: Book posts `loka-obs-v1` records to a Pipelines endpoint; R2 Iceberg tables; Analytics Engine counters; a Cron Worker writes nightly report JSON | the balance-study dashboards (L4, L6) fed by humans, Fable and the simulator alike | $5 (Paid) plus pennies |
| 5 | Save sync: a Durable Object per lineage appending receipts; the Book pulls on open; D1 index | play on two devices; owner can inspect any tester's save by replay | included |
| 6 | Heavy runs: Containers on a Workflow for nightly mutant sweeps and 10,000-seed sims, results to R2 and a PR comment; then, only after a recorded owner decision, a Realm prototype as one Durable Object per world against the same receipt contract as the BEAM plan | loka-2of offload; a measured comparison for the Realm platform decision | $5 to $15 |

## 6. Learn more, in order

1. Workers overview and first Worker: https://developers.cloudflare.com/workers/get-started/guide/
2. Static assets and SPA hosting: https://developers.cloudflare.com/workers/static-assets/
3. Pricing and limits (read both once): https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/platform/limits/
4. Access in front of an app: https://developers.cloudflare.com/cloudflare-one/ (Applications, self-hosted) and version URLs with Access: https://developers.cloudflare.com/workers/configuration/previews/
5. Durable Objects: https://developers.cloudflare.com/durable-objects/ then its limits page, then the WebSocket hibernation guide under "Best practices"
6. Browser Rendering: https://developers.cloudflare.com/browser-rendering/ (Playwright guide and the pricing page)
7. AI Gateway get-started: https://developers.cloudflare.com/ai-gateway/
8. Workflows: https://developers.cloudflare.com/workflows/ and its limits page
9. Containers: https://developers.cloudflare.com/containers/ and pricing
10. Basin Pipelines and Catalog: https://developers.cloudflare.com/pipelines/ and https://developers.cloudflare.com/r2/data-catalog/
11. K2 announcement for context only: https://blog.cloudflare.com/cloudflare-k2-streams/
12. The `cf` CLI: `cf cli search "<task>"` then `<command> --help`; `cf dev --local` runs a project with simulated resources on the M1 before anything is deployed.
