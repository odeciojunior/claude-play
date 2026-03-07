# claude-play Repository Architecture

## 1. Repository Structure Overview

```mermaid
mindmap
  root((claude-play))
    Marketplace Registry
      marketplace.json
      Plugin Catalog
      Owner Metadata
    Plugins
      productivity-tools
        deep-researcher
        report-analyzer
        roadmap-planner
        plan-coordinator
        mermaid-designer
        excalidraw-designer
        wsl-health-check
      marketplace-tools
        new-plugin
        validate-plugin
      sql-server-tools
        sql-performance-monitor
        sql-schema-discovery
        sql-performance-tuner
        tsql-specialist
        sql-code-reviewer
        sql-server-toolkit
      mcp-sql-server
        mcp-sql-server-setup
        setup.sh
      _template
        example-skill
    Automation
      Hooks
        protect-template
        validate-marketplace-json
      Agents
        plugin-reviewer
    Documentation
      CLAUDE.md
      CONTRIBUTING.md
      Design Plans
      Research Reports
```

**Description:** The claude-play repository is a community-driven Claude Code plugin marketplace. At its core is a marketplace registry (`marketplace.json`) that catalogs installable plugins. Four plugins ship with the repo: `productivity-tools` (7 skills for research, analysis, planning, and diagramming), `marketplace-tools` (2 skills for scaffolding and validation), `sql-server-tools` (5 specialized agents + 1 routing skill for SQL Server work), and `mcp-sql-server` (setup skill + bash script for automated MCP server installation). Automation hooks protect the template directory and validate the marketplace catalog on every edit. A `plugin-reviewer` agent provides 3-phase quality reviews. The `_template` directory gives contributors a starting point for new plugins.

---

## 2. Plugin System Architecture

```mermaid
---
config:
  theme: default
---
flowchart TB
  accTitle: Plugin System Architecture
  accDescr: Shows how the marketplace registry, plugins, skills, hooks, and agents relate to each other

  subgraph Marketplace["Marketplace Registry"]
    mktjson[(".claude-plugin/<br/>marketplace.json")]
  end

  subgraph Prod["productivity-tools plugin"]
    prod_pj["plugin.json"]
    dr["deep-researcher"]
    ra["report-analyzer"]
    rp["roadmap-planner"]
    pc["plan-coordinator"]
    md["mermaid-designer"]
    ed["excalidraw-designer"]
    wh["wsl-health-check"]
  end

  subgraph Mkt["marketplace-tools plugin"]
    mkt_pj["plugin.json"]
    np["new-plugin"]
    vp["validate-plugin"]
  end

  subgraph Sql["sql-server-tools plugin"]
    sql_pj["plugin.json"]
    spm["sql-performance-monitor"]
    ssd["sql-schema-discovery"]
    spt["sql-performance-tuner"]
    ts["tsql-specialist"]
    scr["sql-code-reviewer"]
    stk["sql-server-toolkit"]
  end

  subgraph Mcp["mcp-sql-server plugin"]
    mcp_pj["plugin.json"]
    mss["mcp-sql-server-setup"]
    sh["setup.sh"]
  end

  subgraph Hooks["Safety Hooks"]
    pt["protect-template<br/>PreToolUse"]
    vm["validate-marketplace-json<br/>PostToolUse"]
  end

  subgraph Agents["Review Agents"]
    pr["plugin-reviewer"]
  end

  mktjson -->|"registers"| Prod
  mktjson -->|"registers"| Mkt
  mktjson -->|"registers"| Sql
  mktjson -->|"registers"| Mcp

  prod_pj --- dr & ra & rp & pc & md & ed & wh
  mkt_pj --- np & vp
  sql_pj --- spm & ssd & spt & ts & scr & stk
  mcp_pj --- mss & sh

  Mcp -.->|"companion"| Sql

  vm -.->|"validates on edit"| mktjson
  pt -.->|"blocks edits to"| Template["_template/"]
  pr -.->|"reviews"| Prod & Mkt & Sql & Mcp
```

