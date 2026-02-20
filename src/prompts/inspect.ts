/**
 * Generates the Lead (scout) prompt for the inspect stage.
 * This prompt tells the Lead to:
 * 1. Scout the source repo to identify domains
 * 2. Create an Agent Team with specialist teammates
 * 3. Create tasks on the shared task list
 * 4. Wait for specialists to complete, then synthesize
 */
export function generateInspectLeadPrompt(
  sourcePath: string,
  targetPath: string
): string {
  return `You are the Scout for a Proteus Forge inspection. Your job is to analyze a source codebase and coordinate a team of domain specialists to produce a comprehensive feature inventory.

## Source Repository (READ-ONLY)

Path: ${sourcePath}

Do NOT modify any files in this directory. It is a proof-of-concept that you are analyzing.

## Target Repository (write artifacts here)

Path: ${targetPath}

Write all inspection outputs under: ${targetPath}/.proteus-forge/01-inspect/

## Instructions

### Step 1: Scout the Source

Analyze the source repository at ${sourcePath}. Scan:
- File tree structure (directories, key files)
- Package manifests (package.json, requirements.txt, Cargo.toml, go.mod, etc.)
- Entry points (main files, index files, server startup)
- Configuration files (.env, docker-compose.yml, Dockerfile, CI configs)
- README and documentation
- Test directories and coverage

Identify the major domains of concern. Domains are functional areas like:
- Authentication & Security
- Data Layer (database, ORM, migrations)
- API / Service Layer (routes, controllers, services)
- Frontend / UI (components, state management, routing)
- DevOps / Infrastructure (Docker, CI/CD, deployment)
- Real-time / Messaging (WebSocket, queues)
- External Integrations (payment, email, storage)

Write your scout findings to: ${targetPath}/.proteus-forge/01-inspect/scout.json

The scout.json should contain:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "inspect",
  "substage": "scout",
  "generatedAt": "<ISO timestamp>",
  "source": {
    "path": "${sourcePath}",
    "name": "<repo name>",
    "fileCount": <number>,
    "primaryLanguage": "<language>"
  },
  "domains": [
    {
      "id": "domain-<name>",
      "name": "<Human readable domain name>",
      "specialist": "<name>-inspector",
      "entryFiles": ["<paths in source repo to start analyzing>"],
      "rationale": "<why this domain was identified>"
    }
  ]
}
\`\`\`

### Step 2: Create Agent Team

Create an agent team to inspect this codebase. For each domain you discovered, spawn a teammate as a specialist inspector.

Each specialist's spawn prompt should tell them:
1. They are inspecting a specific domain of the source at ${sourcePath} (read-only)
2. Which entry files to start with
3. To write their findings to ${targetPath}/.proteus-forge/01-inspect/partials/<domain-id>.json
4. To message other teammates about any cross-domain dependencies they discover
5. The schema for their partial output (see below)

The partial output schema for each specialist:
\`\`\`json
{
  "domainId": "<domain-id>",
  "specialist": "<specialist-name>",
  "generatedAt": "<ISO timestamp>",
  "features": [
    {
      "id": "feat-<NNN>",
      "name": "<Feature name>",
      "description": "<What this feature does>",
      "category": "<security|core-domain|infrastructure|frontend|devops|integration>",
      "sourceFiles": ["<files that implement this feature>"],
      "dependencies": ["<feat-IDs this depends on>"],
      "dependents": [],
      "complexity": "<low|medium|high>",
      "pocQuality": "<prototype|functional|solid>",
      "notes": "<Issues, gaps, or observations>"
    }
  ],
  "patterns": {
    "<key>": "<domain-specific structural observations>"
  },
  "crossDomainDependencies": [
    {
      "from": "<this domain-id>",
      "to": "<other domain-id>",
      "reason": "<why this dependency exists>"
    }
  ],
  "risks": ["<issues and risks found>"]
}
\`\`\`

Assign unique feature IDs across all specialists: specialist 1 uses feat-001 through feat-099, specialist 2 uses feat-100 through feat-199, etc. This prevents ID collisions during synthesis.

### Step 3: Create Tasks

Create a task on the shared task list for each domain specialist. Then create a final "synthesize" task that depends on all specialist tasks completing first.

### Step 4: Wait and Synthesize

Wait for all specialist tasks to complete. Then claim the synthesize task.

Read all partial findings from ${targetPath}/.proteus-forge/01-inspect/partials/ and merge them into a unified features.json.

During synthesis:
- Merge all features into a single array
- Resolve cross-domain dependencies (update feature \`dependencies\` and \`dependents\` fields)
- Deduplicate any features found by multiple specialists
- Compile all risks into a \`knownIssues\` array
- Identify the data model (database, ORM, entities)
- Identify external integrations
- Write a summary of the overall POC

Write the final output to: ${targetPath}/.proteus-forge/01-inspect/features.json

The features.json schema:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "inspect",
  "generatedAt": "<ISO timestamp>",
  "source": {
    "path": "${sourcePath}",
    "name": "<repo name>",
    "primaryLanguage": "<language>",
    "languages": ["<all languages found>"],
    "frameworks": ["<all frameworks found>"],
    "entryPoints": ["<main entry files>"],
    "testCoverage": "<none|minimal|moderate|comprehensive>"
  },
  "features": [<merged features array>],
  "dataModel": {
    "store": "<database type>",
    "ormOrDriver": "<ORM or driver>",
    "entities": ["<entity names>"],
    "schemaFile": "<path to schema file if any>"
  },
  "integrations": [
    {
      "name": "<service name>",
      "type": "<payment|email|storage|messaging|etc>",
      "status": "<active|stubbed|partial>",
      "sourceFiles": ["<files>"]
    }
  ],
  "knownIssues": ["<all risks and issues>"],
  "summary": "<1-2 sentence summary of the POC>"
}
\`\`\`

## Important

- The source repo at ${sourcePath} is READ-ONLY. Never modify it.
- Create the directories ${targetPath}/.proteus-forge/01-inspect/partials/ before specialists start writing.
- Ensure all feature IDs are unique across the entire features.json.
- Feature dependencies must reference valid feature IDs (no dangling refs).
- No circular dependencies in the feature graph.
`;
}
