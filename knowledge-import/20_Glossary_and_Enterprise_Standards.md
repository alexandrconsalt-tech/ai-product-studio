
# 20 · Glossary and Enterprise Standards

> Version: 1.0
> Status: Draft

---

# Purpose

This document provides a common vocabulary, terminology, abbreviations and normative conventions used throughout the AI Product OS Enterprise Software Requirements Specification.

It shall be treated as the authoritative reference for every other SRS document.

---

# Normative Language

The following keywords follow RFC 2119 semantics.

| Keyword | Meaning |
|----------|---------|
| SHALL | Mandatory requirement |
| MUST | Absolute requirement |
| SHOULD | Recommended unless justified otherwise |
| MAY | Optional capability |

---

# Core Terms

## AI Product

A software product whose primary business capability is implemented through one or more AI models.

## Artifact

Any version-controlled object managed by AI Product OS.

Examples:

- Product
- Prompt
- Pipeline
- Dataset
- Evaluation
- Release
- Architecture Document

## Product Readiness

A calculated score representing overall implementation and operational maturity.

## Prompt

A structured instruction executed by an LLM.

## Pipeline

A directed execution graph consisting of AI, logic, validation and integration nodes.

## Agent

A specialized AI component responsible for a bounded domain capability.

## Orchestrator

The central runtime responsible for task planning, routing, context assembly and aggregation.

## Golden Dataset

A versioned dataset with verified expected outputs used for regression and benchmark evaluation.

## Experiment

A reproducible execution of one or more pipelines against one or more datasets.

## Release

An immutable package representing a deployable product state.

---

# Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| ADR | Architecture Decision Record |
| DAG | Directed Acyclic Graph |
| DDD | Domain-Driven Design |
| ER | Entity Relationship |
| KPI | Key Performance Indicator |
| LLM | Large Language Model |
| MVP | Minimum Viable Product |
| RBAC | Role-Based Access Control |
| RAG | Retrieval-Augmented Generation |
| SLA | Service Level Agreement |
| SLO | Service Level Objective |
| SRS | Software Requirements Specification |
| UX | User Experience |

---

# Naming Conventions

Artifacts SHALL use singular names.

Examples:

- Product
- Prompt
- Pipeline
- Experiment

Database tables SHOULD use plural names.

API resources SHALL use plural nouns.

---

# Identifier Prefixes

| Entity | Prefix |
|----------|--------|
| Product | prd_ |
| Prompt | prm_ |
| Pipeline | pln_ |
| Agent | agt_ |
| Dataset | dts_ |
| Experiment | exp_ |
| Release | rel_ |

---

# Document Relationships

This glossary applies to every document in the SRS:

- Vision
- Product Studio
- Prompt Studio
- Pipeline Builder
- Pipeline Lab
- Analytics
- Knowledge Base
- Architecture
- Lifecycle

---

# Acceptance Criteria

This document is complete when:

- terminology is unambiguous;
- abbreviations are standardized;
- naming conventions are defined;
- normative language is established.

---

# Recommended Phase 2

The baseline SRS is complete.

The next documentation phase should expand every document into implementation-level specifications with:

- UML/C4 diagrams
- OpenAPI contracts
- JSON Schemas
- Database DDL
- Sequence diagrams
- State machines
- Test Traceability Matrix
- Architecture Decision Records
