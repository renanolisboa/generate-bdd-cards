#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './utils/config.js';
import { Logger } from './utils/logger.js';
import { JiraClient } from './modules/jira.js';
import { GoogleDocsClient } from './modules/gdocs.js';
import { GepetoClient } from './modules/gepeto.js';
import { CommandOptions } from './types/index.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('jira-gdocs-gepeto')
  .description('CLI workflow for creating Jira issues from Google Docs using Gepeto for BDD card generation')
  .version('1.0.0')
  .option('-c, --config <path>', 'Path to configuration file', '.env.local')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Run in dry-run mode (no API calls)')
  .option('--live', 'Run in live mode (perform actual API calls)');

// Initialize command
program
  .command('init')
  .description('Interactive setup and .env generation')
  .action(async (options: CommandOptions) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      await configManager.loadConfig();
      logger.success('Configuration setup completed!');
    } catch (error) {
      logger.error(`Setup failed: ${error}`);
      process.exit(1);
    }
  });

// Jira validation command
program
  .command('jira:validate')
  .description('Detect Jira required fields for the chosen project/issue type')
  .action(async (options: CommandOptions) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      const jiraClient = new JiraClient(config.jira);
      const result = await jiraClient.discoverRequiredFields();
      
      if (result.success && result.data) {
        logger.success(`Found ${result.data.length} required fields:`);
        result.data.forEach(field => {
          console.log(`  • ${field.name} (${field.id}) - ${field.schema.type}`);
        });
      } else {
        logger.error(`Failed to discover fields: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Validation failed: ${error}`);
      process.exit(1);
    }
  });

// Jira example creation command
program
  .command('jira:create-example')
  .description('Create one example issue assigned to you')
  .action(async (options: CommandOptions) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      if (config.mode === 'dry-run') {
        logger.info('DRY RUN MODE - No actual API calls will be made');
      }
      
      const jiraClient = new JiraClient(config.jira);
      
      // Find user
      const userResult = await jiraClient.findUser(config.jira.email);
      if (!userResult.success || !userResult.data) {
        logger.error(`Failed to find user: ${userResult.error}`);
        process.exit(1);
      }
      
      if (config.mode === 'dry-run') {
        logger.info('Would create example issue with:');
        logger.info(`  Summary: Example issue created by Jira-GDocs-Gepeto CLI`);
        logger.info(`  Assignee: ${userResult.data.displayName} (${userResult.data.emailAddress})`);
        logger.info(`  Project: ${config.jira.projectKey}`);
        logger.info(`  Issue Type: ${config.jira.issueType}`);
        return;
      }
      
      const result = await jiraClient.createExampleIssue(userResult.data.accountId);
      
      if (result.success && result.data) {
        logger.success(`Created example issue: ${result.data.key}`);
        logger.info(`Issue URL: ${jiraClient.getIssueUrl(result.data.key)}`);
      } else {
        logger.error(`Failed to create example issue: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Example creation failed: ${error}`);
      process.exit(1);
    }
  });

// Google Docs reading command
program
  .command('gdocs:read')
  .description('Pull and normalize text from a Google Docs document')
  .action(async (options: CommandOptions) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      const gdocsClient = new GoogleDocsClient(config.googleDocs);
      const result = await gdocsClient.readDocument();
      
      if (result.success && result.data) {
        logger.success(`Document read successfully: ${result.data.title}`);
        logger.info(`Content length: ${result.data.normalizedText.length} characters`);
        logger.info('Document saved to .cache/source_doc_latest.md');
      } else {
        logger.error(`Failed to read document: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Document reading failed: ${error}`);
      process.exit(1);
    }
  });

// Local markdown reading command
program
  .command('markdown:read')
  .description('Read and normalize text from a local markdown file')
  .option('-f, --file <path>', 'Path to markdown file (optional - will search automatically if not provided)')
  .action(async (options: CommandOptions & { file?: string }) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      // Create a temporary config with the specified file path
      const tempConfig = {
        ...config.googleDocs,
        localMarkdownPath: options.file,
      };
      
      const gdocsClient = new GoogleDocsClient(tempConfig);
      
      // Force fallback to local markdown
      const result = await gdocsClient.fallbackToLocalMarkdown();
      
      if (result.success && result.data) {
        logger.success(`Local markdown file read successfully: ${result.data.title}`);
        logger.info(`Content length: ${result.data.normalizedText.length} characters`);
        logger.info('Document saved to .cache/source_doc_latest.md');
      } else {
        logger.error(`Failed to read local markdown file: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Local markdown reading failed: ${error}`);
      process.exit(1);
    }
  });

// Gepeto generation command
program
  .command('gepeto:generate')
  .description('Send doc content to Gepeto to produce BDD-style cards (JSON)')
  .option('-f, --file <path>', 'Path to document file (default: .cache/source_doc_latest.md)')
  .action(async (options: CommandOptions & { file?: string }) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      // Read document content
      const { readFileSync } = await import('fs');
      const documentPath = options.file || '.cache/source_doc_latest.md';
      
      let documentContent: string;
      try {
        documentContent = readFileSync(documentPath, 'utf8');
      } catch (error) {
        logger.error(`Failed to read document file: ${documentPath}`);
        logger.info('Run "gdocs:read" first to fetch the document');
        process.exit(1);
      }
      
      const gepetoClient = new GepetoClient(config.gepeto);
      const result = await gepetoClient.generateBDDCards(documentContent);
      
      if (result.success && result.data) {
        logger.success(`Generated ${result.data.length} BDD cards`);
        logger.info('Cards saved to .cache/bdd_cards_latest.json');
      } else {
        logger.error(`Failed to generate cards: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Card generation failed: ${error}`);
      process.exit(1);
    }
  });