**Description:** The marketplace registry (`marketplace.json`) is the central catalog that registers all four plugins. Each plugin has a `plugin.json` manifest and skill/agent definitions. `sql-server-tools` provides 5 specialized agents routed by a single skill, while `mcp-sql-server` uses a setup skill that orchestrates a bash script for MCP server installation — the two plugins are companions (mcp-sql-server provides database connectivity, sql-server-tools provides expert agents that use it). Two hooks enforce quality: `protect-template` (PreToolUse) prevents modifications to the contributor template, and `validate-marketplace-json` (PostToolUse) validates the catalog schema after every edit. The `plugin-reviewer` agent can perform structured reviews on any plugin.

---

## 3. Contributor Workflow

```mermaid
---
config:
  theme: default
---
flowchart LR
  accTitle: Plugin Contribution Workflow
  accDescr: Shows the steps a contributor follows to add a new plugin to the marketplace

  A([Fork and Clone]) --> B[Copy _template]
  B --> C[Edit plugin.json]
  C --> D[Write SKILL.md files]
  D --> E[Write README]
  E --> F[Open PR]
  F --> G{Maintainer Review}
  G -->|"Changes needed"| H[Address feedback]
  H --> G
  G -->|"Approved"| I[Add to marketplace.json]
  I --> J([Merge to main])
```

**Description:** Contributors fork the repo, copy the `_template` directory, customize the plugin manifest and skill files, write documentation, and open a pull request. A maintainer reviews the PR (potentially aided by the `plugin-reviewer` agent). If changes are needed, the contributor iterates. Once approved, the maintainer registers the plugin in `marketplace.json` and merges.

---

## 4. User Installation Flow

```mermaid
---
config:
  theme: default
---
sequenceDiagram
  participant User
  participant CLI as Claude Code CLI
  participant GH as GitHub Repo
  participant Local as Local Plugin Cache

  User->>CLI: claude plugin marketplace add<br/>odeciojunior/claude-play
  CLI->>GH: Fetch marketplace.json
  GH-->>CLI: Plugin catalog
  CLI-->>User: Marketplace registered

  User->>CLI: claude plugin install<br/>productivity-tools@claude-play
  CLI->>GH: Download plugin source
  GH-->>CLI: plugin.json + skills/
  CLI->>Local: Cache plugin files
  Local-->>CLI: Skills available
  CLI-->>User: Plugin installed
  Note over User,Local: Skills now trigger automatically<br/>based on SKILL.md frontmatter
```

**Description:** Users first register the marketplace by pointing Claude Code CLI at the GitHub repo. The CLI fetches `marketplace.json` to learn what plugins are available. When a user installs a specific plugin, the CLI downloads the plugin source (manifest and skill files), caches them locally, and makes the skills available. From that point, skills trigger automatically based on the `description` field in each SKILL.md frontmatter.

---

## 5. Hook Execution Flow

```mermaid
---
config:
  theme: default
---
stateDiagram-v2
  accTitle: Hook Execution Flow
  accDescr: Shows how PreToolUse and PostToolUse hooks fire during file editing

  [*] --> EditOrWrite: Claude calls Edit or Write

  state PreToolUse {
    check_template: protect-template.sh
  }

  EditOrWrite --> PreToolUse
  PreToolUse --> Blocked: Target is _template/
  PreToolUse --> Execute: Target is not _template/
  Blocked --> [*]

  state PostToolUse {
    validate: validate-marketplace-json.sh
  }

  Execute --> FileModified
  FileModified --> PostToolUse
  PostToolUse --> ValidationPass: Schema valid
  PostToolUse --> ValidationFail: Schema invalid
  ValidationPass --> [*]
  ValidationFail --> [*]
```

**Description:** When Claude Code attempts an Edit or Write operation, two hooks fire. First, the `protect-template` PreToolUse hook checks if the target is inside `_template/` and blocks the operation if so. If allowed, the file is modified, then the `validate-marketplace-json` PostToolUse hook runs to validate the marketplace catalog schema. This ensures the template stays pristine and the catalog remains well-formed.
