# AWS Deployment Plan — site_prod on S3 + Daily Lambda Data Refresh

Scoped to: (1) hosting the built [site](site) Next.js app on S3, and (2) a daily Lambda job that runs [data_player_run_all.py](data_player_run_all.py) → [data_player_get_stats.py](data_player_get_stats.py) to refresh the player JSON and get the new numbers live, on a schedule of **6:00 AM America/Chicago**

## 0. Key Constraint: This Is a Statically Generated Site

[site](site) has no API routes and no server-side fetch — `getAllPlayers()` in [lib/players.ts](site_prod/lib/players.ts) reads JSON off the **filesystem** ([site/data](site/data)) at **build time**, and [app/players/[slug]/page.tsx](site/app/players/[slug]/page.tsx) uses `generateStaticParams()` to pre-render one HTML page per player. There is no runtime data fetch to intercept.

Practical effect: **S3 alone cannot pick up new stats.** Dropping a fresh JSON file into the S3 bucket does nothing — the HTML/JS already served has the old numbers baked in. Getting new numbers live means: refresh JSON → `next build` → re-sync the new `out/` to S3. This drives the two-Lambda-like pipeline below (data job + build/deploy job), rather than a single Lambda writing JSON straight into the hosting bucket.

This is a deliberate recommendation to avoid rewriting the app to fetch client-side — flag if you'd rather go that route instead (see Open Question 2).

## 1. Target Architecture

```
EventBridge Scheduler (cron, America/Chicago, 6:00 AM daily)
        │
        ▼
┌───────────────────────────┐
│ Lambda: stats-refresh     │  Python 3.12, container image
│ runs data_player_run_all  │  (statsapi + pandas)
│  .py → data_player_get_   │ 
│  stats.py per player      │
│ writes JSON to S3 bucket  │
│  "mlb-r3k-data" (source   │
│  of truth for the site's  │
│  /data folder)            │
└──────────────┬────────────┘
               │ on success (S3 event or direct SDK call)
               ▼
┌─────────────────────────┐
│ CodeBuild: site-build   │  pulls repo, pulls fresh JSON from
│                         │  mlb-r3k-data into site_prod/data,
│                         │  npm ci && npm run build
│                         │  (next.config: output: "export")
│                         │  aws s3 sync ./out s3://mlb-r3k-site --delete
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────┐
│ CloudFront distribution │  fronts the site bucket: HTTPS, custom
│  → S3 "mlb-r3k-site"    │  domain, cache invalidation on deploy
└─────────────────────────┘
```

