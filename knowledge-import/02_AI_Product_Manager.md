# 02 · AI Product Manager

> Version: 1.0  
> Status: Draft

---

# Purpose

The AI Product Manager is the core intelligence of AI Product OS.

It replaces the traditional workflow where a Product Manager manually writes documents, creates product canvases and coordinates specialists.

Instead, the AI Product Manager acts as an orchestrator that manages a virtual AI team.

---

# Responsibilities

The AI Product Manager is responsible for:

- Understanding business ideas
- Running Product Discovery
- Asking clarifying questions
- Generating Product Canvas
- Coordinating specialist AI agents
- Creating product roadmap
- Defining MVP
- Selecting AI architecture
- Monitoring product maturity

---

# High-Level Architecture

```text
                    User
                      │
                      ▼
              AI Product Manager
                      │
        ┌─────────────┼─────────────┐
        │             │             │
 Business Analyst  Solution     Prompt Engineer
                   Architect
        │             │             │
        ├─────────────┼─────────────┤
        │             │             │
   AI Engineer     QA Engineer  Knowledge Manager
                      │
                      ▼
                Product Artifacts
```

---

# AI Orchestrator

The AI Product Manager never solves every task directly.

Instead it delegates work to specialist agents.

## Available Specialists

| Agent | Responsibility |
|-------|----------------|
| Business Analyst | Business discovery |
| Product Strategist | Product positioning |
| Solution Architect | System architecture |
| Prompt Engineer | Prompt design |
| AI Engineer | Model selection |
| QA Engineer | Test strategy |
| Technical Reviewer | Technical validation |
| Knowledge Manager | Long-term memory |

---

# Product Discovery Workflow

```text
Idea
 ↓
Intent Detection
 ↓
Gap Analysis
 ↓
Clarifying Questions
 ↓
Business Analysis
 ↓
MVP Definition
 ↓
Architecture Draft
 ↓
Product Canvas
```

---

# Clarifying Questions

The AI should never ask all questions at once.

Rules:

- Maximum three questions per iteration.
- Prioritize highest-impact unknowns.
- Continue generation after every answer.
- Skip questions when confidence is sufficient.

---

# Product Memory

Every product maintains persistent memory.

## Stored Information

- Product vision
- Previous discussions
- Product decisions
- Architecture history
- Prompt history
- Test history
- Known risks
- Business assumptions

---

# Decision Engine

The AI Product Manager evaluates every proposal using:

- Business value
- User value
- Technical complexity
- Cost
- Risk
- Time to market
- AI feasibility

---

# Generated Deliverables

The AI automatically creates:

- Product Canvas
- User Personas
- JTBD
- User Stories
- Functional Requirements
- Non-functional Requirements
- AI Architecture
- Pipeline Draft
- Prompt Plan
- Success Metrics
- Product Roadmap

---

# Human Responsibilities

The human remains responsible for:

- Business decisions
- Final approval
- Strategic priorities
- Budget
- Release approval

Everything else should be automated whenever possible.

---

# Acceptance Criteria

The AI Product Manager is considered complete when it can:

- Generate a complete product draft from a short idea.
- Ask only necessary clarification questions.
- Coordinate specialist agents.
- Produce consistent documentation.
- Regenerate dependent artifacts after edits.
- Preserve full product history.

---

# Next Document

Continue with:

`03_Product_Studio.md`

This document specifies the user interface, workflows and interaction model for the AI Product Studio.
