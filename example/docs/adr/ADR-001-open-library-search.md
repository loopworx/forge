# ADR-001: Use Open Library API for Book Search

> Produced by: `deciding-architecture` (architect-agent)
> Status: Accepted 2026-06-03

## Context

Story BS-01 (Save a book from search results) requires searching for books by title. We need a decision on the search data source before development begins.

## Decision

Use the [Open Library Search API](https://openlibrary.org/dev/docs/api) (`https://openlibrary.org/search.json?title=...`).

## Consequences

**Easier:**
- No API key required
- Rich book metadata (title, author, ISBN, cover)
- No cost at our scale

**Harder:**
- Results quality varies for niche titles
- We don't control availability — must handle API downtime gracefully
- Cover images served from Open Library CDN — must handle missing covers

**Constraints this sets:**
- Search is query-on-submit, not live-search (avoids rate issues)
- The FE must show a loading state during search
- The FE must show an empty state if no results
- Cover images must have a fallback placeholder

## Alternatives Considered

**Google Books API**: Requires API key, rate limits, attribution requirements. Rejected — unnecessary complexity.

**ISBNdb**: Paid tier required for reasonable limits. Rejected — violates cost ranking in project constraints.

**Local book database**: Too much maintenance. Rejected.

## Story Impact

BS-01 depends on this ADR.
AC-3 of BS-01 ("empty state when no results found") comes directly from the Harder consequences above.
