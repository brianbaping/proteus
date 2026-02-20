/**
 * Generates the Lead (architect) prompt for the design stage.
 * This prompt tells the Lead to:
 * 1. Read the inspect output (features.json)
 * 2. Scope the design domains
 * 3. Create an Agent Team with design specialists
 * 4. Wait for specialists to complete, then synthesize
 */
export function generateDesignLeadPrompt(
  sourcePath: string,
  targetPath: string,
  brief?: string
): string {
  const briefSection = brief
    ? `
## User Architectural Requirements

The user has specified the following requirements for the production architecture. These take HIGHEST PRIORITY and must be followed by you and all specialists:

${brief}

Design the architecture to satisfy these requirements. If a requirement conflicts with what the POC currently uses, the user's requirement wins — the goal is to build the production system they want, not to replicate the POC's technology choices.

---

`
    : "";

  return `You are the Lead Architect for a Proteus Forge design stage. Your job is to read the inspection findings and coordinate a team of design specialists to produce a production architecture.
${briefSection}
## Context

The source POC has been inspected. The findings are at:
  ${targetPath}/.proteus-forge/01-inspect/features.json

The original source code is available (read-only) at:
  ${sourcePath}

You are working in the target directory:
  ${targetPath}

## Instructions

### Step 1: Read Inspection Findings

Read ${targetPath}/.proteus-forge/01-inspect/features.json thoroughly. Understand:
- What features the POC implements
- What technologies it uses
- What integrations exist
- What known issues were identified
- The data model

### Step 2: Scope Design Domains

Based on the features and issues found, determine what design domains are needed. Typical domains:
- **Backend architecture** — service structure, API design, middleware, error handling
- **Data architecture** — schema redesign, migrations, caching, connection management
- **Frontend architecture** — component structure, state management, routing, API client
- **Security architecture** — auth redesign, secrets management, CORS, input validation
- **Infrastructure** — containerization, CI/CD, deployment, observability

Write your scoping decisions to: ${targetPath}/.proteus-forge/02-design/scope.json

The scope.json schema:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "design",
  "substage": "scope",
  "generatedAt": "<ISO timestamp>",
  "designDomains": [
    {
      "id": "design-<name>",
      "name": "<Human readable domain name>",
      "specialist": "<name>-designer",
      "implementsFeatures": ["<feat-IDs this domain covers>"],
      "designFocus": "<What this specialist should focus on designing>"
    }
  ]
}
\`\`\`

### Step 3: Create Agent Team

Create an agent team for the design stage. Spawn one teammate per design domain.

Each specialist's spawn prompt should tell them:
1. They are designing the production architecture for a specific domain
2. To read the features.json for context on what the POC does and its issues
3. The source code is at ${sourcePath} if they need to reference implementation details
4. To write their partial design to ${targetPath}/.proteus-forge/02-design/partials/<domain-id>.md (narrative) and ${targetPath}/.proteus-forge/02-design/partials/<domain-id>.json (machine-readable)
5. To message other specialists about cross-domain concerns (API contracts, shared types, data boundaries)

The partial JSON schema for each specialist:
\`\`\`json
{
  "domainId": "<design-domain-id>",
  "specialist": "<specialist-name>",
  "generatedAt": "<ISO timestamp>",
  "services": [
    {
      "id": "svc-<name>",
      "name": "<Service name>",
      "description": "<What this service does>",
      "implementsFeatures": ["<feat-IDs>"],
      "exposedInterfaces": [
        { "type": "REST|GraphQL|gRPC|WebSocket", "path": "<endpoint path>", "methods": ["<HTTP methods>"] }
      ],
      "ownedEntities": ["<entity names>"],
      "discipline": "<backend|frontend|data|devops>"
    }
  ],
  "decisions": [
    {
      "topic": "<What decision was made>",
      "choice": "<The chosen approach>",
      "rationale": "<Why this was chosen>",
      "alternatives": ["<Other approaches considered>"]
    }
  ],
  "crossDomainDependencies": [
    {
      "from": "<this domain>",
      "to": "<other domain>",
      "description": "<What needs to be coordinated>"
    }
  ]
}
\`\`\`

The partial markdown (.md) should be a human-readable narrative of the design for that domain.

### Step 4: Create Tasks

Create a task on the shared task list for each design specialist. Then create a final "synthesize" task that depends on all specialist tasks.

### Step 5: Wait and Synthesize

After all specialist tasks complete, claim the synthesize task. Read all partial designs and produce two unified outputs:

**${targetPath}/.proteus-forge/02-design/design.md** — Human-readable architecture document:
\`\`\`markdown
# Architecture Design — <project name>

**Generated:** <date>
**Architecture Style:** <style>
**Target Stack:** <technologies>

---

## Overview
[narrative description of the target architecture]

## Services / Modules
[for each service/module, describe responsibility, interfaces, owned entities]

## Data Architecture
[database redesign, schema changes, caching strategy, connection management]

## Security Architecture
[auth redesign, secrets management, CORS policy, input validation, authorization]

## Frontend Architecture
[component structure, state management, API client, routing]

## Infrastructure
[containerization, CI/CD, deployment strategy, observability, health checks]

## Migration Notes
[specific callouts from POC that need rework, in priority order]
\`\`\`

**${targetPath}/.proteus-forge/02-design/design-meta.json** — Machine-readable metadata:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "design",
  "generatedAt": "<ISO timestamp>",
  "architectureStyle": "<monolith|modular-monolith|microservices>",
  "targetStack": {
    "runtime": "<runtime and version>",
    "language": "<language and version>",
    "framework": "<backend framework>",
    "database": "<database and version>",
    "cache": "<cache technology if any>",
    "containerization": "<Docker etc>",
    "orchestration": "<K8s, ECS, etc>",
    "ci": "<CI/CD tool>"
  },
  "services": [<merged services from all specialists>],
  "sharedInfrastructure": {
    "apiGateway": <boolean>,
    "centralLogging": "<approach>",
    "monitoring": "<approach>"
  },
  "featureToServiceMap": {
    "<feat-ID>": "<svc-ID>"
  }
}
\`\`\`

Ensure every feature from features.json is mapped to at least one service in featureToServiceMap.

## Important

- Read features.json FIRST before doing anything else.
- The source at ${sourcePath} is READ-ONLY reference material.
- Create the directories ${targetPath}/.proteus-forge/02-design/partials/ before specialists start.
- Design for production quality — address the known issues from inspection.
- Keep the architecture pragmatic — don't over-engineer for a POC-to-production transformation.
`;
}
