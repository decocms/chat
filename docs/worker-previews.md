# Worker Previews deployment preparation

Status: **blocked, intentionally not deployable**. The `.example.jsonc` fragments under `docs/worker-previews/` prepare the configuration for review in PR #1. Both runtime Wrangler configurations remain byte-for-byte unchanged. Every `<REPLACE_ME>` must be confirmed by the resource owner. Wrangler 4.152.0 rejects those exact placeholders. No resources, secrets, deployments, or Workers Builds settings were changed during this investigation.

## Evidence

Project-room messages #2535/#2536 attach the main/site Workers Builds logs at head `366450e`; #2537 diagnoses the failure and #2561 confirms it remains relevant. Both builds completed, then `wrangler preview` rejected missing `previews` configuration. The main log additionally warns that its proposed snippet omits Durable Objects. Those logs are not committed. Newer builds cited in #2561 were not inspected. Room #2563 asks @gadr90 and @guilherme for nonproduction resource metadata or a different deploy-command decision; it does not request secrets.

Pinned source inspected: `wrangler@4.152.0`, `config-schema.json` → `PreviewsConfig`, and `wrangler-dist/cli.js` → `ensurePreviewsConfig`, `containsGeneratedPlaceholder`, and the preview command. Unlike a dry run, that command authenticates, can consult Preview Base settings, bundles, and deploys. Do not invoke it as an offline configuration check.

## Resource decisions

| Setting | Proposed preview behavior | Remaining owner input |
| --- | --- | --- |
| DB / OAUTH_KV / FILES | Explicit independent D1/KV/R2 binding; no production ID copied | Existing separate database ID, KV ID, bucket name; database schema initialization |
| BOOK / DOC_ROOMS / PEOPLE | Same local exported classes, no `script_name`; existing top-level migrations retained | Confirm platform Preview support and isolated namespace creation on actual deployment |
| Four rate limits | Same limits, separately allocated namespace IDs | Four IDs distinct from production and appropriate for shared staging |
| EMAIL | Restrict binding to one verified sandbox recipient | Recipient; other login destinations will not work in this restricted preview |
| AI / model vars | Explicit Workers AI binding, existing model choices; Judge disabled | Approve paid preview usage and independently scoped provider credentials |
| Reporting vars | Empty room lists; no production issue/report room configured | None for the restricted preview |
| SITE | Omitted; existing main-worker static landing fallback applies | Dedicated staging service if CMS landing parity is needed |
| Site deco vars | Neither production site nor environment copied | Confirm isolated deco site/environment and preview credentials; merely naming an environment does not provision one |
| Placement | Existing top-level `aws:us-east-1` placement retained | Reconsider only if the staging database is elsewhere |
| Secrets | No production values or local development files copied | Fresh `SESSION_SECRET`; scoped provider/OAuth credentials only as needed; restricted OAuth callback URLs and preview-origin behavior need actual testing |

A shared staging database/KV/bucket isolates production but does **not** isolate branches from one another. D1-backed OAuth grants, sessions and application rows must remain consistent with the chosen preview lifecycle. Replacing resources underneath an existing preview can leave its persistent DO state inconsistent; use a new preview identity for a clean resource set. Do not seed staging from production private data.

Primary Cloudflare references: [configuration](https://developers.cloudflare.com/workers/previews/configuration/), [resource isolation](https://developers.cloudflare.com/workers/previews/resources/), and [Worker Previews release](https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/). These distinguish explicitly selected storage from automatically isolated local DO classes. They also document that service bindings target the bound Worker's production version: `SITE: vibebook-site` would not automatically select its corresponding preview. `preview_database_id`, KV `preview_id` and R2 `preview_bucket_name` configure remote development, not this preview deployment.

## Validation before deployment

1. Offline, parse both JSONC files and validate against the locked Wrangler schema. Verify the production configuration is unchanged after removing the new `previews` property. Check required binding names against `Env` and all three local DO class exports/migrations. Keep the original compatibility settings and assets at top level.
2. Once metadata arrives, reject unresolved placeholders, production storage identifiers, duplicate or production rate-limit namespaces, `script_name` on local DO bindings, production reporting-room vars and unapproved service bindings. Confirm every sandbox resource belongs to the intended account. JSON-schema success cannot prove ownership or isolation.
3. Prepare a separate reviewed migration configuration pointing only at the approved staging D1, following Cloudflare's D1 migration procedure. Do not run the existing production-target migration command for preview setup. Resource creation, remote migrations, secrets and deploy remain separate authorized operations.
4. After source approval, an owner provisions/configures the resources and Preview Base secrets. Only then run a controlled preview deployment. Retain the URL and platform binding metadata; verify fresh authentication, storage isolation, all three DOs, file upload/read, email restriction and model spending controls. The main static fallback is expected until a dedicated staging SITE is configured.
5. Keep the previous failing build evidence. No deployed success is claimed by this patch. Changing Workers Builds to `wrangler versions upload` is an alternative workflow requiring an explicit owner decision; uploaded versions do not by themselves establish safe data isolation.

Offline validation: `node docs/worker-previews/validate.cjs <checkout-with-locked-dependencies> --allow-template` validates both fragments against the pinned `PreviewsConfig` schema and checks static isolation constraints. Without `--allow-template`, unresolved placeholders produce exit 2. The script reads only tracked configuration and the installed schema; it neither imports the Wrangler runtime nor reads credentials. AJV is supplied by the existing locked development dependency graph. Do not install packages or invoke preview to validate these fragments.

No formatter, compiler, build, browser, Wrangler preview, resource listing, migration or deployment was executed. Static validation cannot verify resource existence, permissions, database readiness, deco isolation or runtime authentication. The deployment checklist remains unexecuted.
