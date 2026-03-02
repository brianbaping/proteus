# Proteus Forge

Transform proof-of-concept codebases into production-ready applications using coordinated AI agent teams.

Proteus Forge is a CLI tool that orchestrates [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) through a five-stage pipeline: **inspect** the POC, **design** a production architecture, **plan** the implementation tasks, **split** into discipline tracks, and **execute** with parallel agent teams writing production code.

---

## How It Works

```
Source POC (read-only)          Proteus Forge Pipeline                    Production Code
┌──────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│ src/auth/         │     │ inspect → design → plan  │     │ server/src/auth/     │
│ src/products/     │────>│     → split → execute    │────>│ server/src/products/ │
│ prisma/schema     │     │                          │     │ client/src/features/ │
│ Dockerfile        │     │ Agent Teams do the work  │     │ tests/               │
└──────────────────┘     └──────────────────────────┘     │ Dockerfile           │
                                                           │ .github/workflows/   │
                                                           └──────────────────────┘
```

Proteus Forge never modifies your POC. It analyzes the source as read-only reference and builds the production version in a separate target repository.

### Pipeline Stages

| Stage | Command | Agents | What Happens |
|-------|---------|--------|-------------|
| **Inspect** | `proteus-forge inspect` | Scout + domain specialists | Analyzes the POC, identifies features, data model, integrations, and known issues |
| **Design** | `proteus-forge design` | Architect + design specialists | Produces a production architecture with service definitions and API contracts |
| **Plan** | `proteus-forge plan` | Single Lead | Generates a task DAG with execution waves, dependencies, and acceptance criteria |
| **Split** | `proteus-forge split` | Single Lead | Partitions tasks into discipline tracks (backend, frontend, data, devops, qa) with file ownership |
| **Execute** | `proteus-forge execute` | Orchestrator + track engineers | Parallel agent teams write production code wave by wave |

Each stage produces artifacts in `.proteus-forge/` that feed the next stage. Human-editable files (`design.md`, `plan.md`) can be modified between stages to guide the architecture.

---

## Prerequisites

- **Node.js** >= 22.0.0
- **Claude Code** installed with a valid API key
- An `ANTHROPIC_API_KEY` environment variable (or other supported provider key)

Agent Teams is enabled automatically by `proteus-forge setup`.

---

## Installation

```bash
git clone https://github.com/brianbaping/proteus.git
cd proteus
npm install
npm run build
npm link
```

This builds the CLI and makes `proteus-forge` available globally.

## Quick Start

```bash
# One-time setup (configures providers, enables Agent Teams)
proteus-forge setup

# Create a project pointing at your POC
proteus-forge new my-app --source ~/projects/my-poc

# Run the pipeline
proteus-forge inspect
proteus-forge design
proteus-forge plan
proteus-forge split
proteus-forge execute
```

Check progress at any point:

```bash
proteus-forge status
```

Or run the entire pipeline in one command:

```bash
proteus-forge run                                    # full pipeline, no stopping
proteus-forge run --brief "Use Go with gRPC"         # with design requirements
proteus-forge run --from design --to split           # batch specific stages
proteus-forge run --budget 5.00                      # per-stage budget cap
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [CLI Commands](docs/commands.md) | Full command reference for all 30 commands |
| [Architecture](docs/architecture.md) | How Proteus Forge delegates to Agent Teams |
| [Model Tiers](docs/model-tiers.md) | Three-tier model configuration and role mapping |
| [Artifacts](docs/artifacts.md) | Stage output structure and editing between stages |
| [Cost Tracking](docs/cost-tracking.md) | Token usage, cost breakdown, and budget caps |
| [Development](docs/development.md) | Build scripts, testing, project structure, dependencies |
| [Schemas](docs/schemas.md) | Complete artifact schemas, validation rules, and example payloads |
