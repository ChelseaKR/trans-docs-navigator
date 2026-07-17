# 1. Generator is a pluggable seam; the default is a deterministic grounded composer

## Status

Accepted

Recorded inline as ADR-1 in `docs/ROADMAP.md` §6 during the M0–M4 build; migrated
to this file 2026-07-17. The decision content is unchanged.

## Context

The reference build runs with no AWS credentials, and the eval harness must be
reproducible: a merge gate whose outcome depends on a remote model's mood is not a
gate. At the same time, the safety property this repo is built around — **no claim
renders without a citation to a verified corpus record** — must hold no matter
which generator produced the text.

## Decision

Generation defaults to `GroundedComposer` (`api/generator.ts`): extractive
composition from the retrieved records, faithful by construction, fully
deterministic, so the eval is reproducible in CI with zero external calls.

`BedrockGenerator` is the production seam. Its output passes through the
*identical* `citation.enforce()` gate, so the citation-or-refuse property holds
regardless of generator.

**Rejected:** requiring Bedrock to run the gates — that would make CI
non-deterministic and the merge pipeline uncloseable.

## Consequences

- The eval suite and every merge gate run offline and deterministically.
- The safety property is generator-independent: swapping generators cannot weaken
  the citation gate, only fail it.
- The composer's prose is extractive, not fluent synthesis; that is an accepted
  quality ceiling for the default path.
- The Bedrock path still requires its own eval run against the real model before
  any production use — that launch gate is open and human-owned
  (see `docs/STATUS.md`).
