# 03 · Product Studio

> Version: 1.0  
> Status: Draft

# Overview

Product Studio is the primary workspace of AI Product OS.

Unlike traditional product management software, Product Studio is **not a form editor**.

It is an AI-powered collaborative environment where an AI Product Manager progressively transforms a raw business idea into a production-ready AI product.

---

# Objectives

- Eliminate manual product documentation.
- Drive product discovery through conversation.
- Generate complete product drafts automatically.
- Maintain full traceability and version history.
- Coordinate AI specialists through the AI Orchestrator.

---

# User Journey

```text
New Product
      │
      ▼
Describe Idea
      │
      ▼
AI Discovery
      │
      ▼
Clarifying Questions
      │
      ▼
Product Draft
      │
      ▼
AI Review
      │
      ▼
Human Review
      │
      ▼
Architecture Approved
      │
      ▼
Prompt Studio
```

---

# Workspace Layout

## Left Navigation

- Products
- Recent
- Favorites
- Templates
- Archive

## Center Workspace

Conversation with AI Product Manager.

Supports:

- Text
- Voice
- Images
- PDFs
- Product documents
- Transcripts

## Right Panel

Dynamic artifacts.

Examples:

- Product Canvas
- Architecture
- Risks
- Roadmap
- MVP
- AI Agents
- Pipeline
- Prompt Pack

---

# Product Creation Flow

## Step 1

User describes an idea naturally.

Example:

> Build an AI system that evaluates sales calls and generates coaching recommendations.

No structured input is required.

---

## Step 2

AI performs:

- Intent extraction
- Domain detection
- Similarity search
- Assumption detection
- Missing information analysis

---

## Step 3

AI asks a maximum of three clarification questions.

Questions are prioritized by expected information gain.

---

## Step 4

AI generates the first Product Draft.

Artifacts include:

- Executive Summary
- Business Problem
- Target Users
- JTBD
- User Stories
- Functional Requirements
- Non-functional Requirements
- MVP
- AI Architecture
- Initial Pipeline
- Success Metrics
- Risks

---

# AI Confidence

Every generated artifact contains a confidence score.

| Score | Meaning |
|------:|---------|
| 95–100 | High confidence |
| 80–94 | Minor review recommended |
| 60–79 | Human review required |
| <60 | Insufficient information |

Low-confidence sections should automatically generate follow-up questions.

---

# Product Readiness

The platform continuously calculates readiness.

Factors:

- Business Definition
- User Research
- Architecture
- Prompt Coverage
- Pipeline Completeness
- Testing Coverage
- Risk Assessment
- Documentation

Displayed as:

```text
Product Readiness

91 / 100

Status

Beta
```

---

# Versioning

Every save creates a new immutable version.

Stored changes include:

- Conversation
- Product Canvas
- Architecture
- AI Decisions
- Prompt References
- Pipeline References

---

# AI Recommendations

The AI proactively suggests actions.

Examples:

- Define success metrics.
- Split MVP into phases.
- Reduce scope.
- Improve architecture.
- Create evaluation dataset.
- Generate prompts.
- Launch regression testing.

---

# Acceptance Criteria

Product Studio is complete when it can:

- Build a product draft from free-form input.
- Conduct AI-led discovery.
- Coordinate specialist agents.
- Maintain product history.
- Calculate readiness.
- Launch Prompt Studio directly from the approved draft.

---

# Next Document

Continue with:

`04_Prompt_Studio.md`

Prompt Studio defines how AI prompts are designed, reviewed, versioned and connected to products.
