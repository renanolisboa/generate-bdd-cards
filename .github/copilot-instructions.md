# BDD Card Generator - AI Coding Agent Instructions

## Project Overview
A TypeScript CLI tool that reads Google Docs requirements, uses AI (Gepeto or Gemini) to generate BDD-style user stories, and creates Jira issues. Built with Commander.js, uses ESM modules (`type: "module"`), and emphasizes OAuth/SSO authentication over service accounts.

## Architecture & Data Flow

**Five Core Modules** (`src/modules/`):
1. **auth.ts**: `GoogleAuthManager` - OAuth2 flow with token persistence (`.google_tokens.json`, `.gemini_tokens.json`)
2. **gdocs.ts**: `GoogleDocsClient` - Reads/normalizes Google Docs content
3. **gepeto.ts**: `GepetoClient` - Internal AI with smart truncation strategies (15k char limit)
4. **gemini.ts**: `GeminiClient` - Google Gemini AI as alternative
5. **jira.ts**: `JiraClient` - Auto-discovers required fields, creates issues with Basic Auth

**Standard Workflow**: `gdocs:read` → `.cache/source_doc_latest.md` → `cards:generate` → `.cache/bdd_cards_latest.json` → `jira:create-batch`

## Critical Development Patterns

### Configuration System
- **ConfigManager** (`src/utils/config.ts`) uses Zod schemas for validation
- Environment: `.env.local` (never commit)
- Interactive setup via `inquirer` when config missing
- **Dry-run default**: `mode: 'dry-run'` unless `--live` flag or `APP_MODE=live`

### AI Provider Selection
```typescript
// In index.ts: generateBDDCardsWithProvider()
// Logic: --ai flag > interactive prompt (if both configured) > fallback to available
// Always use this wrapper, never call GepetoClient/GeminiClient directly in commands
```

### Error Handling & Retry
- **RetryManager** (`src/utils/retry.ts`): 3 attempts, exponential backoff, retries on 5xx/429/network errors
- Wrap all API calls: `await RetryManager.execute(async () => ...)`
- **ApiResponse pattern**: All modules return `{ success: boolean, data?: T, error?: string }`

### Authentication Flow
1. Check `isAuthenticated()` - auto-refreshes tokens if expired
2. If invalid: `authenticate()` - opens browser OAuth flow on `http://localhost:3000`
3. Tokens saved to disk, loaded on subsequent runs
4. **Critical**: Google Docs OAuth (`documents.readonly`) ≠ Gemini OAuth (`generative-language`) - separate tokens

### URL Parsing
- **link-parser.ts** handles Google Docs and Jira URL extraction
- `quick-create` command bypasses config for direct URL-based workflow
- Example: `npm run quick-create <docs-url> <jira-url> --live`

## Key Commands & Testing

```bash
# Development (uses tsx for direct execution)
npm run dev <command>              # Main CLI entry point

# Common workflows
npm run quick-create <docs> <jira> --ai gemini --live  # URL-based workflow
npm run dev workflow --ai gepeto   # Traditional config-based workflow

# Testing individual components
npm run test:gepeto                # Test Gepeto AI only
npm run test:gemini                # Test Gemini AI only  
npm run test:gdocs-complete        # Test full Google Docs auth + read
npm run demo:ai                    # Compare both AI providers

# Authentication
npm run auth:login                 # Google OAuth setup
npm run auth:status                # Check token validity
npm run auth:test                  # Test document access
```

## Code Style & Patterns

- **Singleton Logger**: `Logger.getInstance()` - use `verbose` flag for API call logs
- **Cache directory**: `.cache/` for intermediate files (not committed)
- **Progress feedback**: Use `logger.logStep(step, total, current)` for multi-step operations
- **BDD card schema**: Validated with Zod (`BDDCardSchema`) - requires `summary`, `description`, `acceptanceCriteria[]`

## Jira Field Mapping Deep Dive

