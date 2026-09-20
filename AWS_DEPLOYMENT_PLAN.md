# AWS Deployment Plan — `site` on S3 + Daily Lambda Data Refresh

> **Note (Sept 2026):** this plan predates the `data_processing/` restructure and uses the original `mlb-r3k-*` resource names. Current reality: real resources are `roadto3000-*`; the daily job runs `data_processing/daily/` (`player_active_get_stats.py` per player + `league_active_get_stats.py`) via `lambda_handler.py`; S3 data keys are `stats_<Last><First>.json` and `stats_league.json` (not `latest_stats_<Last>.json`); the Dockerfile copies only `data_processing/daily/`; and CodeBuild syncs into `site/data/active/`. References below to `data_player_run_all.py` / `data_player_get_stats.py` mean those scripts.

Scoped to: (1) hosting the built [site](site) Next.js app on S3 at **`roadto3000.click`** (AWS account region **`us-east-2`**), and (2) a daily Lambda job that runs [data_player_run_all.py](data_player_run_all.py) → [data_player_get_stats.py](data_player_get_stats.py) to refresh the player JSON and get the new numbers live, on a schedule of **6:00 AM America/Chicago**.

## 0. Key Constraint: This Is a Statically Generated Site

[site](site) has no API routes and no server-side fetch — `getAllPlayers()` in [lib/players.ts](site/lib/players.ts) reads JSON off the **filesystem** ([site/data](site/data)) at **build time**, and [app/players/[slug]/page.tsx](site/app/players/[slug]/page.tsx) uses `generateStaticParams()` to pre-render one HTML page per player. There is no runtime data fetch to intercept.

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
│                         │  mlb-r3k-data into site/data,
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

- **AWS account/region** — confirmed: **`us-east-2`** for everything regional (S3 buckets, Lambda, CodeBuild, EventBridge Scheduler). One exception below.
- **Domain** — confirmed: **`roadto3000.click`**. CloudFront's ACM certificate must be requested in **`us-east-1`** regardless of the `us-east-2` app region — this is a hard CloudFront requirement, not a choice. Everything else (S3, Lambda, CodeBuild, Route 53 hosted zone) stays in `us-east-2`.
- **IAM** — I'll need permission to create: S3 buckets, an EventBridge Scheduler rule, a Lambda function + execution role, a CodeBuild project + service role, a CloudFront distribution, an ACM cert (`us-east-1`), and a Route 53 hosted zone + records for `roadto3000.click`. All of this is new/standing infrastructure and billable — I will not create any of it without you confirming scope first.
- **AWS CLI access** — the commands below assume `aws` is installed and `aws sts get-caller-identity` already resolves to the target account.

## 3. Phase 1 — Make `site` Static-Export-Ready ✅ Done

`site/next.config.ts` now has `output: "export"` and `images: { unoptimized: true }`. `npm run build` was run locally and confirmed a clean static export — `out/` contains `index.html`, one `.html` per player (`players/altuve.html`, etc.), and no server-only routes. No further app code changes needed for this phase.

**Note for §6 below:** the export produces `players/altuve.html` as a *file*, not `players/altuve/index.html` — this matters for how CloudFront resolves extensionless URLs.

## 4. Phase 2 — S3 Buckets: Detailed Setup

Two buckets, both fully private (no static-website-hosting endpoint, no public ACLs) — the data bucket is read/written only by Lambda/CodeBuild, and the site bucket is only ever read by CloudFront via Origin Access Control (OAC).

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-2
DATA_BUCKET="mlb-r3k-data-${ACCOUNT_ID}"
SITE_BUCKET="mlb-r3k-site-${ACCOUNT_ID}"
# Bucket names are globally unique across all of S3 — the account-ID suffix avoids collisions.

# --- data bucket ---
aws s3api create-bucket --bucket "$DATA_BUCKET" --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"
aws s3api put-public-access-block --bucket "$DATA_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket "$DATA_BUCKET" \
  --versioning-configuration Status=Enabled   # cheap insurance if a bad API response ever overwrites a good snapshot
aws s3api put-bucket-encryption --bucket "$DATA_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# --- site bucket ---
aws s3api create-bucket --bucket "$SITE_BUCKET" --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"
aws s3api put-public-access-block --bucket "$SITE_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

**Bucket layout:**
- `s3://$DATA_BUCKET/latest_stats_<LastName>.json` — current snapshot per player (what CodeBuild pulls down).
- `s3://$DATA_BUCKET/history/<YYYY-MM-DD>/latest_stats_<LastName>.json` — dated copy, written alongside the "latest" one each run.
- `s3://$SITE_BUCKET/` — the synced `out/` tree, root = `index.html`.

