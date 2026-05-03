# ImageAll Plan

This document describes the foreseeable future of ImageAll.

It is a plan, not a promise.

The purpose is to make the next decisions legible, preserve scope discipline, and show what kinds of future growth fit the thesis of the project.

## 1. Current phase

ImageAll is in **phase zero: design and foundation**.

At this stage, the most important deliverables are:

- a clear project thesis
- a manifesto with anti-goals
- a first architecture draft
- an implementation sequence that keeps the workbench coherent

That foundation now exists in this repository.

## 2. Near-term roadmap

## Phase 1 — Repository bootstrap

Goal: turn the repository from a design shell into a working implementation base.

Expected work:

- choose the initial app stack
- create source layout and build tooling
- add formatting, linting, and type checking
- establish localization infrastructure
- establish design tokens and theme primitives
- wire a minimal app shell

Exit criteria:

- app boots locally
- locale switching works
- top-level shell regions exist
- theme and token system exists

## Phase 2 — Core domain and local persistence

Goal: make workbench data real before adding provider execution.

Expected work:

- implement `Workspace`, `Artifact`, `OperationSpec`, and `Run`
- add local persistence for artifacts and runs
- add artifact library scaffolding
- add run history scaffolding
- add compare-ready artifact selection state

Exit criteria:

- artifacts can be stored and loaded
- runs can be recorded and replayed in history views
- library and history panels are functional with mock data

## Phase 3 — Adaptor host and provider manifests

Goal: make the host capable of talking to providers without turning into provider-specific spaghetti.

Expected work:

- implement provider manifest loading
- implement adaptor registry
- implement validation and normalized error handling
- implement common inspector schema rendering
- define provider-specific options contract

Exit criteria:

- host can enumerate providers and models
- inspector can render shared and provider-specific sections
- invalid runs are caught before execution

## Phase 4 — Initial provider support

Goal: prove the architecture with real providers.

Initial targets:

- MiniMax text-to-image
- MiniMax image-to-image / edit flow
- StepFun generation flow
- StepFun edit flow

Why these providers:

- MiniMax is a good baseline for clean execution flow
- StepFun forces the host to remain honest about provider differences

Exit criteria:

- one successful end-to-end generate flow
- one successful end-to-end edit flow
- outputs appear in artifact library and run history
- provider-specific options are visible and clearly scoped

## Phase 5 — Workbench polish

Goal: make the app feel like a coherent product rather than a technical demo.

Expected work:

- result grid
- side-by-side compare mode
- before / after compare for edits
- export actions
- better loading, error, and empty states
- improved run tray and progress presentation
- stronger visual identity and motion tuning

Exit criteria:

- the core workflow feels smooth
- compare mode is genuinely useful
- the app has a recognizable visual personality

## Phase 6 — Public v0.x release

Goal: publish a small but opinionated first public version.

Expected work:

- clean documentation
- screenshots and demo media
- contribution policy
- installation instructions
- initial issue labels and roadmap housekeeping

Exit criteria:

- repository is understandable to newcomers
- first-time users can run the app locally
- the public README matches the actual product state

## 3. Foreseeable future after v1

These are likely growth directions that still fit the thesis of ImageAll.

## 3.1 More in-tree adaptors

The most natural growth path is adding more provider adaptors while keeping the host contract stable.

Possible future candidates:

- additional commercial image APIs
- open-model gateways
- local model backends

Rule: new adaptors should strengthen the workbench, not dilute it.

## 3.2 Better artifact workflows

Likely improvements:

- collections and tagging
- stronger lineage view
- richer metadata inspection
- smarter compare presets
- rerun from prior artifact context

## 3.3 Presets and reusable operation recipes

This fits the thesis if done carefully.

Good version:

- save and reuse operation presets locally
- share plain-text preset definitions

Bad version:

- prompt marketplace
- social feed
- platform-style discovery economy

## 3.4 Optional desktop shell

If the browser-first app proves the workflow, a desktop wrapper may become worthwhile for:

- local file integration
- native dialogs
- offline packaging
- better multi-window behavior

This is optional, not a first-release requirement.

## 3.5 Future external adaptor story

Only after the in-tree host contract stabilizes should ImageAll consider out-of-tree adaptors.

That would require:

- versioned host contract
- adaptor compatibility guarantees
- stronger schema validation
- clear security and trust model

This is a later-phase possibility, not an early commitment.

## 4. Things that should stay out unless the thesis changes

These are foreseeable requests that are likely to appear but should remain out of scope unless the project changes identity.

- node graph workflows
- arbitrary provider UI injection
- cloud accounts and sync as a requirement
- collaboration features
- billing systems
- video-first product direction
- marketplace and feed mechanics
- enterprise admin surface

The existence of demand is not enough. These directions would change the nature of the product.

## 5. Quality plan

As the implementation begins, these standards should guide work:

- type safety over convenience hacks
- design consistency over feature speed
- explicit boundaries over magical abstractions
- host-owned UX over provider-owned UX
- localized copy quality over English-only shipping

## 6. Release philosophy

ImageAll should release in a way that reflects its architecture:

- small, honest versions
- clear change logs
- visible deprecations
- no pretending a draft feature is production-ready

The public face of the project should stay aligned with reality.

## 7. A simple planning rule

When a future idea appears, test it against three questions:

1. Does it strengthen the workbench?
2. Does it preserve one coherent shell?
3. Does it keep provider differences honest?

If the answer is weak, the feature belongs later or not at all.

## 8. Summary

The foreseeable future of ImageAll is not “becoming everything.”

It is becoming a sharper version of itself:

- more coherent
- more multilingual
- more beautiful
- more reproducible
- more capable through honest adaptors

That is enough.
