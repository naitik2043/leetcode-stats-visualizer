# LeetMetric — LeetCode Stats Visualizer

A polished LeetCode profile dashboard that turns public problem-solving activity into a readable performance snapshot. The project is evolving from a static HTML/CSS/JavaScript prototype into a full-stack MERN application with a secure API layer, persistence, and optional AI-powered practice insights.

> **Implementation status:** This milestone delivers the redesigned responsive frontend and its API contract. The live API integration, MongoDB persistence, authentication, historical tracking, and AI coaching are planned follow-up work and are not represented as completed features.

## Product direction

- Public LeetCode profile lookup with loading, empty, and error states.
- Difficulty-wise solved questions and submission metrics.
- Responsive dashboard with accessible navigation and clear information hierarchy.
- Server-side integration boundary; no public CORS proxy in browser code.
- Roadmap toward saved profiles, progress history, comparisons, and AI-generated study guidance.

## Stack and roadmap

| Layer | Current foundation | Planned evolution |
|---|---|---|
| UI | HTML, CSS, JavaScript | React + Vite |
| API | `/api/leetcode/:username` contract | Node.js + Express |
| Database | Not wired yet | MongoDB + Mongoose |
| AI | Not wired yet | Optional LLM-backed coaching endpoint |
| Hosting | Vercel-compatible static frontend | Vercel frontend + hosted API/database |

## Architecture direction

```text
React / Browser UI
       |
       v
Node.js + Express API
       |
       +------ LeetCode GraphQL integration
       |
       +------ MongoDB (saved profiles and snapshots)
       |
       +------ AI insights service (optional)
```

The frontend calls `GET /api/leetcode/:username`. The API is expected to return normalized statistics:

```json
{
  "username": "example",
  "stats": {
    "totalSolved": 120,
    "solved": { "easy": 55, "medium": 55, "hard": 10 },
    "totalQuestions": { "easy": 900, "medium": 1900, "hard": 800 },
    "acceptedTotal": 240,
    "submissionTotal": 360,
    "acceptedSubmissions": { "all": 240, "easy": 100, "medium": 110, "hard": 30 },
    "totalSubmissions": { "all": 360, "easy": 140, "medium": 170, "hard": 50 }
  }
}
```

Values above are illustrative only; the API should return validated upstream data.

## Run the current frontend

```bash
git clone https://github.com/naitik2043/leetcode-stats-visualizer.git
cd leetcode-stats-visualizer
```

Open `index.html` with VS Code Live Server or another static server. A Vercel serverless route is included at `/api/leetcode/[username]`. It validates usernames, queries LeetCode from the server, normalizes the response, and uses short-lived in-memory caching. The browser never calls a public CORS proxy. The cache is instance-local and should be replaced with shared Redis or another durable cache when scaling.

## Future API environment

When the Express service is implemented, keep credentials on the server and create a local `.env` file. Never commit secrets.

```env
PORT=5000
MONGODB_URI=
CLIENT_ORIGIN=http://localhost:5173
AI_API_KEY=
AI_MODEL=
```

## Roadmap

### Foundation
- [x] Replace the basic centered card with a responsive product dashboard.
- [x] Improve header, navigation, footer, metadata, and mobile layouts.
- [x] Remove the fragile public CORS proxy from browser code.
- [x] Define a normalized API contract and clear request states.

### MERN platform
- [ ] Migrate the UI to React + Vite.
- [ ] Build Express routes, validation, rate limiting, and centralized errors.
- [ ] Add MongoDB models for users, saved profiles, and dated snapshots.
- [ ] Add authentication and owner-scoped saved dashboards.
- [ ] Add caching, retries, upstream timeouts, and observability.

### Analytics and AI
- [ ] Track historical snapshots and visualize progress over time.
- [ ] Add profile comparison and shareable report links.
- [ ] Generate optional AI practice recommendations from verified metrics.
- [ ] Explain weak difficulty areas and suggest a weekly practice plan.
- [ ] Test normalization, API validation, and critical UI flows.

## Product quality and security principles

- Never collect LeetCode passwords or session cookies.
- Validate usernames and upstream JSON on the server.
- Apply rate limits, request timeouts, and bounded caching.
- Keep AI guidance clearly labeled as generated advice, not official metrics.
- Never expose API keys or database credentials in browser code.

## Contributing

Issues and pull requests are welcome. Keep changes focused, use descriptive commit messages, and include reproduction steps or screenshots for UI changes.

## License

Distributed under the MIT License. See [LICENSE](./LICENSE).

## Disclaimer

LeetMetric is an independent community project and is not affiliated with, endorsed by, or sponsored by LeetCode. LeetCode is a trademark of its respective owner.