CloudFront/OAC wiring for `$SITE_BUCKET` is covered in §6, since the bucket policy needs the distribution's ARN, which doesn't exist until the distribution is created.

## 5. Phase 3 — `stats-refresh` Lambda: Detailed Setup

**Packaging — container image** (simplest given `statsapi` + `pandas`, and Lambda's zip/layer size limits):

`data_player_get_stats.py` currently writes its output to a local file (`site/data/latest_stats_<LastName>.json` — see [data_player_get_stats.py:268-271](data_player_get_stats.py:268)). Lambda's filesystem is ephemeral and gone after each invocation, so **this needs a code change** before it can run in Lambda: swap the local `open(...).write` for a `boto3` `s3.put_object(Bucket=DATA_BUCKET, Key=f"latest_stats_{player_lastName}.json", Body=...)` call (plus a second `put_object` under `history/<date>/...`). Flag if you want me to make that change now — it's a small, contained edit to the script's last ~10 lines.

**Dockerfile** (place at repo root or in a new `lambda/` folder):

```dockerfile
FROM public.ecr.aws/lambda/python:3.12

COPY data_player_get_stats.py data_player_run_all.py ${LAMBDA_TASK_ROOT}/
COPY lambda_handler.py ${LAMBDA_TASK_ROOT}/
RUN pip install statsapi boto3 --target "${LAMBDA_TASK_ROOT}"
# numpy/pandas were already unused/commented out in data_player_get_stats.py —
# leave them out of the image unless a future feature needs them, to keep cold starts fast.

CMD ["lambda_handler.handler"]
```

`lambda_handler.py` is a new thin wrapper — call each player's stats function in-process per player ID (looping over the same `player_ids` list currently in [data_player_run_all.py](data_player_run_all.py)) rather than `subprocess.run`-ing a separate script per player, since Lambda's constrained runtime doesn't need the process-isolation `data_player_run_all.py` currently uses for local runs. Collect failures into a list and raise at the end so a partial failure surfaces as a Lambda error, not a silent partial success (today's `data_player_run_all.py:22-28` just prints and continues).

**Build and push:**

```bash
aws ecr create-repository --repository-name mlb-r3k-stats-refresh --region "$REGION"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

docker build -t mlb-r3k-stats-refresh .
docker tag mlb-r3k-stats-refresh:latest \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/mlb-r3k-stats-refresh:latest"
docker push "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/mlb-r3k-stats-refresh:latest"
```

**IAM execution role** — trust policy (who can assume the role):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

Permissions policy (what the role can do — scoped tightly, not `s3:*`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::mlb-r3k-data-ACCOUNT_ID/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:ACCOUNT_ID:*"
    },
    {
      "Effect": "Allow",
      "Action": "codebuild:StartBuild",
      "Resource": "arn:aws:codebuild:*:ACCOUNT_ID:project/site-build"
    }
  ]
}
```

(The `codebuild:StartBuild` statement is only needed once §7's CodeBuild project exists and the Lambda is wired to trigger it directly — add it at that point rather than up front if you'd rather keep the two phases fully separate.)

```bash
aws iam create-role --role-name mlb-r3k-stats-refresh-role \
  --assume-role-policy-document file://trust-policy.json
aws iam put-role-policy --role-name mlb-r3k-stats-refresh-role \
  --policy-name mlb-r3k-stats-refresh-permissions \
  --policy-document file://permissions-policy.json
```

**Create the function:**

```bash
aws lambda create-function \
  --function-name mlb-r3k-stats-refresh \
  --package-type Image \
  --code ImageUri="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/mlb-r3k-stats-refresh:latest" \
  --role "arn:aws:iam::${ACCOUNT_ID}:role/mlb-r3k-stats-refresh-role" \
  --timeout 300 \
  --memory-size 512 \
  --environment "Variables={DATA_BUCKET=$DATA_BUCKET}"
```

`--timeout 300` (5 min) because `data_player_get_stats.py` pulls a full career game log per player (one API call per season since MLB debut) — for a long-tenured player that's a dozen-plus sequential HTTP calls to `statsapi.mlb.com` before the JSON is even computed. Watch actual invoke duration in CloudWatch after the first few real runs and tune from there.

**Test it:**

```bash
aws lambda invoke --function-name mlb-r3k-stats-refresh out.json && cat out.json
aws s3 ls "s3://$DATA_BUCKET/"
```

## 6. Phase 4 — `site-build` CodeBuild Project (the rebuild/deploy job)

Triggered by the data Lambda on success (`boto3` `codebuild.start_build()` call at the end of the Lambda — simplest option, avoids extra S3-event wiring).

Buildspec, roughly:
1. `aws s3 sync s3://mlb-r3k-data/ site/data/ --delete` (pull the JSON the Lambda just wrote)
2. `cd site && npm ci && npm run build`
3. `aws s3 sync ./out s3://mlb-r3k-site --delete`
4. `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"`