// Jira batch creation command
program
  .command('jira:create-batch')
  .description('Create Jira issues from the generated JSON cards')
  .option('-f, --file <path>', 'Path to BDD cards JSON file (default: .cache/bdd_cards_latest.json)')
  .action(async (options: CommandOptions & { file?: string }) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      // Read BDD cards
      const { readFileSync } = await import('fs');
      const cardsPath = options.file || '.cache/bdd_cards_latest.json';
      
      let cards: any[];
      try {
        const cardsContent = readFileSync(cardsPath, 'utf8');
        cards = JSON.parse(cardsContent);
      } catch (error) {
        logger.error(`Failed to read BDD cards file: ${cardsPath}`);
        logger.info('Run "gepeto:generate" first to generate the cards');
        process.exit(1);
      }
      
      if (config.mode === 'dry-run') {
        logger.info('DRY RUN MODE - No actual API calls will be made');
        logger.info(`Would create ${cards.length} issues:`);
        cards.forEach((card, index) => {
          console.log(`  ${index + 1}. ${card.summary}`);
        });
        return;
      }
      
      const jiraClient = new JiraClient(config.jira);
      
      // Find user
      const userResult = await jiraClient.findUser(config.jira.email);
      if (!userResult.success || !userResult.data) {
        logger.error(`Failed to find user: ${userResult.error}`);
        process.exit(1);
      }
      
      // Discover required fields
      const fieldsResult = await jiraClient.discoverRequiredFields();
      if (!fieldsResult.success || !fieldsResult.data) {
        logger.error(`Failed to discover required fields: ${fieldsResult.error}`);
        process.exit(1);
      }
      
      // Build issue payloads
      const issues = cards.map(card => ({
        payload: jiraClient.buildIssuePayload(card, userResult.data!.accountId, fieldsResult.data!),
        card,
      }));
      
      // Create issues
      const result = await jiraClient.createBatchIssues(issues);
      
      if (result.success && result.data) {
        logger.success(`Created ${result.data.length} issues successfully`);
        result.data.forEach(issue => {
          logger.info(`  ${issue.key}: ${jiraClient.getIssueUrl(issue.key)}`);
        });
        
        if (result.error) {
          logger.warning(result.error);
        }
      } else {
        logger.error(`Failed to create issues: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Batch creation failed: ${error}`);
      process.exit(1);
    }
  });

// Full workflow command
program
  .command('workflow')
  .description('Run the complete workflow: read docs -> generate cards -> create issues')
  .option('-f, --file <path>', 'Path to BDD cards JSON file (default: .cache/bdd_cards_latest.json)')
  .action(async (options: CommandOptions & { file?: string }) => {
    const logger = Logger.getInstance();
    logger.setVerbose(options.verbose || false);
    
    try {
      logger.info('🚀 Starting complete workflow...');
      
      const configManager = new ConfigManager(options.config);
      const config = await configManager.loadConfig();
      
      // Step 1: Read Google Docs
      logger.logStep('Reading Google Docs document', 4, 1);
      const gdocsClient = new GoogleDocsClient(config.googleDocs);
      const docResult = await gdocsClient.readDocument();
      
      if (!docResult.success || !docResult.data) {
        logger.error(`Failed to read document: ${docResult.error}`);
        process.exit(1);
      }
      
      // Step 2: Generate BDD cards
      logger.logStep('Generating BDD cards with Gepeto', 4, 2);
      const gepetoClient = new GepetoClient(config.gepeto);
      const cardsResult = await gepetoClient.generateBDDCards(docResult.data.normalizedText);
      
      if (!cardsResult.success || !cardsResult.data) {
        logger.error(`Failed to generate cards: ${cardsResult.error}`);
        process.exit(1);
      }
      
      // Step 3: Create Jira issues
      logger.logStep('Creating Jira issues', 4, 3);
      const jiraClient = new JiraClient(config.jira);
      
      // Find user
      const userResult = await jiraClient.findUser(config.jira.email);
      if (!userResult.success || !userResult.data) {
        logger.error(`Failed to find user: ${userResult.error}`);
        process.exit(1);
      }
      
      // Discover required fields
      const fieldsResult = await jiraClient.discoverRequiredFields();
      if (!fieldsResult.success || !fieldsResult.data) {
        logger.error(`Failed to discover required fields: ${fieldsResult.error}`);
        process.exit(1);
      }
      
      // Build issue payloads
      const issues = cardsResult.data.map(card => ({
        payload: jiraClient.buildIssuePayload(card, userResult.data!.accountId, fieldsResult.data!),
        card,
      }));
      
      if (config.mode === 'dry-run') {
        logger.info('DRY RUN MODE - No actual API calls will be made');
        logger.info(`Would create ${issues.length} issues:`);
        issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue.card.summary}`);
        });
        return;
      }
      
      // Create issues
      const createResult = await jiraClient.createBatchIssues(issues);
      
      if (createResult.success && createResult.data) {
        logger.logStep('Workflow completed successfully', 4, 4);
        logger.success(`Created ${createResult.data.length} issues successfully`);
        createResult.data.forEach(issue => {
          logger.info(`  ${issue.key}: ${jiraClient.getIssueUrl(issue.key)}`);
        });
        
        if (createResult.error) {
          logger.warning(createResult.error);
        }
      } else {
        logger.error(`Failed to create issues: ${createResult.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Workflow failed: ${error}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
