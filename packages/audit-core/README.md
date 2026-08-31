# @panchnama/audit-core

Pure, deterministic audit rules and classifiers (implementation.md section
7): availability/redirect rules, broken-link grouping, HTTPS/certificate
checks, freshness signals, directory-mismatch detection, functional-overlap
comparison support, severity/confidence mapping, technical-health
derivation, and suggested-action templates.

**Status:** scaffold only. Populated starting Session 7 ("Deterministic
audit rules"). Rules must be pure functions over `@panchnama/schema` types
with no network or filesystem access, so they stay unit-testable and
explainable.