### Field Discovery Pattern
```typescript
// ALWAYS call this before creating issues
const fieldsResult = await jiraClient.discoverRequiredFields();
// Returns all required fields for the project/issue type combination
```

### buildIssuePayload Structure
The `JiraClient.buildIssuePayload()` method creates Jira-compatible payloads:

```typescript
// Standard fields (always present)
{
  fields: {
    project: { key: "PROJ" },
    issuetype: { name: "Story" },
    summary: "User story title (max 80 chars)",
    description: { /* ADF format - see below */ },
    assignee: { accountId: "user-account-id" },
    labels: ["bdd", "automated"]
  }
}
```

### Jira Description Format (ADF - Atlassian Document Format)
Jira uses a structured JSON format for descriptions:

```typescript
// Example from buildDescription()
{
  type: "paragraph",
  content: [{ type: "text", text: "Main description text" }]
}
// Acceptance criteria as bullet list
{
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text: "Acceptance Criteria" }]
}
{
  type: "bulletList",
  content: [{
    type: "listItem",
    content: [{
      type: "paragraph",
      content: [{ type: "text", text: "Criterion 1" }]
    }]
  }]
}
```

### Custom Field Mapping
Custom fields are project-specific. Common mappings in `buildIssuePayload()`:

```typescript
// Story Points (varies by Jira instance)
case 'customfield_10016':
  if (card.storyPoints) payload.fields[field.id] = card.storyPoints;

// Epic Link
case 'customfield_10014':
  if (card.epicLink) payload.fields[field.id] = card.epicLink;
```

**To add new custom field**: Discover field ID via `jira:validate` command, then add mapping in `buildIssuePayload()` switch statement.

## Common Modification Patterns

### Adding a New Command
```typescript
// In src/index.ts
program
  .command('my-new-command')
  .description('Brief description')
  .option('-f, --file <path>', 'Optional file path')
  .action(async (options: CommandOptions & { file?: string }) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      // Respect dry-run mode
      if (config.mode === 'dry-run') {
        logger.info('DRY RUN MODE - No actual API calls will be made');
        return;
      }
      
      // Your command logic here
      
    } catch (error) {
      logger.error(`Command failed: ${error}`);
      process.exit(1);
    }
  });
```

### Adding a New AI Provider
```typescript
// 1. Create src/modules/newprovider.ts
export class NewProviderClient {
  async generateBDDCards(documentContent: string): Promise<ApiResponse<BDDCard[]>> {
    // Implement AI generation logic
    // MUST return ApiResponse<BDDCard[]> matching existing pattern
  }
}

// 2. Add config schema in src/types/index.ts
export const NewProviderConfigSchema = z.object({
  apiKey: z.string(),
  model: z.string().default('default-model'),
});

// 3. Add to AppConfigSchema
export const AppConfigSchema = z.object({
  // ... existing fields
  newProvider: NewProviderConfigSchema.optional(),
});

// 4. Update generateBDDCardsWithProvider() in src/index.ts
const hasNewProvider = config.newProvider?.apiKey;
// Add to selection logic and client initialization
```

### Extending BDD Card Schema
```typescript
// In src/types/index.ts
export const BDDCardSchema = z.object({
  summary: z.string().max(80),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  // Add new field with validation
  newField: z.string().optional(),
  complexField: z.object({
    subfield1: z.string(),
    subfield2: z.number(),
  }).optional(),
});

// Then update src/modules/jira.ts buildIssuePayload() to map it
```

### Adding OAuth Authentication to New Service
```typescript
// Pattern from GoogleAuthManager (src/modules/auth.ts)
export class NewServiceAuthManager {
  private oauth2Client: any;
  private tokenPath: string = '.newservice_tokens.json';
  
  async isAuthenticated(): Promise<boolean> {
    // Check token existence and expiry
    // Auto-refresh if expired
  }
  
  async authenticate(): Promise<ApiResponse<void>> {
    // 1. Generate auth URL
    // 2. Start local server on port 3000
    // 3. Open browser with auth URL
    // 4. Receive callback with code
    // 5. Exchange code for tokens
    // 6. Save tokens to disk
  }
  
  getAuthenticatedClient() {
    // Return configured client with credentials
  }
}
```

