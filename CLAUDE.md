# OpenMeta CLI

OpenMeta CLI is a developer's daily open source growth companion that automates the process of finding relevant GitHub issues, generating meaningful commit content, and tracking contribution journey.

## Project Overview

**Purpose:** Help developers maintain daily open source contributions by automating issue discovery and commit generation.

**Core Workflow:**
1. Fetch trending GitHub issues with "good first issue" / "help wanted" labels
2. Use LLM to match issues against user's tech stack and interests
3. Generate research notes or development diaries based on selected issues
4. Commit and push to a private repository (auto-created or user-provided)

## Technology Stack

| Category | Technology |
|----------|------------|
| Runtime | Bun |
| Language | TypeScript |
| CLI Framework | Commander.js |
| Interactive Prompts | Inquirer.js + @inquirer/select |
| GitHub API | Octokit.js (@octokit/rest) |
| LLM API | OpenAI SDK (OpenAI-compatible API) |
| Git Operations | simple-git |
| Config Storage | cosmiconfig (JSON in ~/.config/openmeta/) |
| Encryption | crypto-js (AES encryption for API keys) |
| Logging | chalk (styling) + custom logger |

## Project Structure

```
openmeta-cli/
├── src/
│   ├── cli.ts                 # Entry point, command registration
│   ├── commands/
│   │   ├── init.ts           # Register 'init' command
│   │   ├── daily.ts          # Register 'daily' command
│   │   └── config.ts         # Register 'config' command
│   ├── orchestration/
│   │   ├── init.ts           # Init flow orchestrator
│   │   ├── daily.ts          # Daily workflow orchestrator
│   │   └── config.ts         # Config management orchestrator
│   ├── services/
│   │   ├── github.ts         # GitHub API operations
│   │   ├── llm.ts            # LLM API operations
│   │   ├── git.ts            # Git operations
│   │   └── content.ts        # Content generation formatting
│   ├── infra/
│   │   ├── config.ts         # Config service (load/save/encrypt)
│   │   ├── logger.ts         # Logging utilities
│   │   ├── crypto.ts         # Encryption utilities
│   │   └── prompt-templates.ts # LLM prompt templates
│   └── types/
│       ├── config.types.ts   # Config interfaces
│       ├── content.types.ts  # Content interfaces
│       └── github.types.ts   # GitHub data interfaces
├── bin/
│   └── openmeta.js           # Built CLI binary
└── package.json
```

## Business Logic

### Configuration (init command)

Collects 4 steps of configuration:
1. **GitHub** - PAT token and username
2. **LLM Provider** - Provider (OpenAI/MiniMax), model, API key
3. **User Profile** - Tech stack and focus areas (selector-based)
4. **Target Repository** - Optional, auto-creates `~/.openmeta/openmeta-daily` if not set

Config is stored at `~/.config/openmeta/config.json` with sensitive data (PAT, API keys) AES-encrypted.

### Daily Workflow (daily command)

```
1. Validate config (GitHub credentials, LLM connection)
2. Ensure target repo exists (create on GitHub if needed)
3. Fetch trending issues (label:"good first issue" OR "help wanted", is:open)
4. Filter: exclude assigned/locked issues, keep top 100 by updated time
5. LLM scoring: match each issue against user profile (tech stack, focus areas)
6. Display issues with score >= 60
7. User selects content type: Research Notes or Development Diary
8. Generate content via LLM
9. User can edit content before committing
10. Commit and push to target repository
```

### Issue Matching Algorithm

LLM is prompted to score each issue 0-100 based on:
- Tech stack match (TypeScript vs Python, etc.)
- Focus area alignment (web-dev, backend, ai-ml, etc.)
- Issue complexity and clarity

Issues with score >= 60 are considered relevant and displayed to user.

## CLI Commands

| Command | Description |
|---------|-------------|
| `openmeta init` | Initialize/configure OpenMeta CLI |
| `openmeta daily` | Run daily workflow (fetch, match, generate, commit) |
| `openmeta config view` | Display current configuration |
| `openmeta config set <key> <value>` | Update a config value |
| `openmeta config reset` | Reset to default configuration |

## Future Development Plan

### Phase 1: Stability & Polish (Current Priority)
- [ ] Fix all known bugs and edge cases
- [ ] Add comprehensive error handling
- [ ] Improve logging and debug mode (`--verbose`)

### Phase 2: Daemon Mode
- [ ] Add `openmeta start` command to run as daemon
- [ ] Built-in scheduler (configurable intervals, not just daily)
- [ ] Background execution with log files
- [ ] Graceful shutdown handling
- [ ] Auto-restart on failure

### Phase 3: Enhanced Automation
- [ ] Auto-commit without user confirmation (opt-in)
- [ ] Dry-run mode (`--dry-run`) to preview before committing
- [ ] Scheduled execution without daemon (trigger via system cron)
- [ ] Notification system (Slack/Discord/email on completion)

### Phase 4: Personalization
- [ ] Allow custom tech stack and focus areas (not just preset selectors)
- [ ] Learning from user feedback (thumbs up/down on issues)
- [ ] Custom prompt templates per user
- [ ] Multiple target repositories support

### Phase 5: Ecosystem
- [ ] Publish to npm (`npm install -g openmeta-cli`)
- [ ] VS Code extension integration
- [ ] GitHub App for enhanced features
- [ ] Web dashboard for contribution history

## Development Guidelines

### Building
```bash
bun run build    # Build to bin/openmeta.js
bun run dev      # Run directly with bun
```

### Key Conventions
- Use Bun as runtime (not Node.js)
- Use `bun:sqlite` for any database needs
- Use `Bun.serve()` instead of Express for any HTTP server needs
- Prefer `Bun.file()` over `node:fs` readFile/writeFile
- Use `bun test` for testing

### Adding New LLM Providers
To add a new provider:
1. Add entry to `LLM_PROVIDERS` array in `src/orchestration/init.ts`
2. Include: `name`, `value`, `baseUrl`, and `models` array
3. Provider value must match `LLMProvider` type in `src/types/config.types.ts`

### Config Encryption
API keys are encrypted using AES in `CryptoService`. To decrypt manually:
- Key is derived from machine-specific value
- Config file at `~/.config/openmeta/config.json` should not be committed

## Architecture Notes

### Service Layer Pattern
Each service (github, llm, git, content) is a singleton class with:
- `initialize()` - Setup with config
- Specific operation methods
- Returns results to orchestrator

### Orchestrator Pattern
Each workflow (init, daily) has an orchestrator that:
- Coordinates between services
- Handles user prompts
- Manages flow control
- Throws errors to be caught at CLI entry point

### Config Flow
```
cosmiconfig searches: ~/.config/openmeta/config.json
→ Load JSON
→ Decrypt sensitive fields
→ Return AppConfig object
→ Pass to services
```
