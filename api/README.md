# API integration contract

The frontend requests `GET /api/leetcode/:username` and expects the normalized JSON response documented in the root README.

This folder is reserved for the Vercel serverless API implementation. The current foundation does not include a working upstream LeetCode integration. Implement and validate the server-side integration before advertising live lookup as available.

Security requirements:
- Validate usernames and bound input lengths.
- Apply per-IP and per-username rate limits.
- Set strict upstream timeouts and response-size limits.
- Validate upstream JSON before returning it.
- Cache successful responses briefly to reduce repeated upstream requests.
- Never accept or store LeetCode passwords, session cookies, or browser-supplied credentials.
