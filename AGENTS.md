\# JobGuard-AI — AI Development Instructions



\## Project

JobGuard-AI is a MERN-style job safety platform that helps users detect scam jobs, analyze resumes, optimize resumes, and discover relevant job opportunities.



\## Structure

\- `Backend/` — Node.js + Express + Sequelize + MySQL + Gemini AI

\- `Frontend/` — React + Vite

\- `scam\_detector.sql` — database schema/data



\## Rules

\- Do not make unnecessary architectural changes.

\- Preserve existing working functionality.

\- Before changing code, understand the existing implementation.

\- Prefer small, focused changes over rewrites.

\- Do not expose or commit `.env` secrets.

\- Never add `node\_modules` to Git.

\- Keep existing API contracts stable unless explicitly asked to change them.

\- Handle errors properly in production-facing code.

\- Validate changes before considering a task complete.

\- Explain important changes briefly after implementation.



\## Development Style

\- Write clean, readable, maintainable code.

\- Follow the existing project conventions.

\- Avoid over-engineering.

\- Reuse existing utilities/services when appropriate.

\- Do not introduce new dependencies unless necessary.



\## AI Changes

When modifying Gemini/AI functionality:

\- Preserve existing fallback/error handling.

\- Consider API failures, rate limits, malformed responses, and unavailable services.

\- Do not assume AI output is always valid.

