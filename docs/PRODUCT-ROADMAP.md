# LeetMetric product roadmap

This roadmap keeps implementation incremental. A feature is marked complete only after its user flow, data source, error handling and tests are in place.

## Product principles

- **Accurate before impressive:** never display estimated or generated values as official LeetCode metrics.
- **Privacy by default:** never request LeetCode passwords, session cookies or browser tokens.
- **Progressive enhancement:** public lookup must continue working without a signed-in account.
- **Responsive by design:** every new screen must work with keyboard, touch, narrow mobile widths and desktop layouts.
- **Reliable integrations:** treat LeetCode's public GraphQL endpoint as an upstream dependency, not a guaranteed commercial API.
- **Small, reviewable releases:** ship one coherent phase at a time with tests and a documented change summary.

## Phase 0 — Product and engineering foundation

**Status: implemented in the core dashboard foundation release**

- [x] Reorganize the signed-in dashboard into overview, analytics, profile settings and account settings.
- [x] Provide responsive layouts for desktop, tablet and mobile widths.
- [x] Add an accessible difficulty distribution chart using values returned by the existing profile API.
- [x] Show total question-bank coverage and the last successful fetch time.
- [x] Add explanatory copy for solved problems versus submission attempts.
- [x] Extract LeetCode response normalization into a dependency-free service.
- [x] Bound the process-local cache and deduplicate concurrent requests for the same username.
- [x] Add unit tests for profile normalization and malformed counters.
- [x] Add GitHub Actions quality checks.

## Phase 1 — Historical progress and richer LeetCode analytics

**Status: private snapshots and personal goals are implemented; daily heatmap and contest analytics remain pending**

- [x] Persist one private, timestamped profile snapshot per UTC day for a user's saved profile.
- [x] Add a historical solved-count trend and snapshot table (requires at least two saved days).
- [x] Add a public submission heatmap and current streak from the LeetCode calendar response.
- [x] Add contest rating, global ranking, participation count and attended-contest rating history.
- [ ] Add refresh timestamps, stale-data labels and clear upstream availability states.
- [x] Automatically expire snapshots after 180 days and provide authenticated account deletion for snapshots, goals and revision items.

## Phase 2 — Topic intelligence and comparison

**Status: public profile comparison implemented; reliable topic-level metadata remains pending**

- [x] Add topic-level solved counts grouped by LeetCode's fundamental, intermediate and advanced tags.
- [x] Show the most-practiced tags by solved count, with copy clarifying that tag counts are not mastery scores.
- [x] Compare two public profiles using the same metric definitions for solved counts, submissions and acceptance rate.
- [ ] Add side-by-side difficulty, topic and contest comparisons.
- [ ] Label unavailable or partial data instead of filling gaps with assumptions.

## Phase 3 — Personal practice workspace

**Priority: P1**

- [x] Add user-defined 7-day and 30-day problem-solving goals with snapshot-based baselines and progress.
- [x] Add a private revision queue and mistake journal with title, optional problem URL, topic, difficulty, revisit reason, notes and status tracking.
- [x] Add browser-generated PNG developer profile cards for the current public profile.
- [x] Add a deterministic 7-day editable practice planner grounded in the current profile's difficulty coverage and public topic counts. (The plan is generated in-browser and is not persisted.)
- [x] Add a private DSA revision queue and mistake journal with queued/revisiting/mastered statuses.
- [ ] Add a transparent consistency score based on recorded activity.
- [ ] Add an interview-readiness estimate with a published methodology.

## Phase 4 — AI study coach

**Priority: P2**

- [ ] Add an optional AI coach grounded in stored, verified user analytics.
- [ ] Generate editable 7-day, 30-day and 90-day practice plans.
- [ ] Explain recommendations and cite the metrics that informed them.
- [ ] Add a weekly report with a clear distinction between measured values and AI-generated advice.
- [ ] Keep AI credentials server-side and provide graceful fallback when AI is not configured.

## Phase 5 — Community and achievements

**Priority: P2**

- [ ] Add public developer profiles and shareable profile cards.
- [ ] Add friend connections and private friend comparisons.
- [ ] Add transparent weekly and monthly leaderboards.
- [ ] Add challenges and achievements with verifiable award criteria.
- [ ] Add reporting, blocking and privacy controls before public social features.

## Phase 6 — Multi-platform developer analytics

**Priority: P3**

- [ ] Add CodeChef, Codeforces, AtCoder and HackerRank integrations where stable public data is available.
- [ ] Add GitHub OAuth and public repository analytics.
- [ ] Prevent duplicate problem counts across platforms where problem identity can be matched.
- [ ] Create a unified developer profile and exportable report.

## Release acceptance checklist

Every phase must pass:

1. The npm quality command and the relevant integration tests.
2. Keyboard navigation and visible focus checks.
3. Responsive checks at approximately 360px, 390px, 768px, 1024px and 1440px.
4. Dark and light theme checks.
5. Loading, empty, invalid-input, rate-limit, timeout and upstream-error states.
6. No secrets, LeetCode credentials or private session data in browser code or logs.
7. Documentation that distinguishes implemented features from roadmap items.
