# ImageAll Manifesto

ImageAll is an opinionated project.

That is not branding. It is a maintenance strategy.

The project will only stay coherent if its taste, scope, and trade-offs are written down early and defended repeatedly.

## The promise

**ImageAll is a multilingual image workbench for generating, editing, and comparing images across providers without flattening their differences.**

This is the promise.

It is stronger than saying “AI image app” and more honest than saying “one interface for every model.”

It implies four things:

1. the product is a **workbench**, not a platform empire
2. the shell is **coherent and owned by the host**, not by providers
3. differences between providers are **surfaced deliberately**, not hidden badly
4. multilingual usability is a **core property**, not a side feature

## What we optimize for

### 1. Coherence over feature count

We would rather have one polished workflow than five half-integrated ones.

ImageAll should feel like one product with one point of view.

### 2. Honest abstraction

We will unify only the parts that are genuinely stable across providers.

We will not pretend that every provider exposes the same semantics, quality knobs, transport layer, or image editing behavior.

### 3. Complete i18n

Localization is not a translation pass at the end.

It changes how labels are named, how layouts are sized, how copy is authored, and how UI components are built.

Every user-visible string should be designed to travel across languages cleanly.

### 4. Image-first interaction

The center of the product is the image stage: preview, comparison, and results.

Text exists to drive and explain image work, not to dominate the interface.

### 5. Provenance and reproducibility

Every meaningful output should be traceable.

Users should be able to answer:

- where did this image come from?
- which provider and model produced it?
- what prompt and options were used?
- what changed between this result and the last one?

### 6. Beauty with restraint

The interface should feel calm, layered, and intentional.

Not loud.
Not toy-like.
Not overloaded with novelty.

Beauty is expressed through:

- hierarchy
- rhythm
- spacing
- typography
- color discipline
- motion discipline
- good empty states

## Non-negotiable principles

### One shell

Providers do not own navigation.

The top-level information architecture belongs to ImageAll:

- library
- preview / compare stage
- inspector
- run history and output tray

### Honest adaptors

Adaptors may declare provider-specific fields.

They may not redefine the whole user experience or turn the app into a host for arbitrary provider UIs.

### Immutable artifacts

Artifacts are outputs and inputs with lineage.

They are not silently mutated in place.

### Append-only runs

Runs are execution records.

They capture reality, not intention.

If a run failed, timed out, or produced filtered content, that history should stay visible.

### Localized shell, canonical core

The domain model uses stable internal identifiers.

Localization belongs to the presentation layer.

We do not localize core identifiers or persist translated labels in domain records.

## What ImageAll is not

ImageAll is not a blank canvas for any possible feature request.

### It is not a universal abstraction layer

The goal is not to erase provider identity until every operation becomes a weak generic blob.

### It is not a node-graph workflow system

If the product becomes a graph editor, it stops being the workbench described here.

### It is not a SaaS product

No account-first mindset.
No growth mechanics.
No product strategy disguised as open source.

### It is not a provider marketplace in v1

Early architecture should support in-tree adaptors first.

An external plugin ecosystem is only worth adding after the host contract stabilizes.

### It is not a collaboration suite

No org roles, cloud workspaces, billing systems, or “team features” in the first release.

### It is not a design-by-voting project

Feedback is welcome.
Taste is not crowdsourced.

## Anti-goals

These are explicit anti-goals for the first release:

- full provider parity
- node graphs
- custom provider pages
- arbitrary UI injection
- out-of-tree plugin ABI
- mobile-first design
- video generation focus
- social features
- prompt marketplace
- workflow automation framework

If a feature pulls the project toward any of these, it should be rejected or postponed.

## Contribution philosophy

ImageAll welcomes thoughtful contribution, but the project must remain internally consistent.

Good early contributions include:

- bug reports with clear reproduction
- architecture critique grounded in the manifesto
- localization improvements
- documentation improvements
- carefully scoped adaptor proposals

Weak contributions include:

- feature dumps without thesis alignment
- requests to turn the app into a generic AI dashboard
- redesigns that ignore the existing visual direction
- abstractions that erase provider truth for the sake of neatness

The default decision for scope expansion should be **no** until a feature clearly strengthens the promise of the project.

## How to evaluate a proposal

Before saying yes to a new feature, ask:

1. Does this make the core workflow better?
2. Does this preserve one coherent shell?
3. Does this keep provider differences honest?
4. Does this strengthen provenance, comparison, or multilingual usability?
5. Can this be delayed without harming the project's thesis?
6. Does this create maintenance cost larger than its user value?

If those answers are weak, the feature should not land.

## Final rule

When there is tension between growth and coherence, **coherence wins**.