Two S3 buckets, two jobs, one schedule:
- **`mlb-r3k-data`** — private bucket, just the daily JSON snapshots + a `history/` prefix (dated copies, for a future time-series feature and as an audit trail if a bad API response ever corrupts a day's numbers).
- **`mlb-r3k-site`** — the static site output (`out/`), fronted by CloudFront, this is what the public hits.

## 2. Prerequisites / Decisions Needed From You

Before infra work starts:

- **AWS account** — confirm which account/region this deploys into (assume `us-east-1` unless you have a preference; CloudFront needs ACM certs in `us-east-1` regardless of where else you deploy).
- **IAM** — I'll need permission to create: S3 buckets, an EventBridge Scheduler rule, a Lambda function + execution role, a CodeBuild project + service role, and (if you want a custom domain/HTTPS) a CloudFront distribution + ACM cert + Route 53 record. All of this is new/standing infrastructure and billable — I will not create any of it without you confirming scope first.

## 3. Phase 1 — Make `site` Static-Export-Ready

- Confirm `npm run build` produces a self-contained `out/` directory with no server dependency (no API routes exist today, so this should be a clean export — verify with a local build once the config change lands).
- No other code changes expected; `getAllPlayers()` already reads from the filesystem at build time, which is exactly what static export wants.

## 4. Phase 2 — `stats-refresh` Lambda (the data job)

**Packaging:** [data_player_get_stats.py](data_player_get_stats.py)

- Package as a **container-image Lambda** or a zip + layer if the trimmed dependency set is small enough.
- **Code change needed:** Lambda's filesystem is ephemeral anyway. This needs to become an S3 `put_object` call to `mlb-r3k-data/latest_stats_<lastName>.json` (plus a dated copy under `history/`) instead of a local file write.
- [data_player_run_all.py](data_player_run_all.py) shells out via `subprocess.run` per player — that's fine to keep as-is as the Lambda entry point's orchestration logic, just needs a thin Lambda handler wrapper (or fold the loop directly into the handler; subprocess-per-player inside one Lambda invocation works but consider just calling the stats function directly in-process to avoid subprocess overhead in a constrained Lambda runtime).
- **IAM:** execution role scoped to `s3:PutObject` on `mlb-r3k-data/*` only, plus CloudWatch Logs.
- **Failure handling:** the existing failed-players list ([data_player_run_all.py:22-28](data_player_run_all.py:22)) should raise/exit non-zero so a CloudWatch Alarm can catch it — right now it just prints. Route Lambda failures to an SNS topic → email, so a broken MLB Stats API response or a 3rd-party rate limit doesn't fail silently for days.

## 5. Phase 3 — `site-build` CodeBuild Project (the rebuild/deploy job)

Triggered by the data Lambda on success (`boto3` `codebuild.start_build()` call at the end of the Lambda, simplest option — avoids extra S3-event wiring).

Buildspec, roughly:
1. `aws s3 sync s3://mlb-r3k-data/ site_prod/data/ --delete` (pull the JSON the Lambda just wrote)
2. `cd site_prod && npm ci && npm run build`
3. `aws s3 sync ./out s3://mlb-r3k-site --delete`
4. `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"`

**IAM:** CodeBuild service role scoped to read `mlb-r3k-data`, write `mlb-r3k-site`, and CloudFront invalidation on the one distribution.

## 6. Phase 4 — Hosting: S3 + CloudFront

- `mlb-r3k-site` bucket: block all public access, **not** configured for static website hosting directly — serve exclusively through CloudFront using an Origin Access Control, so the bucket itself stays private. This is the current AWS-recommended pattern (replaces the older public-bucket-website-endpoint approach) and gets you free HTTPS.
- ACM cert (in `us-east-1`) for a custom domain if you have one; otherwise ship on the default `*.cloudfront.net` domain first and add the domain later without re-architecting anything.
- Route 53 record → CloudFront, if/when a domain is attached.

## 7. Phase 5 — Scheduling

- **EventBridge Scheduler**, cron expression, timezone set explicitly to `America/Chicago` (not a fixed UTC offset) — this way "6:00 AM" stays correct across the CST/CDT switch instead of drifting an hour twice a year. See Open Question 1 on whether you actually want the DST-following local time or a fixed UTC-6.
- Target: the `stats-refresh` Lambda directly.
- One schedule is enough; the Lambda → CodeBuild handoff happens inside the Lambda's own success path, not as a second scheduled trigger.

## 8. Monitoring & Alerting

- CloudWatch Alarm on `stats-refresh` Lambda errors/throttles → SNS → email.
- CloudWatch Alarm on `site-build` CodeBuild failed builds → same SNS topic.
- Optional: a "staleness" alarm — if `mlb-r3k-data`'s newest object age exceeds ~30 hours, something silently broke upstream (e.g., MLB Stats API schema change) even if the Lambda itself reported success.

## 9. Build Order

1. Add `output: "export"` + `images.unoptimized` to `site_prod`; verify `npm run build` produces a working `out/` locally, sanity-check by opening the exported HTML.
2. Create `mlb-r3k-data` and `mlb-r3k-site` S3 buckets (no public access on either).
3. Trim unused imports in [data_player_get_stats.py](data_player_get_stats.py) (pending your confirmation) and change its output step from local file write to S3 `put_object`.
4. Build and test the Lambda container image locally (`docker run` against the Lambda runtime interface emulator) before deploying.
5. Deploy the Lambda + execution role; do one manual invoke, confirm JSON lands in `mlb-r3k-data`.
6. Create the CodeBuild project + service role; wire the buildspec; do one manual build, confirm `out/` lands in `mlb-r3k-site`.
7. Set up CloudFront (OAC + distribution) in front of `mlb-r3k-site`; confirm the site loads over HTTPS.
8. Wire Lambda → CodeBuild trigger on success; do one full manual end-to-end run.
9. Create the EventBridge Scheduler rule (6:00 AM America/Chicago, disabled at first); enable once step 8 is verified.
10. Add CloudWatch Alarms + SNS topic; send a test alarm to confirm delivery.
11. (Optional) Attach a custom domain via ACM + Route 53.

## Open Questions

1. **"6am CST"** — did you mean the fixed UTC-6 offset year-round, or 6 AM local Central time (which is CDT, UTC-5, during most of the MLB season, late March–early November)? Recommend the latter (`America/Chicago` in EventBridge Scheduler) since "6am" almost certainly means "6am wall-clock time for me," not "6am UTC-6 specifically" — but confirm.
2. **Rebuild-per-day vs. runtime fetch** — §0 above locks in a rebuild-and-redeploy pipeline to match the site's current fully-static architecture with zero app code changes. The alternative is converting `PlayerHeader`/`PageIndex` etc. to fetch JSON client-side (or via ISR if you move off pure static export) directly from `mlb-r3k-data`/CloudFront at request time, which would let the Lambda skip the CodeBuild step entirely and write straight to a public data endpoint. That's a real app-architecture change (loses the "read fs at build time" simplicity, adds a loading state), so flagging it rather than assuming — happy to go either way.
3. **`site_dev`** — this plan only covers `site_prod`. Let me know if `site_dev` needs its own (presumably lower-traffic / no-schedule) deployment too, or if it's meant to stay local-only.
