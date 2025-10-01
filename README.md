# BDD Card Generator

A powerful CLI workflow that creates Jira issues from Google Docs content using AI for BDD card generation.

## Features

- 🔧 **Interactive Setup**: Easy configuration with guided setup
- 📄 **Google Docs Integration**: Read and normalize content from Google Docs
- 🤖 **AI-Powered BDD Generation**: Use AI to generate BDD-style user stories
- 🎫 **Jira Integration**: Auto-discover required fields and create issues
- 🔄 **Batch Processing**: Create multiple issues from generated cards
- 🧪 **Dry Run Mode**: Test without making actual API calls
- 📊 **Comprehensive Logging**: Detailed progress and error reporting

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd generate-bdd-cards
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Make the CLI globally available (optional):
```bash
npm link
```

## Quick Start

1. **Initialize configuration**:
```bash
npm run dev init
```

2. **Run the complete workflow**:
```bash
npm run dev workflow
```

## Configuration

The CLI uses a `.env.local` file for configuration. Run `init` to set up interactively, or create the file manually:

### Jira Configuration
```env
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token
JIRA_PROJECT_KEY=PROJ
JIRA_ISSUE_TYPE=Story
JIRA_BOARD_ID=123
JIRA_DEFAULT_LABELS=feature,enhancement
JIRA_PRIORITY=Medium
```

### Google Docs Configuration
```env
GOOGLE_DOCS_DOCUMENT_ID=your_document_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### Gepeto Configuration
```env
GEPETO_API_BASE=https://your-gepeto-instance.com
GEPETO_API_KEY=your_gepeto_api_key
GEPETO_MODEL=gpt-4
GEPETO_ENDPOINT=/v1/chat/completions
```

### App Configuration
```env
APP_MODE=dry-run  # or 'live'
```

## Commands

### `init`
Interactive setup and configuration generation.

```bash
npm run dev init
```

### `jira:validate`
Discover required fields for your Jira project and issue type.

```bash
npm run dev jira:validate
```

### `jira:create-example`
Create one example issue assigned to you.

```bash
npm run dev jira:create-example
```

### `gdocs:read`
Read and normalize content from a Google Docs document.

```bash
npm run dev gdocs:read
```

### `gepeto:generate`
Generate BDD-style cards from document content.

```bash
npm run dev gepeto:generate
```

### `jira:create-batch`
Create Jira issues from generated BDD cards.

```bash
npm run dev jira:create-batch
```

### `workflow`
Run the complete workflow: read docs → generate cards → create issues.

```bash
npm run dev workflow
```

## Usage Examples

### Basic Workflow

1. **Set up configuration**:
```bash
npm run dev init
```

2. **Test with dry run**:
```bash
npm run dev workflow --dry-run
```

3. **Run live**:
```bash
npm run dev workflow --live
```

### Step-by-Step Workflow

1. **Read Google Docs**:
```bash
npm run dev gdocs:read
```

2. **Generate BDD cards**:
```bash
npm run dev gepeto:generate
```

3. **Preview and create issues**:
```bash
npm run dev jira:create-batch
```

### Using Custom Files

```bash
# Use a specific document file
npm run dev gepeto:generate --file custom-doc.md

# Use specific BDD cards file
npm run dev jira:create-batch --file custom-cards.json
```

## Authentication Setup

### Jira Authentication

#### API Token (Recommended)
1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Create a new API token
3. Use your email and the API token for authentication

#### OAuth 2.0 (Advanced)
1. Create an OAuth app in your Atlassian account
2. Use client ID and client secret for authentication

### Google Docs Authentication

#### Service Account (Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Docs API
4. Create a service account
5. Download the JSON key file
6. Share your Google Doc with the service account email

#### OAuth 2.0 (User Consent)
1. Set up OAuth credentials in Google Cloud Console
2. Run the OAuth flow to get user consent
3. Store the token for future use

### Gepeto Authentication
1. Get your API key from the Gepeto service
2. Configure the base URL and endpoint

## BDD Card Format

The generated BDD cards follow this structure:

```json
{
  "summary": "User can login with email and password",
  "description": "As a user, I want to login to the system so that I can access my personal dashboard.",
  "acceptanceCriteria": [
    "Given I am on the login page",
    "When I enter valid email and password",
    "Then I should be redirected to the dashboard"
  ],
  "labels": ["authentication", "user-management"],
  "priority": "High",
  "storyPoints": 3,
  "component": "auth-service",
  "epicLink": "AUTH-123",
  "linkedIssues": ["PROJ-456", "PROJ-789"]
}
```

## Error Handling

The CLI includes comprehensive error handling:

- **Retry Logic**: Automatic retry for network errors and rate limits
- **Field Validation**: Clear error messages for missing required fields
- **Authentication Errors**: Helpful guidance for auth issues
- **API Errors**: Detailed error reporting with field-level hints

## Caching

The CLI caches responses for troubleshooting:

- `.cache/source_doc_latest.md` - Latest document content
- `.cache/bdd_cards_latest.json` - Latest generated cards
- `.cache/gepeto_response_latest.txt` - Raw Gepeto response
- `.cache/*_timestamp.*` - Timestamped versions

## Testing

Run the mock test to verify functionality:

```bash
npm test
```

This will generate sample BDD cards without making external API calls.

## Troubleshooting

### Common Issues

1. **Jira user not found**
   - Verify your email address is correct
   - Check if you have access to the Jira instance

2. **Google Docs access denied**
   - Ensure the document is shared with your service account
   - Check the service account JSON file path

3. **Gepeto API errors**
   - Verify your API key is correct
   - Check the base URL and endpoint configuration

4. **Required fields missing**
   - Run `jira:validate` to see required fields
   - Update your configuration or provide missing values

### Debug Mode

Enable verbose logging for detailed information:

```bash
npm run dev workflow --verbose
```

### Dry Run Mode

Test without making actual API calls:

```bash
npm run dev workflow --dry-run
```

## Development

### Project Structure

```
src/
├── modules/          # API client modules
│   ├── jira.ts      # Jira integration
│   ├── gdocs.ts     # Google Docs integration
│   └── gepeto.ts    # Gepeto integration
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   ├── config.ts    # Configuration management
│   ├── logger.ts    # Logging utilities
│   └── retry.ts     # Retry logic
├── index.ts         # CLI entry point
└── test.ts          # Mock testing
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev <command>
```

## Security Notes

- Never commit `.env.local` or `.env` files
- Store API keys securely
- Use service accounts for Google Docs when possible
- Regularly rotate API tokens

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs in `.cache/` directory
3. Enable verbose mode for detailed information
4. Create an issue in the repository
