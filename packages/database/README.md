# @panchnama/database

Drizzle schema, migrations, and typed repository functions for anonymous
citizen-experience submissions, moderation, and abuse-key storage
(implementation.md section 9.5). PostgreSQL only; local development runs
through Docker Compose.

**Status:** scaffold only. Populated in Session 9 ("Database foundation and
moderation storage"). This package must never store crawler or audit
observations — those remain static, versioned datasets under `data/`.