## Common Task Code Snippets

### Reading Cached Document
```typescript
import { readFileSync } from 'fs';
const documentContent = readFileSync('.cache/source_doc_latest.md', 'utf8');
```

### Generating Cards with Specific AI
```typescript
// Force specific provider
const result = await generateBDDCardsWithProvider(
  documentContent, 
  config, 
  'gemini' // or 'gepeto'
);

if (result.success && result.data) {
  // Save to cache
  writeFileSync('.cache/bdd_cards_latest.json', JSON.stringify(result.data, null, 2));
}
```

### Creating Single Jira Issue
```typescript
const jiraClient = new JiraClient(config.jira);

// Discover fields first
const fieldsResult = await jiraClient.discoverRequiredFields();
if (!fieldsResult.success) throw new Error(fieldsResult.error);

// Get assignee
const userResult = await jiraClient.findUser(config.jira.email);
if (!userResult.success) throw new Error(userResult.error);

// Build and create
const payload = jiraClient.buildIssuePayload(
  bddCard, 
  userResult.data.accountId, 
  fieldsResult.data
);
const createResult = await jiraClient.createIssue(payload);
```

### Wrapping API Call with Retry
```typescript
import { RetryManager } from './utils/retry.js';

const response = await RetryManager.execute(async () => {
  return await axios.get('https://api.example.com/data');
}, {
  maxAttempts: 5,
  baseDelay: 2000,
  retryCondition: (error) => {
    // Custom retry logic
    return error.response?.status === 429 || error.response?.status >= 500;
  }
});
```

### Parsing User-Provided URLs
```typescript
import { parseGoogleDocsUrl, parseJiraUrl, isValidUrl } from './utils/link-parser.js';

// Validate first
if (!isValidUrl(userUrl)) {
  logger.error('Invalid URL provided');
  process.exit(1);
}

// Extract structured info
const docsInfo = parseGoogleDocsUrl(docsUrl);
// Returns: { documentId: string, url: string }

const jiraInfo = parseJiraUrl(jiraUrl);
// Returns: { baseUrl: string, projectKey?: string, boardId?: string, url: string }
```

### Interactive Prompt Example
```typescript
import inquirer from 'inquirer';

const { provider } = await inquirer.prompt([
  {
    type: 'list',
    name: 'provider',
    message: 'Choose AI provider:',
    choices: [
      { name: 'Gepeto (Internal)', value: 'gepeto' },
      { name: 'Google Gemini', value: 'gemini' },
    ],
    default: 'gepeto',
  },
]);
```

## Common Pitfalls

1. **OAuth scope mismatch**: Google Docs needs `documents.readonly`, Gemini needs `generative-language`
2. **Gepeto endpoint**: Must include `/chat/completions` or configured endpoint, not just base URL
3. **Jira field discovery**: Always call `discoverRequiredFields()` before creating issues - required fields vary by project
4. **ESM imports**: Use `.js` extensions in imports even for `.ts` files (required for ESM)
5. **Document truncation**: Gepeto has 15k char limit - `GepetoClient` has 3 fallback strategies (truncate, excerpt, minimal)
6. **ADF format**: Jira descriptions must use Atlassian Document Format (JSON structure), not plain text
7. **Rate limiting**: Add 500ms delays between batch Jira requests to avoid 429 errors
8. **Token refresh**: Always check `isAuthenticated()` before API calls - tokens auto-refresh but auth might fail

## Recent Major Changes
- **AI selection system** (docs/AI_SELECTION_IMPLEMENTATION.md): Interactive provider choice, `--ai` flag support
- **Gemini OAuth** (docs/GEMINI_2_OAUTH_IMPLEMENTATION.md): OAuth2 flow for Gemini API, not just API key
- **SSO Authentication** (docs/SSO_AUTHENTICATION.md): Full OAuth implementation replacing service accounts
