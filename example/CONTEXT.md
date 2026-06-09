# CONTEXT.md — Bookshelve

> Produced by: `establishing-ubiquitous-language` (po-agent)
> Status: Approved 2026-06-02

---

## Domain Language

**Reading List**: The single ordered collection of books a Reader has saved but not yet read. One per Reader. Not "wishlist", not "to-read pile", not "queue".

**Book**: A saved item in the Reading List. Has a title, author, and cover image. Identified by ISBN where available. Not "item", not "entry", not "record".

**Save**: The action of adding a Book to the Reading List. Not "add", not "bookmark", not "pin".

**Mark as Read**: The action of moving a Book from the Reading List to the Read Shelf. Not "complete", not "finish", not "archive".

**Read Shelf**: The collection of Books the Reader has marked as read. Separate from the Reading List. Not "history", not "completed list", not "archive".

**Reader**: The user of Bookshelve. Not "user", not "customer", not "account".

**Book Search**: The act of querying Open Library to find a Book by title. Not "lookup", not "query", not "find".

---

## Bounded Context Boundaries

**ReadingList context**: owns Reading List, Book (saved state), Mark as Read, Remove
**BookSearch context**: delegates to Open Library API. We do not own this data.

A Book in the BookSearch context is a search result. A Book in the ReadingList context is a saved item. They share a name but are different objects — copying data from one to the other is the Save action.

---

## Agent Communication Protocol

| Canonical term | Never say |
|---|---|
| outer Acceptance Test | E2E test, integration test |
| sub-slice | partial implementation, chunk |
| desk check | demo, review, walkthrough |
| ready-for-dev | in backlog, up next |
| in-dev | in progress, active |
| pull a story | pick up a ticket |
| Save | add, bookmark, pin |
| Mark as Read | complete, finish, archive |
| Reader | user, customer |

---

## Flagged Ambiguities

**Book (search result) vs Book (saved item)**: resolved — same word, different contexts. Search result is transient; saved item is persistent. The Save action copies fields from one to the other.