**IAM:** CodeBuild service role scoped to read `mlb-r3k-data`, write `mlb-r3k-site`, and CloudFront invalidation on the one distribution.

## 7. Phase 5 — Hosting: S3 + CloudFront, Detailed Setup

- `$SITE_BUCKET` stays fully private (already set in §4) — served exclusively through CloudFront via Origin Access Control, never through S3's public website-hosting endpoint. This is the current AWS-recommended pattern and gets free HTTPS.
- Easiest path is the CloudFront console for the distribution itself (it wires the OAC + bucket policy for you in one flow):
  1. CloudFront → Create Distribution → Origin domain: pick `$SITE_BUCKET` from the S3 list → Origin access: "Origin access control settings (recommended)" → create a new OAC.
  2. CloudFront will show a bucket policy snippet scoped to that OAC's principal — accept it (it pastes onto `$SITE_BUCKET`'s bucket policy automatically, or copy it into `aws s3api put-bucket-policy` if doing this by hand).
  3. Default root object: `index.html`.
  4. Viewer protocol policy: Redirect HTTP to HTTPS.
- **Routing gotcha specific to this export:** confirmed from the actual `out/` build (§3) — `next build` with `output: "export"` writes `players/altuve.html` as a *file*, not `players/altuve/index.html`. S3's own website-hosting endpoint auto-appends `.html` to extensionless requests, but a private bucket behind CloudFront/OAC does **not** — a request for `/players/altuve` will 403/404 unless something rewrites it. Fix: attach a CloudFront Function (viewer-request, essentially free) that appends `.html` to any request URI with no file extension before it hits the origin. This needs to be in place before the multi-page nav (`PlayerCard` → `/players/<slug>` links) will work through CloudFront — worth testing directly against a couple of player URLs once the distribution is up, before calling hosting done.

### Domain: `roadto3000.click`

1. **ACM certificate — must be requested in `us-east-1`**, even though everything else is in `us-east-2` (CloudFront only accepts certs from that region):
   ```bash
   aws acm request-certificate \
     --domain-name roadto3000.click \
     --subject-alternative-names www.roadto3000.click \
     --validation-method DNS \
     --region us-east-1
   ```
   Covering both the apex (`roadto3000.click`) and `www` in one cert now avoids a second request later if a `www` redirect is wanted.
