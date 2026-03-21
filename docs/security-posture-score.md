# Security Posture Score

The Security Posture Score gives you a single **0–100 number** that reflects the overall security health of your architecture diagram. It's computed by AI against five security dimensions and saved over time so you can track improvement trends.

> **Requires:** A cloud project with a signed-in account.

---

## Open the Posture Score Panel

**Toolbar → Threat Model → Posture Score**

The panel docks to the right side of the canvas. On first open, a score is computed automatically for the current diagram.

---

## Reading the Score

```
         72
       ╱    ╲       Fair
      │  72  │
       ╲    ╱
```

| Range | Color | Label |
|-------|-------|-------|
| 80–100 | Green | Good |
| 60–79 | Amber | Fair |
| 40–59 | Orange | Poor |
| 0–39 | Red | Critical |

The score also appears as a color-coded badge on the **Threat Model** toolbar button, so you can see the current score at a glance without opening the panel.

---

## The Five Dimensions

The AI evaluates your architecture against five dimensions, each worth up to 20 points:

| Dimension | What it measures |
|-----------|-----------------|
| **Attack Surface** | How many external-facing entry points exist and whether they are protected |
| **Identity Posture** | Presence of authentication, authorization, and identity controls |
| **Data Protection** | Encryption at rest and in transit, secrets management, data classification |
| **Network Segmentation** | Use of trust boundaries, isolation between tiers, internal firewall signals |
| **Resilience & Monitoring** | Redundancy, circuit breakers, rate limiting, logging, and audit controls |

Each dimension shows:
- **Score / Max** (e.g., `14/20`)
- A horizontal **progress bar** (green / amber / orange / red)
- A collapsible **rationale** explaining the score for that dimension

---

## Deductions and Strengths

Below the dimensions, the panel lists specific findings that affected the score:

**Deductions** (red, with points lost)

```
⚠ No trust boundaries defined in diagram           -5
⚠ External API has no authentication signal        -3
```

**Strengths** (green, with points credited)

```
✓ Database nodes are isolated in internal zone     +2
✓ Multiple redundant service nodes detected        +2
```

---

## Top Recommendations

The panel ends with **1–3 prioritized recommendations** — concrete, architecture-level actions you can take to raise your score:

> 1. Add a Trust Boundary node around database and internal services to make network segmentation explicit.
> 2. Label edges from external nodes with authentication method (e.g., "JWT", "API Key") to signal identity controls.

---

## Recalculate

The score is computed against the diagram at the time you open the panel. If you make changes to the diagram (add trust boundaries, relabel nodes, add services), click **Recalculate** in the panel footer to get a fresh score.

Each recalculation is saved to the database and appears in the history.

---

## Extended Thinking

Check **"Use extended thinking"** before clicking Recalculate to run the analysis with Claude's extended reasoning mode. This takes longer (up to 60 seconds) but produces more nuanced dimension scores and recommendations — particularly useful for complex multi-layer diagrams.

---

## Score History

Click the **History** icon (clock) in the panel header to see a trend chart of past scores.

- **Sparkline chart** — scores over time, oldest to newest
- **History list** — click any past score to load it into the panel view
- Each entry shows: score, diagram version, date, and a ⚡ badge if extended thinking was used

Use the trend to verify that architectural changes you make are actually improving the score over time.

---

## Tips for a Higher Score

| Action | Why it helps |
|--------|-------------|
| Add Trust Boundary nodes | Signals network segmentation (+Network Segmentation) |
| Label edges with auth method | Signals identity controls (+Identity Posture) |
| Add a WAF or API Gateway node at the entry point | Reduces attack surface (+Attack Surface) |
| Add a logging/monitoring node (e.g., CloudWatch, Datadog) | Signals observability (+Resilience & Monitoring) |
| Label database edges with "TLS" or "encrypted" | Signals data protection (+Data Protection) |
| Add redundant nodes for critical services | Signals resilience (+Resilience & Monitoring) |

> The AI reads **node labels, types, descriptions, and trust levels**. The more descriptive your diagram, the more accurate the score.

---

## Next Steps

- [Attack Mind Simulator](./attack-mind-simulator.md) — see exactly which paths an attacker would take
- [STRIDE Threat Analysis](./stride-threat-analysis.md) — get a per-node threat breakdown
- [Threat Dashboard](./threat-dashboard.md) — manage all identified threats
