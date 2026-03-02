# Cost Tracking

Every stage reports token usage and estimated cost. View the breakdown:

```bash
proteus-forge costs
```

Costs are stored in `.proteus-forge/costs.json`:

```json
{
  "stages": {
    "inspect": { "duration": "4m 11s", "estimatedCost": 0.76 },
    "design": { "duration": "11m 41s", "estimatedCost": 1.05 },
    "plan": { "duration": "8m 47s", "estimatedCost": 1.17 },
    "split": { "duration": "2m 52s", "estimatedCost": 0.68 },
    "execute": { "duration": "21m 48s", "estimatedCost": 8.50 }
  },
  "totalCost": 12.16
}
```

## Budget Caps

Use `--budget` on any stage to set a spending cap:

```bash
proteus-forge execute --budget 10.00
proteus-forge run --budget 5.00          # per-stage cap for pipeline runs
```