2. **Route 53 hosted zone** (in `us-east-2`, hosted zones aren't region-pinned the way most resources are — this is just where the CLI call runs from):
   ```bash
   aws route53 create-hosted-zone --name roadto3000.click --caller-reference "$(date +%s)"
   ```
   Note the four `NS` records Route 53 assigns — if the domain is registered anywhere other than Route 53, those four values need to be set as the domain's nameservers at the original registrar (see Open Question 2). Skip this step if the domain is already in Route 53.
3. **DNS-validate the cert**: `aws acm describe-certificate` returns a CNAME record ACM needs to see in the hosted zone; add it via `aws route53 change-resource-record-sets`, then wait for `acm describe-certificate` to report `ISSUED` before continuing (can take a few minutes up to a few hours).
4. **Attach the domain to the CloudFront distribution**: set `roadto3000.click` and `www.roadto3000.click` as Alternate Domain Names (CNAMEs) on the distribution, and select the `us-east-1` ACM cert from step 1 as its custom SSL certificate.
5. **Point DNS at CloudFront** — alias records in the `roadto3000.click` hosted zone (alias, not a plain CNAME, since this is the zone apex):
   ```bash
   # Target: the distribution's *.cloudfront.net domain name, and CloudFront's
   # fixed hosted-zone ID Z2FDTNDATAQYW2 (same for every CloudFront distribution).
   aws route53 change-resource-record-sets --hosted-zone-id <ZONE_ID> --change-batch '{
     "Changes": [{
       "Action": "UPSERT",
       "ResourceRecordSet": {
         "Name": "roadto3000.click",
         "Type": "A",
         "AliasTarget": {
           "HostedZoneId": "Z2FDTNDATAQYW2",
           "DNSName": "<distribution-id>.cloudfront.net",
           "EvaluateTargetHealth": false
         }
       }
     }]
   }'
   ```
   Repeat for `www.roadto3000.click` (or instead redirect `www` → apex with a second, minimal CloudFront distribution — the single-distribution dual-alias approach above is simpler for a site this size).

## 8. Phase 6 — Scheduling

- **EventBridge Scheduler**, cron expression, timezone set explicitly to `America/Chicago` (not a fixed UTC offset) — this way "6:00 AM" stays correct across the CST/CDT switch instead of drifting an hour twice a year. See Open Question 1 on whether you actually want the DST-following local time or a fixed UTC-6.

```bash
aws scheduler create-schedule \
  --name mlb-r3k-daily-refresh \
  --schedule-expression "cron(0 6 * * ? *)" \
  --schedule-expression-timezone "America/Chicago" \
  --flexible-time-window '{"Mode": "OFF"}' \
  --target "{\"Arn\": \"arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:mlb-r3k-stats-refresh\", \"RoleArn\": \"arn:aws:iam::${ACCOUNT_ID}:role/mlb-r3k-scheduler-invoke-role\"}"
```

(`mlb-r3k-scheduler-invoke-role` is a small role trusted by `scheduler.amazonaws.com` with a single `lambda:InvokeFunction` permission on `mlb-r3k-stats-refresh` — separate from the Lambda's own execution role above.)

- Target: the `stats-refresh` Lambda directly.
- One schedule is enough; the Lambda → CodeBuild handoff happens inside the Lambda's own success path, not as a second scheduled trigger.

## 9. Monitoring & Alerting

- CloudWatch Alarm on `stats-refresh` Lambda errors/throttles → SNS → email.
- CloudWatch Alarm on `site-build` CodeBuild failed builds → same SNS topic.
- Optional: a "staleness" alarm — if `mlb-r3k-data`'s newest object age exceeds ~30 hours, something silently broke upstream (e.g., MLB Stats API schema change) even if the Lambda itself reported success.

## 10. Build Order

1. ~~Add `output: "export"` + `images.unoptimized` to `site`~~ — done (§3).
2. Create `mlb-r3k-data` and `mlb-r3k-site` S3 buckets per §4 (no public access on either).
3. Change `data_player_get_stats.py`'s output step from local file write to S3 `put_object` (pending your confirmation, §5).
4. Build and test the Lambda container image locally (`docker run` against the Lambda runtime interface emulator) before deploying.
5. Deploy the Lambda + execution role (§5); do one manual invoke, confirm JSON lands in `mlb-r3k-data`.
6. Create the CodeBuild project + service role (§6); wire the buildspec; do one manual build, confirm `out/` lands in `mlb-r3k-site`.
7. Set up CloudFront (OAC + distribution + the extensionless-URL CloudFront Function) in front of `mlb-r3k-site` (§7); confirm both `/` and a couple of `/players/<slug>` URLs load over HTTPS on the `*.cloudfront.net` domain first.
8. Request the ACM cert in `us-east-1`, create/verify the Route 53 hosted zone for `roadto3000.click`, attach both as CloudFront alternate domain names, point DNS at the distribution (§7 "Domain" steps). Confirm `https://roadto3000.click` loads.
9. Wire Lambda → CodeBuild trigger on success; do one full manual end-to-end run.
10. Create the EventBridge Scheduler rule (§8, disabled at first); enable once step 9 is verified.
11. Add CloudWatch Alarms + SNS topic; send a test alarm to confirm delivery.

## Open Questions

1. **"6am CST"** — recommend `America/Chicago` in EventBridge Scheduler (DST-aware) over a fixed UTC-6 offset. Confirm that's what you meant.
2. **Is `roadto3000.click` already registered, and if so where?** Registered in Route 53 already → skip hosted-zone creation, otherwise create the hosted zone and switch the domain's nameservers at whatever registrar currently holds it. If it isn't registered at all yet, it can be registered directly through Route 53 (`aws route53domains register-domain`) as an added first step.
3. **Rebuild-per-day vs. runtime fetch** — §0 above locks in a rebuild-and-redeploy pipeline to match the site's current fully-static architecture with zero app code changes. The alternative is converting `PlayerHeader`/`PageIndex` etc. to fetch JSON client-side (or via ISR if you move off pure static export) directly from `mlb-r3k-data`/CloudFront at request time, which would let the Lambda skip the CodeBuild step entirely and write straight to a public data endpoint. That's a real app-architecture change (loses the "read fs at build time" simplicity, adds a loading state), so flagging it rather than assuming — happy to go either way.
