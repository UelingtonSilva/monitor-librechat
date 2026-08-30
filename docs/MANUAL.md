# Monitor LibreChat — User Manual

_🇧🇷 [Versão em português](MANUAL.pt-BR.md) · 🛠️ [Technical manual](TECHNICAL_MANUAL.md)_

A complete walkthrough of every screen in the Monitor — the monitoring and audit portal
for a self-hosted LibreChat deployment: adoption, usage, cost, and a shadow-mode security
detector, in one dashboard.

> The screenshots in this manual were taken against an instance running with **example
> (synthetic) data** — that's why every screen shows the yellow "Showing example data"
> banner. The numbers change once connected to a real LibreChat instance; the screens and
> behavior are identical.

## Contents

1. [Overview](#1-overview)
2. [Signing in](#2-signing-in)
3. [General navigation](#3-general-navigation)
4. [Executive Dashboard](#4-executive-dashboard)
5. [Adoption](#5-adoption)
6. [Costs](#6-costs)
7. [Use Cases](#7-use-cases)
8. [Maturity](#8-maturity)
9. [Security & Risk](#9-security--risk)
10. [Alerts / Cases](#10-alerts--cases)
11. [Policies](#11-policies)
12. [Authorized Resources](#12-authorized-resources)
13. [Audit Trail](#13-audit-trail)
14. [Settings](#14-settings)
15. [Operational Status](#15-operational-status)
16. [Optional integrations](#16-optional-integrations)
17. [FAQ](#17-faq)

## 1. Overview

The Monitor LibreChat is an independent portal that reads LibreChat's own database and
shows, in one place, what today is either scattered or simply doesn't exist: who is using
the tool, how much it costs, and whether any usage falls outside what's expected.

**What it shows:** adoption, token usage, cost, use cases by Agent, AI maturity, security
detections, policies, authorized resources, audit trail, and the health of the Monitor
itself.

**What it does NOT do:** it never blocks anything. It doesn't intercept prompts. It is
strictly observational — it reads the database after the fact.

**Where the data comes from:** directly from LibreChat's MongoDB, through a dedicated
read-only user. Without that connection, the portal shows clearly-marked example data.

## 2. Signing in

Access uses a single username and password, set by whoever administers the Monitor (not
the same login as LibreChat itself). There are no separate access profiles in this
version — whoever signs in sees everything.

![Login screen](screenshots/login.png)
_The login screen. The footer notice exists because every access to this panel is
recorded in the audit trail (section 13)._

1. Open the Monitor's URL, provided by whoever administers the system.
2. Enter your **User** and **Password**.
3. Click **Sign in**. After eight hours of inactivity, the session expires and you'll
   need to sign in again.

> After several consecutive incorrect password attempts, the system refuses new attempts
> for a few minutes, even with the correct password. This is intentional — wait a bit and
> try again.

## 3. General navigation

After signing in, three elements appear on every screen:

**Sidebar** — organized by purpose, not alphabetically: **Overview** (day-to-day —
dashboard, adoption, costs), **Governance** (security, policies, alerts), and
**Platform** (audit, settings, status). It can be collapsed via the "Collapse" button at
the bottom, to gain screen space.

**Language** — the **EN** / **PT** buttons at the top switch the interface language
instantly, with no page reload. The choice is saved in the browser — next time you open
the Monitor, it remembers.

**Auto-refresh** — the whole portal refreshes itself every **60 seconds** — the "Updated
Ns ago" indicator on the Dashboard shows the time since the last refresh. No manual reload
needed.

> Most screens have a period selector (From / to, or shortcuts like 7d / 30d / 90d). The
> chosen period affects that screen's numbers only — changing the period on Costs doesn't
> change the Dashboard's period.

## 4. Executive Dashboard

The first screen after signing in. Brings the most important numbers together in one
place, for a quick read of the overall state of AI usage in the organization.

![Executive Dashboard](screenshots/dashboard.png)
_Executive Dashboard with example data. The top cards, the hourly token chart, the
per-role radar, and the numbers-by-role table._

### The cards

| Card | What it means |
|---|---|
| **Users** | Total enabled users and how many were active in the period. Clickable — opens the full user list. |
| **Input / output / total tokens** | Token volume consumed (what was sent to the model and what it answered). |
| **Cost (USD)** | Estimated cost for the period, always in dollars. See the Costs section for how this figure is computed. |
| **Files generated / Prompts / Conversations** | Raw usage volume for the period. |
| **Conduct** | A statistical indicator (not a fixed rule) comparing the most recent consumption against the historical mean. Clickable — opens the period's security detections in detail. |

### Clickable cards

Two cards open a more detailed window when clicked:

![Users detail dialog](screenshots/dialog-usuarios.png)
_Clicking the "Users" card opens the full list, sorted by most recent access — with
status (active/inactive), role, tokens consumed, and last-access date._

> "Last access" is the more recent of sign-in and actual tool usage. This exists because
> a LibreChat session lasts 7 days and isn't renewed on every access — using sign-in
> alone would leave this information stale.

### Hourly token chart

Shows input, output, and a moving average (smooths out isolated spikes) over time. The
bucket width (hourly, every 6h, or daily) adjusts itself based on the selected period, so
the chart never turns into a wall of tiny bars.

### Radar and role table

The radar chart compares usage profile across roles (tokens, prompts, conversations,
active days, distinct models and Agents — all normalized per *active* user, not total
users, so a "small role" isn't confused with "a role that uses little"). The table next
to it shows the same numbers as a list, flagging roles that had no usage in the period or
accessed models outside their configured allowlist.

## 5. Adoption

How many people actually use the tool, and how often — separate from usage volume (which
lives in Costs and the Dashboard).

![Adoption screen](screenshots/adoption.png)
_DAU, WAU, MAU, activation rate, a daily active-users series, and adoption broken down by
role._

- **DAU / WAU / MAU** — users with real consumption (not just sign-in) in the last day,
  7 days, and 30 days — fixed windows, independent of the period selected on this screen.
- **Activation rate** — the share of enabled users who actually used the tool in the
  selected period.
- **Adoption by role** — how many users of each role are enabled versus how many were
  active — quickly shows where adoption is low.

## 6. Costs

How much AI usage cost during the period, broken down by role, model, and area.

![Costs screen](screenshots/costs.png)
_Total cost, highest-cost role, verified-price percentage, cost per day, by role, by
model, and by area._

### Two ways to compute cost

This is the only screen whose behavior changes depending on the environment's
configuration — worth understanding both modes:

| Mode | When it appears | What it means |
|---|---|---|
| **Verified pipeline** | When the environment has its own cost-apportioning collection configured | Real cost in dollars, with a "verified price" flag separating what came from a confirmed source from what's still an estimate from that same source. |
| **Estimate** | Default — no cost collection configured | Cost computed from the real token count multiplied by an internal price table (approximate, subject to review). Still real data — only the dollar figure is estimated. |

The screen always states, right below the title, which of the two modes is active — no
guessing required.

> "Cost by area" only appears when the verified pipeline is configured, because
> area/cost-center isn't something LibreChat stores natively — it only exists if an
> external source provides it. See section 16 (Optional integrations).

## 7. Use Cases

What AI is being used for — today, measured indirectly, through the corporate Agent used.

![Use Cases screen](screenshots/use-cases.png)
_Usage by corporate Agent (as a proxy for "use case") and overall volume of
conversations, prompts, and tokens._

> Classifying each conversation's real purpose (professional, personal, by category)
> would require analyzing message content with an AI model — a decision that needs prior
> approval from Security, Governance, and whoever owns data privacy, which this version
> of the Monitor doesn't implement. The Agent used is the best available proxy today: it
> indicates the domain of the query without needing to read the content.

## 8. Maturity

A reference model for assessing how mature AI adoption is in the organization — today,
documentational: the criteria and levels are defined, but automatic score calculation
isn't implemented yet.

![Maturity screen](screenshots/maturity.png)
_The seven proposed dimensions (with weight and expected evidence) and the six maturity
levels, from "Not used" to "Multiplier"._

The screen is transparent about the limitation: showing a calculated number without the
criteria actually being measured would be worse than showing nothing.

## 9. Security & Risk

The Monitor's security detector, running in **shadow mode**: it detects and logs, but
never blocks anything.

![Security & Risk screen](screenshots/security.png)
_Detection counts by severity and the period's detection list, with evidence always
masked._

### What's detected today

Five policies actually run, all through local pattern matching — no content is ever sent
to an AI model for this analysis, and none of the original text is stored:

- **Credential or API-key exposure**
- **Explicit password or token in the conversation**
- **Private-key material**
- **Personal identifier** (national-ID pattern)
- **Model usage outside a role's allowlist** (compared against LibreChat's real
  configuration)

The rest of the catalog (see section 11, Policies) is registered for traceability but
doesn't produce detections yet — it depends on semantic content classification, a future
phase.

> No policy is in blocking (enforcement) mode. Every row in the "Decision" column shows
> `ALLOW` — the Monitor is observing, not intercepting.

## 10. Alerts / Cases

The same detections from the Security screen, presented as a filterable alert board —
built for case-by-case investigation.

![Alerts / Cases screen](screenshots/alerts.png)
_Filters by severity and by policy, and the alert table with status._

This screen is read-only in this version — a full triage workflow (claiming a case,
marking a false positive, closing it) would need its own access control, not yet
implemented. For now, handling an alert happens outside the portal, through the
organization's existing security process.

## 11. Policies

The complete catalog of planned AI governance policies, versioned as a file — not as a
database record.

![Policies screen](screenshots/policies.png)
_Catalog of 20 policies: the ones actually running (shadow mode) and the ones awaiting a
future phase._

> Each policy lives in its own `policy.yaml` file inside the policy directory. Adding or
> adjusting a policy means editing that file — no code change or rebuild required.

## 12. Authorized Resources

Which models, Agents, and integrations each role may use — the reference the "model
outside the allowlist" policy compares against.

![Authorized Resources screen](screenshots/resources.png)
_Model allowlist by role (read live from LibreChat's own configuration), corporate
Agents, and MCP integrations._

The model allowlist isn't the Monitor's own record — it's read directly from LibreChat's
configuration, the same source the chat itself uses. That keeps the portal from holding a
stale copy the moment someone changes the configuration through LibreChat.

## 13. Audit Trail

Two distinct audit trails, on the same screen: who accessed the Monitor itself, and who
used the corporate integrations via MCP.

![Audit Trail screen](screenshots/audit.png)
_Corporate MCP queries and the Monitor's own access history — method, route, status, and
duration for each call._

> The Monitor's own access history lives in memory — it's lost when the service
> restarts. Long-term persistence arrives together with more granular access control, not
> yet implemented in this version.

## 14. Settings

A reference for what's configured today, and for how role-based access control will work
once it's ready — for now, documentational.

![Settings screen](screenshots/settings.png)
_Planned access roles (RBAC) and where each system parameter comes from._

In this version, the Monitor has a single shared login — no differentiated access roles.
The RBAC design shown here is the target for once dedicated authentication is
implemented; don't rely on this screen as effective access control today.

## 15. Operational Status

The Monitor's own health: is it connected to MongoDB? does the data match the expected
shape? which optional integrations are turned on?

![Operational Status screen](screenshots/status.png)
_Overall status, MongoDB connection, availability targets (SLOs), and the optional
integrations panel._

This is the most useful screen for whoever is setting up the Monitor for the first time —
it answers, on its own, "what will work with my environment" without needing to read any
config file. See the next section for detail on each optional integration.

## 16. Optional integrations

The Monitor was built to work with real data against any LibreChat instance, with no
configuration beyond the database connection. Three features, however, are optional —
they ship off by default and only turn on once someone configures them explicitly:

| Feature | Off (default) | On |
|---|---|---|
| **Cost pipeline** | Costs uses a token × price estimate | Costs uses an external, already-apportioned cost collection |
| **MCP audit** | The MCP section of Audit Trail shows example data | Reads the real history of configured MCP integrations |
| **MCP integrations catalog** | No integration registered in Authorized Resources | Shows the integrations and which roles may use them |

None of the three requires touching code — they're config files and environment
variables. See the [technical manual](TECHNICAL_MANUAL.md) for the exact configuration.

## 17. FAQ

**Are the numbers I'm seeing real?**
If the yellow "Showing example (synthetic) data" banner appears, no — it's a
demonstration, with no connection to LibreChat's MongoDB. Without that banner, the
numbers are real.

**Why did cost change differently between two visits?**
Check whether the Costs screen is in "estimate" or "verified pipeline" mode (section 6)
— the two use different sources and aren't directly comparable period over period if the
configuration changed in between.

**Can I use the Monitor to block a user or a prompt?**
No. The Monitor is observational on every screen — it never intercepts or prevents a
conversation. Any blocking action has to happen in LibreChat's own configuration.

**I forgot the Monitor's login password.**
Talk to whoever administers the environment — password reset happens outside the portal,
directly in the service's configuration.

---

_User manual — English edition. Created by **Uelington Silva**. Supported by **Dimep
Sistemas**._
