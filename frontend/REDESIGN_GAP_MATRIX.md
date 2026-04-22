# Toolshare Frontend Feature Matrix

This matrix maps documented requirements to existing routes and target redesign coverage.

## Core User Flows

| Feature | Requirement Group | Existing Route | Redesign Target |
|---|---|---|---|
| Login and registration | Auth | `/` (`AuthScreen`) | Modern split auth screen with inline validation and role-aware messaging |
| Tool discovery and filtering | Search / Marketplace | `/tools` | Discovery layout with search, category filter, rich cards, and clear status chips |
| Tool request with pickup time | Booking | `/tools` | Dedicated request panel with date inputs, validation, and success/error feedback |
| Workshop discovery and slot booking | Workshop booking | `/workshops` | Workshop cards with capacity/location metadata and slot timeline actions |
| Create tool listing | Provider flow | `/tools/new` | Structured form with semantic field groups and stronger validation feedback |
| Create workshop and availability slots | Provider flow | `/workshops/new` | Step-like form for workshop details + managed slot list |
| Inbox for notifications and booking actions | Request lifecycle | `/inbox` | Unified inbox feed with notifications and action-ready booking items |
| Moderation report handling | Moderator role | `/moderation` | Moderation queue with report states and resolve actions |
| Admin metrics and role management | Admin role | `/admin` | Admin dashboard cards + role management table |
| Logout and identity context | Session | Global shell | Persistent account/status area in app shell |

## Role Coverage

| Role | Must Access | Current | Redesign |
|---|---|---|---|
| NUTZER | Dashboard, Tools, Workshops, Inbox, Create pages | Yes | Keep + improve IA and usability |
| MODERATOR | User pages + Moderation | Yes | Keep route guard and modernize moderation UI |
| ADMIN | User pages + Admin | Yes | Keep route guard and modernize admin UI |

## Known Gaps to Close During Redesign

1. Replace blocking `alert(...)` feedback with non-blocking toasts and inline messages.
2. Unify loading, error, and empty states across all pages.
3. Standardize status visualization for booking and tool states.
4. Improve accessibility baseline (focus states, semantic landmarks, form affordances).
5. Move from ad-hoc global classes to reusable UI primitives and semantic design tokens.
