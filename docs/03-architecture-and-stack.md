# 03 — Architecture & Tech Stack

Selection rule: **hireable in Dhaka, cheap on low-end Android, cheap on bandwidth,
boring where it can be, fast where it must be.** Two backend languages maximum.

---

## 1. Decisions, with the alternative we rejected

| Layer | Choice | Why here | Rejected |
|---|---|---|---|
| Android (flagship) | **Kotlin + Jetpack Compose + Media3/ExoPlayer** | ~95% of the market is Android, much of it 2GB RAM. A TikTok-grade feed needs player pooling, prefetch windows, surface recycling and precise memory control — that lives in native code | Flutter/RN: frame pacing and codec control on cheap devices, plus app-size cost |
| Shared logic | **Kotlin Multiplatform** (models, networking, ledger math, flags, analytics) | One implementation of money and API contracts across Android/iOS | Duplicating business rules per platform |
| iOS (phase 2) | **Swift + AVFoundation** over the KMP core | Small user base, disproportionately high AOV + diaspora | — |
| Web | **Next.js + TypeScript** (public feed, SEO pages, Seller Center, Studio, Ads Manager, admin) | SSR for product/creator SEO; one stack for five consoles; deepest local hiring pool | Separate SPA per console |
| Hot-path services | **Go** (gateway/BFF, feed, upload orchestration, chat, notifications, live signalling, counters) | Fan-out concurrency, small memory footprint, static binaries, fast to hire for and to operate | JVM (memory cost), Node (CPU-bound ranking glue) |
| ML | **Python** — PyTorch training, ONNX/Triton serving behind a Go shim | Where the ecosystem actually is | — |
| System of record | **PostgreSQL** (CloudNativePG), partitioned; catalog, orders, ledger, identity | Transactions and correctness where money lives | NoSQL for orders — never |
| High-volume store | **ScyllaDB** — social graph, watch history, counters, DM, notification inbox | Predictable p99 at high write rates, cheap per node | Cassandra (JVM ops overhead) |
| Cache / realtime | **Redis** (or Dragonfly) | Sessions, rate limits, dedup, hot counters | — |
| Event backbone | **Kafka (Redpanda)** | Every impression, play, click, order and ledger entry is an event | RabbitMQ (wrong shape) |
| Analytics | **ClickHouse** | Creator/seller/ads dashboards and funnels over billions of rows | Warehouse-only (too slow, too costly) |
| Search | **OpenSearch** with a Bangla analyser + Banglish transliteration | People type "kacchi" and "কাচ্চি" for the same thing; both must return the same results | Postgres FTS (no Bangla depth) |
| Vectors | **Qdrant** | Two-tower retrieval, near-duplicate detection, moderation similarity | pgvector at feed scale |
| Object storage | **MinIO** in-country + S3-compatible cloud tier | Data residency, egress cost, BDIX proximity | Cloud-only (FX + egress) |
| Orchestration | **Kubernetes + Terraform + ArgoCD** | Standard, portable across the hybrid footprint | Bespoke VM management |
| Observability | **OpenTelemetry → Prometheus/Grafana/Loki/Tempo**, Sentry | One trace from tap to ledger entry | — |

## 2. Service map

```
                         ┌── CDN / BDIX on-net caches ──┐
   Android · iOS · Web ──┤                              ├── video segments, images
                         └────────── API gateway (Go) ──┘
                                        │
   ┌───────────┬───────────┬────────────┼───────────┬────────────┬───────────┐
 feed-bff   create-svc   shop-svc    order-svc   live-svc    ads-svc    trust-svc
   │           │            │            │           │           │          │
 ranking   upload/       catalog      ledger      RTMP/SRT    auction   moderation
 retrieval transcode     inventory    escrow      LL-HLS      pacing    appeals
 (Python/  (ffmpeg       promo        payouts     gifting     pixel     enforcement
  Triton)   workers)     search       couriers    co-host     reports   Nirapod
   └───────────┴───────────┴────────── Kafka ─────┴───────────┴──────────┘
                    │             │              │
              PostgreSQL      ScyllaDB       ClickHouse / Qdrant / OpenSearch
```

## 3. Video pipeline — where the money is spent

**Ingest** → resumable chunked upload (tus) straight to object storage; the API only sees a
handle. **Transcode** → ffmpeg worker pool: per-title encoding, ABR ladder
240/360/480/720/1080, H.264 baseline for reach with an AV1 rung for capable devices,
CMAF/LL-HLS packaging, sprite thumbnails, loudness normalisation, perceptual hash for
dedup and moderation.

Three rules that decide the unit economics:

1. **480p is the default rung on cellular.** Not 720p. Bandwidth is simultaneously our
   largest variable cost and our users' largest complaint.
2. **BDIX peering and on-net ISP caches before any code optimisation.** Domestic peered
   delivery in Bangladesh is dramatically cheaper and faster than international transit.
   This is the single highest-leverage infrastructure decision in the plan.
3. **Tier cold content.** Most videos are dead after 72 hours; move them to cheap storage
   and drop the top rungs of their ladder.

**LIVE**: RTMP/SRT ingest → LL-HLS out (5–8s glass-to-glass) for the audience at scale;
WebRTC (LiveKit/mediasoup) only for co-host and PK battles, where latency actually matters.

## 4. Ranking

**Retrieval** (multi-channel, ~1000 candidates): two-tower ANN over Qdrant · follow graph ·
trending pool · geo/locale · **fresh-content audition pool** · product-affinity channel.

**Ranking** (multi-task, MMoE-style): predicts p(finish), p(like), p(comment), p(share),
p(follow), p(product-click), p(purchase); combined with tunable weights plus diversity,
fatigue and creator-cap constraints.

**Cold start is a contract, not an accident.** Every new video receives a guaranteed
audition of N impressions to a matched audience. If that promise breaks, supply leaves.

**Ads never merge into organic scoring.** Separate auction, capped density, labelled.

## 5. Money: the ledger

A double-entry, append-only journal in PostgreSQL is the spine of BDOS Shop.
Accounts: buyer, seller, escrow, commission-payable, gift-liability, platform-revenue,
courier-payable, tax-withheld. Every order, refund, commission accrual, gift and payout is a
balanced entry with an idempotency key. Nightly reconciliation against gateway, MFS and
courier settlement files; any drift pages a human.

Commission accrues at delivery, clears when the return window closes, then becomes
withdrawable. That hold period is a legal and financial requirement — and it must be shown
plainly in the creator's app, or they will assume they are being cheated.

## 6. Environments and rollout

Local (docker-compose) → staging (full stack, synthetic traffic) → canary (internal + 1%) →
production. Feature flags with per-surface kill switches. Every ranking change ships behind
an experiment with pre-registered metrics; watch-time-only wins are rejected if retention or
report-rate regresses.
