import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import inquirer from 'inquirer';
import { AppConfig, AppConfigSchema, JiraConfig, GoogleDocsConfig, GepetoConfig } from '../types/index.js';
import chalk from 'chalk';

export class ConfigManager {
  private config: AppConfig | null = null;
  private configPath: string;

  constructor(configPath: string = '.env.local') {
    this.configPath = configPath;
  }

  async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    // Load environment variables
    config({ path: this.configPath });

    // Try to load existing config
    if (existsSync(this.configPath)) {
      try {
        const envConfig = this.parseEnvConfig();
        if (envConfig) {
          this.config = envConfig;
          return this.config;
        }
      } catch (error) {
        console.warn(chalk.yellow('Warning: Failed to parse existing config, starting fresh'));
      }
    }

    // Interactive setup
    console.log(chalk.blue('🔧 Setting up configuration...'));
    this.config = await this.interactiveSetup();
    this.saveConfig();
    return this.config;
  }

  private parseEnvConfig(): AppConfig | null {
    try {
      const jiraConfig: JiraConfig = {
        baseUrl: process.env.JIRA_BASE_URL || '',
        email: process.env.JIRA_EMAIL || '',
        apiToken: process.env.JIRA_API_TOKEN,
        oauthClientId: process.env.JIRA_OAUTH_CLIENT_ID,
        oauthClientSecret: process.env.JIRA_OAUTH_CLIENT_SECRET,
        projectKey: process.env.JIRA_PROJECT_KEY || '',
        issueType: process.env.JIRA_ISSUE_TYPE || 'Story',
        boardId: process.env.JIRA_BOARD_ID,
        defaultLabels: process.env.JIRA_DEFAULT_LABELS?.split(',').filter((s: string) => s.trim().length > 0),
        priority: process.env.JIRA_PRIORITY,
      };

      const googleDocsConfig: GoogleDocsConfig = {
        documentId: process.env.GOOGLE_DOCS_DOCUMENT_ID || '',
        credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        credentialsJson: process.env.GOOGLE_CREDENTIALS_JSON,
        oauthTokenPath: process.env.GOOGLE_OAUTH_TOKEN_PATH,
      };

      const gepetoConfig: GepetoConfig = {
        baseUrl: process.env.GEPETO_API_BASE || 'https://gepeto.svc.in.devneon.com.br',
        apiKey: process.env.GEPETO_API_KEY || '',
        model: process.env.GEPETO_MODEL,
        endpoint: process.env.GEPETO_ENDPOINT || '/chat/completions',
      };

      const appConfig: AppConfig = {
        jira: jiraConfig,
        googleDocs: googleDocsConfig,
        gepeto: gepetoConfig,
        mode: (process.env.APP_MODE as 'dry-run' | 'live') || 'dry-run',
      };

      return AppConfigSchema.parse(appConfig);
    } catch (error) {
      return null;
    }
  }

  private async interactiveSetup(): Promise<AppConfig> {
    console.log(chalk.blue('\n📋 Let\'s set up your configuration step by step...\n'));

    // Jira configuration
    console.log(chalk.cyan('🔵 Jira Configuration'));
    const jiraConfig = await this.setupJiraConfig();

    // Google Docs configuration
    console.log(chalk.cyan('\n📄 Google Docs Configuration'));
    const googleDocsConfig = await this.setupGoogleDocsConfig();

    // Gepeto configuration
    console.log(chalk.cyan('\n🤖 Gepeto Configuration'));
    const gepetoConfig = await this.setupGepetoConfig();

    // Mode selection
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Select mode:',
        choices: [
          { name: 'Dry Run (print only, no API calls)', value: 'dry-run' },
          { name: 'Live (perform actual API calls)', value: 'live' },
        ],
        default: 'dry-run',
      },
    ]);

    return {
      jira: jiraConfig,
      googleDocs: googleDocsConfig,
      gepeto: gepetoConfig,
      mode,
    };
  }

  private async setupJiraConfig(): Promise<JiraConfig> {
    const { baseUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Jira base URL (e.g., https://yourorg.atlassian.net):',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
    ]);

    const { email } = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Your Jira email address:',
        validate: (input: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) || 'Please enter a valid email address';
        },
      },
    ]);

    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'Authentication method:',
        choices: [
          { name: 'API Token (Basic Auth)', value: 'token' },
          { name: 'OAuth 2.0', value: 'oauth' },
        ],
        default: 'token',
      },
    ]);

    let apiToken: string | undefined;
    let oauthClientId: string | undefined;
    let oauthClientSecret: string | undefined;

    if (authMethod === 'token') {
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Jira API token:',
          mask: '*',
        },
      ]);
      apiToken = token;
    } else {
      const oauthAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'clientId',
          message: 'OAuth Client ID:',
        },
        {
          type: 'password',
          name: 'clientSecret',
          message: 'OAuth Client Secret:',
          mask: '*',
        },
      ]);
      oauthClientId = oauthAnswers.clientId;
      oauthClientSecret = oauthAnswers.clientSecret;
    }

    const { projectKey, issueType, boardId, defaultLabels, priority } = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectKey',
        message: 'Project key (e.g., PROJ):',
        validate: (input: string) => input.length > 0 || 'Project key is required',
      },
      {
        type: 'input',
        name: 'issueType',
        message: 'Issue type (e.g., Story, Task, Bug):',
        default: 'Story',
      },
      {
        type: 'input',
        name: 'boardId',
        message: 'Board ID (optional, for Agile/Scrum boards):',
      },
      {
        type: 'input',
        name: 'defaultLabels',
        message: 'Default labels (comma-separated, optional):',
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Default priority:',
        choices: ['Lowest', 'Low', 'Medium', 'High', 'Highest'],
        default: 'Medium',
      },
    ]);

    return {
      baseUrl,
      email,
      apiToken,
      oauthClientId,
      oauthClientSecret,
      projectKey,
      issueType,
      boardId: boardId || undefined,
      defaultLabels: defaultLabels ? defaultLabels.split(',').map((s: string) => s.trim()) : undefined,
      priority,
    };
  }

  private async setupGoogleDocsConfig(): Promise<GoogleDocsConfig> {
    const { documentId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'documentId',
        message: 'Google Docs document ID or URL:',
        validate: (input: string) => {
          if (input.includes('docs.google.com')) {
            const match = input.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
            return match ? true : 'Invalid Google Docs URL format';
          }
          return input.length > 0 || 'Document ID is required';
        },
      },
    ]);

    // Extract document ID from URL if provided
    const docId = documentId.includes('docs.google.com') 
      ? documentId.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] || documentId
      : documentId;

    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'Google authentication method:',
        choices: [
          { name: 'Service Account JSON file', value: 'service' },
          { name: 'OAuth 2.0 (user consent)', value: 'oauth' },
        ],
        default: 'service',
      },
    ]);

    let credentialsPath: string | undefined;
    let credentialsJson: string | undefined;
    let oauthTokenPath: string | undefined;

    if (authMethod === 'service') {
      const { credsPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'credsPath',
          message: 'Path to service account JSON file:',
          validate: (input: string) => {
            if (existsSync(input)) return true;
            return 'File does not exist. Please provide a valid path.';
          },
        },
      ]);
      credentialsPath = credsPath;
    } else {
      oauthTokenPath = '.oauth/google-token.json';
    }

    // Ask for local markdown fallback option
    const { useLocalFallback } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useLocalFallback',
        message: 'Do you want to configure a local markdown file as fallback when Google Docs access fails?',
        default: false,
      },
    ]);

    let localMarkdownPath: string | undefined;
    if (useLocalFallback) {
      const { localPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'localPath',
          message: 'Path to local markdown file (optional - will search automatically if not provided):',
          validate: (input: string) => {
            if (!input) return true; // Optional field
            if (existsSync(input)) return true;
            return 'File does not exist. Please provide a valid path or leave empty for automatic search.';
          },
        },
      ]);
      localMarkdownPath = localPath || undefined;
    }

    return {
      documentId: docId,
      credentialsPath,
      credentialsJson,
      oauthTokenPath,
      localMarkdownPath,
    };
  }

  private async setupGepetoConfig(): Promise<GepetoConfig> {
    const { baseUrl, apiKey, model } = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Gepeto base URL:',
        default: 'https://gepeto.svc.in.devneon.com.br',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Gepeto API key:',
        mask: '*',
        validate: (input: string) => input.length > 0 || 'API key is required',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name (optional):',
      },
    ]);

    return {
      baseUrl,
      apiKey,
      model,
      endpoint: 'chat/completions',
    };
  }

  private saveConfig(): void {
    const envContent = this.generateEnvContent();
    writeFileSync(this.configPath, envContent);
    console.log(chalk.green(`✅ Configuration saved to ${this.configPath}`));
  }

  private generateEnvContent(): string {
    if (!this.config) return '';

    const lines = [
      '# Jira Configuration',
      `JIRA_BASE_URL=${this.config.jira.baseUrl}`,
      `JIRA_EMAIL=${this.config.jira.email}`,
      ...(this.config.jira.apiToken ? [`JIRA_API_TOKEN=${this.config.jira.apiToken}`] : []),
      ...(this.config.jira.oauthClientId ? [`JIRA_OAUTH_CLIENT_ID=${this.config.jira.oauthClientId}`] : []),
      ...(this.config.jira.oauthClientSecret ? [`JIRA_OAUTH_CLIENT_SECRET=${this.config.jira.oauthClientSecret}`] : []),
      `JIRA_PROJECT_KEY=${this.config.jira.projectKey}`,
      `JIRA_ISSUE_TYPE=${this.config.jira.issueType}`,
      ...(this.config.jira.boardId ? [`JIRA_BOARD_ID=${this.config.jira.boardId}`] : []),
      ...(this.config.jira.defaultLabels ? [`JIRA_DEFAULT_LABELS=${this.config.jira.defaultLabels.join(',')}`] : []),
      ...(this.config.jira.priority ? [`JIRA_PRIORITY=${this.config.jira.priority}`] : []),
      '',
      '# Google Docs Configuration',
      `GOOGLE_DOCS_DOCUMENT_ID=${this.config.googleDocs.documentId}`,
      ...(this.config.googleDocs.credentialsPath ? [`GOOGLE_APPLICATION_CREDENTIALS=${this.config.googleDocs.credentialsPath}`] : []),
      ...(this.config.googleDocs.credentialsJson ? [`GOOGLE_CREDENTIALS_JSON=${this.config.googleDocs.credentialsJson}`] : []),
      ...(this.config.googleDocs.oauthTokenPath ? [`GOOGLE_OAUTH_TOKEN_PATH=${this.config.googleDocs.oauthTokenPath}`] : []),
      '',
      '# Gepeto Configuration',
      `GEPETO_API_BASE=${this.config.gepeto.baseUrl}`,
      `GEPETO_API_KEY=${this.config.gepeto.apiKey}`,
      ...(this.config.gepeto.model ? [`GEPETO_MODEL=${this.config.gepeto.model}`] : []),
      `GEPETO_ENDPOINT=${this.config.gepeto.endpoint}`,
      '',
      '# App Configuration',
      `APP_MODE=${this.config.mode}`,
    ];

    return lines.join('\n');
  }

  getConfig(): AppConfig | null {
    return this.config;
  }
}
