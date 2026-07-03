# 13 · Database Schema

> Version: 1.0
> Status: Draft

---

# Purpose

This document defines the physical persistence architecture for AI Product OS.

It translates the canonical domain model into an enterprise-grade storage architecture supporting transactional workloads, semantic retrieval, event sourcing, analytics and large-scale AI operations.

---

# Objectives

- Provide scalable persistence for all platform artifacts.
- Separate transactional and analytical workloads.
- Support semantic retrieval through vector storage.
- Preserve immutable history using event storage.
- Enable high availability and disaster recovery.

---

# Storage Architecture

```text
                  AI Product OS

                        │
                        ▼
                 Data Access Layer
                        │
        ┌───────────────┼────────────────┐
        │               │                │
 PostgreSQL       Vector DB        Object Storage
        │               │                │
        ├───────────────┼────────────────┤
        │               │                │
   Redis Cache      Event Store     Search Index
```

---

# Storage Components

## PostgreSQL

Stores transactional business entities:

- Products
- Prompts
- Pipelines
- Users
- Organizations
- Releases
- Metadata
- Permissions

---

## Vector Database

Stores embeddings for:

- Knowledge assets
- Product documents
- Prompts
- Architecture
- Test reports
- Conversations

Supports semantic retrieval and RAG.

---

## Object Storage

Stores binary assets:

- PDFs
- Images
- Audio
- Video
- ZIP archives
- Export packages
- Evaluation artifacts

Objects are immutable after publication.

---

## Event Store

Stores immutable domain events.

Examples:

- ProductCreated
- PromptReleased
- PipelinePublished
- ExperimentCompleted
- ReleaseApproved

Event replay supports system reconstruction.

---

## Redis Cache

Caches:

- Sessions
- Runtime context
- Frequently used metadata
- Search results
- Authorization data

---

# PostgreSQL Schema

Primary schemas:

| Schema | Purpose |
|---------|---------|
| product | Product entities |
| prompt | Prompt management |
| pipeline | Pipeline execution |
| evaluation | Experiments |
| knowledge | Metadata |
| identity | Users and tenants |
| governance | Audit and approvals |

---

# Primary Tables

## product.products

- product_id
- tenant_id
- name
- status
- readiness_score
- current_release
- created_at

---

## prompt.prompts

- prompt_id
- version
- status
- owner
- quality_score

---

## pipeline.pipelines

- pipeline_id
- graph
- runtime_config
- deployment_state

---

## evaluation.experiments

- experiment_id
- dataset_id
- pipeline_version
- prompt_version
- confidence_score
- result

---

## release.releases

- release_id
- product_id
- version
- status
- approval_timestamp

---

# Index Strategy

Indexes include:

- Primary keys
- Foreign keys
- Tenant indexes
- Status indexes
- Timestamp indexes
- Full-text indexes
- Composite indexes

Vector indexes use approximate nearest-neighbor search.

---

# Relationships

```text
Product
   │
   ├── Prompt
   ├── Pipeline
   ├── Dataset
   ├── Experiment
   └── Release
```

Foreign-key constraints enforce referential integrity.

---

# Transactions

Transactional guarantees:

- ACID compliance
- Optimistic locking
- Atomic writes
- Referential integrity

Long-running AI execution is coordinated outside database transactions.

---

# Multi-Tenancy

Tenant isolation is implemented using:

- tenant_id
- row-level security
- encrypted tenant secrets
- isolated object storage prefixes

---

# Backup Strategy

Backups include:

- Hourly incremental
- Daily full
- Weekly archive
- Cross-region replication

Recovery objectives:

| Metric | Target |
|--------|--------|
| RPO | <15 minutes |
| RTO | <1 hour |

---

# Retention Policies

Retention periods:

- Audit logs: 7 years
- Releases: Permanent
- Experiments: Configurable
- Sessions: 30 days
- Cache: Ephemeral

---

# Security

Database security includes:

- TLS encryption
- Encryption at rest
- RBAC
- Secret management
- Audit logging
- Database activity monitoring

---

# Performance

Optimization strategies:

- Read replicas
- Connection pooling
- Partitioning
- Query optimization
- Materialized views
- Background jobs

---

# Acceptance Criteria

The database architecture is complete when it can:

- Persist every platform artifact.
- Support transactional integrity.
- Enable semantic retrieval.
- Scale across multiple tenants.
- Recover from failures.
- Preserve immutable history.

---

# Next Document

Continue with:

`14_API_Architecture.md`

This document specifies internal services, REST APIs, event interfaces, authentication, authorization and integration architecture across AI Product OS.
