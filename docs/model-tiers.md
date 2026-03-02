# Model Tiers

Proteus Forge uses a three-tier system that decouples agent roles from specific models. Configure in `~/.proteus-forge/config.json`:

```json
{
  "tiers": {
    "fast": { "provider": "anthropic", "model": "claude-haiku-4-5" },
    "standard": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "advanced": { "provider": "anthropic", "model": "claude-opus-4-6" }
  }
}
```

## Default Role-to-Tier Mapping

| Role | Tier | Used By |
|------|------|---------|
| scout | fast | Inspect stage Lead |
| inspect-specialist | standard | Inspect domain specialists |
| design-specialist | advanced | Design stage Lead and specialists |
| plan-generator | standard | Plan and split stage Leads |
| execute-agent | advanced | Execute stage Lead and teammates |
| qa-agent | standard | QA track agents |

## Per-Project Overrides

Override per-project in `{target}/.proteus-forge/config.json`:

```json
{
  "overrides": {
    "roles": {
      "execute-agent": { "provider": "openai", "model": "o3" }
    }
  }
}
```

## Discovering Available Models

```bash
proteus-forge list-models              # show current tier config
proteus-forge list-models --available  # fetch models from API
```
