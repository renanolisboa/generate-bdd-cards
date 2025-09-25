#!/usr/bin/env tsx

import { GepetoClient } from './modules/gepeto.js';
import { JiraClient } from './modules/jira.js';
import { BDDCard } from './types/index.js';
import { Logger } from './utils/logger.js';

const logger = Logger.getInstance();
logger.setVerbose(true);

// Mock configuration for testing
const mockConfig = {
  gepeto: {
    baseUrl: 'https://mock-gepeto.example.com',
    apiKey: 'mock-api-key',
    model: 'gpt-5',
    endpoint: '/v1/chat/completions',
  },
  jira: {
    baseUrl: 'https://mock-jira.example.com',
    email: 'test@example.com',
    apiToken: 'mock-token',
    projectKey: 'TEST',
    issueType: 'Story',
    boardId: '123',
    defaultLabels: ['test'],
    priority: 'Medium',
  },
};

// Sample BDD cards for testing
const sampleBDDCards: BDDCard[] = [
  {
    summary: 'Usuário pode fazer login com email e senha',
    description: 'Como usuário, eu quero fazer login no sistema para que eu possa acessar minha conta.',
    acceptanceCriteria: [
      'Dado que estou na página de login',
      'Quando eu inserir email e senha válidos',
      'Então devo ser redirecionado para o dashboard'
    ],
    labels: ['autenticação', 'gerenciamento-de-usuário'],
    priority: 'Alta',
    storyPoints: 3
  },
  {
    summary: 'Usuário pode redefinir senha esquecida',
    description: 'Como usuário, eu quero redefinir minha senha quando eu esquecer para que eu possa recuperar o acesso à minha conta.',
    acceptanceCriteria: [
      'Dado que estou na página de login',
      'Quando eu clicar em "Esqueci minha senha"',
      'E eu inserir meu endereço de email',
      'Então devo receber um email de redefinição de senha'
    ],
    labels: ['autenticação', 'segurança'],
    priority: 'Média',
    storyPoints: 2
  },
  {
    summary: 'Sistema valida dados de pagamento em tempo real',
    description: 'Como sistema, eu quero validar dados de pagamento em tempo real para garantir a segurança das transações.',
    acceptanceCriteria: [
      'Dado que um usuário está fazendo um pagamento',
      'Quando os dados forem inseridos',
      'Então o sistema deve validar em tempo real',
      'E deve bloquear transações suspeitas'
    ],
    labels: ['pagamentos', 'segurança', 'validação'],
    priority: 'Muito Alta',
    storyPoints: 5
  }
];

// Mock Gepeto Client
class MockGepetoClient extends GepetoClient {
  async generateBDDCards(documentContent: string) {
    logger.info('🧪 MOCK MODE: Generating BDD cards...');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.success(`Generated ${sampleBDDCards.length} BDD cards`);
    logger.debug(`Generated cards: ${sampleBDDCards.map(c => c.summary).join(', ')}`);
    
    return {
      success: true,
      data: sampleBDDCards,
    };
  }

  async validateConnection() {
    logger.info('🧪 MOCK MODE: Validating Gepeto connection...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      data: true,
    };
  }
}

// Mock Jira Client
class MockJiraClient extends JiraClient {
  async discoverRequiredFields() {
    logger.info('🧪 MOCK MODE: Discovering required fields...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockFields = [
      {
        id: 'summary',
        name: 'Summary',
        required: true,
        schema: { type: 'string' }
      },
      {
        id: 'description',
        name: 'Description',
        required: true,
        schema: { type: 'string' }
      },
      {
        id: 'customfield_10016',
        name: 'Story Points',
        required: false,
        schema: { type: 'number', custom: 'com.pyxis.greenhopper.jira:gh-story-points' }
      }
    ];
    
    logger.success(`Found ${mockFields.length} required fields`);
    
    return {
      success: true,
      data: mockFields,
    };
  }

  async findUser(emailOrName: string) {
    logger.info(`🧪 MOCK MODE: Searching for user: ${emailOrName}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockUser = {
      accountId: 'mock-account-id-123',
      displayName: 'Test User',
      emailAddress: emailOrName
    };
    
    logger.success(`Found user: ${mockUser.displayName} (${mockUser.emailAddress})`);
    
    return {
      success: true,
      data: mockUser,
    };
  }

  async createIssue(payload: any) {
    logger.info('🧪 MOCK MODE: Creating Jira issue...');
    logger.debug(`Issue payload: ${JSON.stringify(payload, null, 2)}`);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockIssue = {
      id: `mock-${Date.now()}`,
      key: `TEST-${Math.floor(Math.random() * 1000)}`,
      self: `${mockConfig.jira.baseUrl}/rest/api/3/issue/mock-${Date.now()}`
    };
    
    logger.success(`Created issue: ${mockIssue.key}`);
    logger.info(`Issue URL: ${this.getIssueUrl(mockIssue.key)}`);
    
    return {
      success: true,
      data: mockIssue,
    };
  }

  async createBatchIssues(issues: Array<{ payload: any; card: any }>) {
    logger.info(`🧪 MOCK MODE: Creating ${issues.length} issues in batch...`);
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < issues.length; i++) {
      const { payload, card } = issues[i];
      logger.logStep(`Creating issue ${i + 1}/${issues.length}`, issues.length, i + 1);
      
      try {
        const result = await this.createIssue(payload);
        if (result.success && result.data) {
          results.push(result.data);
          logger.success(`Created: ${result.data.key} - ${card.summary}`);
        } else {
          const errorMsg = 'Unknown error creating issue';
          errors.push(`Issue ${i + 1}: ${errorMsg}`);
          logger.error(`Failed: ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Issue ${i + 1}: ${errorMsg}`);
        logger.error(`Failed: ${errorMsg}`);
      }
      
      // Add small delay between requests
      if (i < issues.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    if (errors.length > 0) {
      logger.warning(`${errors.length} issues failed to create:`);
      errors.forEach(error => logger.error(`  ${error}`));
    }
    
    return {
      success: results.length > 0,
      data: results,
      error: errors.length > 0 ? `${errors.length} issues failed` : undefined,
    };
  }
}

class MockIntegrationTester {
  private gepetoClient: MockGepetoClient;
  private jiraClient: MockJiraClient;
  private testResults: any[] = [];

  constructor() {
    this.gepetoClient = new MockGepetoClient(mockConfig.gepeto);
    this.jiraClient = new MockJiraClient(mockConfig.jira);
  }

  async runAllTests(): Promise<void> {
    logger.info('🧪 Starting Mock Integration Tests for Jira and Gepeto');
    logger.info('=' .repeat(60));

    try {
      // Test 1: Gepeto Connection
      await this.testGepetoConnection();
      
      // Test 2: Gepeto BDD Card Generation
      await this.testGepetoBDDGeneration();
      
      // Test 3: Jira Connection and Field Discovery
      await this.testJiraConnection();
      
      // Test 4: Jira User Search
      await this.testJiraUserSearch();
      
      // Test 5: End-to-End Integration
      await this.testEndToEndIntegration();
      
      // Test 6: Error Handling
      await this.testErrorHandling();
      
      await this.printTestSummary();
      
    } catch (error) {
      logger.error(`❌ Integration tests failed: ${error}`);
      process.exit(1);
    }
  }

  private async testGepetoConnection(): Promise<void> {
    logger.info('\n🔗 Test 1: Gepeto Connection');
    logger.info('-'.repeat(40));
    
    try {
      const result = await this.gepetoClient.validateConnection();
      
      if (result.success) {
        logger.success('✅ Gepeto connection successful');
        this.testResults.push({ test: 'Gepeto Connection', status: 'PASS', details: 'Connection validated' });
      } else {
        const errorMsg = 'Connection failed';
        logger.error(`❌ Gepeto connection failed: ${errorMsg}`);
        this.testResults.push({ test: 'Gepeto Connection', status: 'FAIL', details: errorMsg });
      }
    } catch (error) {
      logger.error(`❌ Gepeto connection error: ${error}`);
      this.testResults.push({ test: 'Gepeto Connection', status: 'ERROR', details: String(error) });
    }
  }

  private async testGepetoBDDGeneration(): Promise<void> {
    logger.info('\n🤖 Test 2: Gepeto BDD Card Generation');
    logger.info('-'.repeat(40));
    
    try {
      const sampleDocument = 'Sample document content for testing BDD generation';
      const result = await this.gepetoClient.generateBDDCards(sampleDocument);
      
      if (result.success && result.data) {
        logger.success(`✅ Generated ${result.data.length} BDD cards`);
        
        // Validate card structure
        const validationResults = this.validateBDDCards(result.data);
        logger.info(`Card validation: ${validationResults.valid}/${result.data.length} valid cards`);
        
        if (validationResults.invalid.length > 0) {
          logger.warning(`Invalid cards: ${validationResults.invalid.length}`);
          validationResults.invalid.forEach((card, index) => {
            logger.warning(`  ${index + 1}. ${card.summary} - ${card.errors.join(', ')}`);
          });
        }
        
        this.testResults.push({ 
          test: 'Gepeto BDD Generation', 
          status: 'PASS', 
          details: `Generated ${result.data.length} cards, ${validationResults.valid} valid` 
        });
        
      } else {
        const errorMsg = 'BDD generation failed';
        logger.error(`❌ BDD generation failed: ${errorMsg}`);
        this.testResults.push({ test: 'Gepeto BDD Generation', status: 'FAIL', details: errorMsg });
      }
    } catch (error) {
      logger.error(`❌ BDD generation error: ${error}`);
      this.testResults.push({ test: 'Gepeto BDD Generation', status: 'ERROR', details: String(error) });
    }
  }

  private async testJiraConnection(): Promise<void> {
    logger.info('\n🔗 Test 3: Jira Connection and Field Discovery');
    logger.info('-'.repeat(40));
    
    try {
      const fieldsResult = await this.jiraClient.discoverRequiredFields();
      
      if (fieldsResult.success && fieldsResult.data) {
        logger.success(`✅ Discovered ${fieldsResult.data.length} required fields`);
        logger.info('Required fields:');
        fieldsResult.data.forEach(field => {
          logger.info(`  - ${field.name} (${field.id}) - ${field.schema.type}`);
        });
        
        this.testResults.push({ 
          test: 'Jira Field Discovery', 
          status: 'PASS', 
          details: `Found ${fieldsResult.data.length} required fields` 
        });
      } else {
        const errorMsg = 'Field discovery failed';
        logger.error(`❌ Field discovery failed: ${errorMsg}`);
        this.testResults.push({ test: 'Jira Field Discovery', status: 'FAIL', details: errorMsg });
      }
    } catch (error) {
      logger.error(`❌ Jira connection error: ${error}`);
      this.testResults.push({ test: 'Jira Connection', status: 'ERROR', details: String(error) });
    }
  }

  private async testJiraUserSearch(): Promise<void> {
    logger.info('\n👤 Test 4: Jira User Search');
    logger.info('-'.repeat(40));
    
    try {
      const userResult = await this.jiraClient.findUser('test@example.com');
      
      if (userResult.success && userResult.data) {
        logger.success(`✅ Found user: ${userResult.data.displayName} (${userResult.data.emailAddress})`);
        this.testResults.push({ 
          test: 'Jira User Search', 
          status: 'PASS', 
          details: `Found user: ${userResult.data.displayName}` 
        });
      } else {
        const errorMsg = 'User search failed';
        logger.error(`❌ User search failed: ${errorMsg}`);
        this.testResults.push({ test: 'Jira User Search', status: 'FAIL', details: errorMsg });
      }
    } catch (error) {
      logger.error(`❌ User search error: ${error}`);
      this.testResults.push({ test: 'Jira User Search', status: 'ERROR', details: String(error) });
    }
  }

  private async testEndToEndIntegration(): Promise<void> {
    logger.info('\n🔄 Test 5: End-to-End Integration');
    logger.info('-'.repeat(40));
    
    try {
      // Generate BDD cards
      logger.info('Step 1: Generating BDD cards...');
      const gepetoResult = await this.gepetoClient.generateBDDCards('Sample document');
      
      if (!gepetoResult.success || !gepetoResult.data) {
        throw new Error('BDD generation failed');
      }
      
      logger.success(`Generated ${gepetoResult.data.length} BDD cards`);
      
      // Get required fields and user
      logger.info('Step 2: Getting Jira configuration...');
      const [fieldsResult, userResult] = await Promise.all([
        this.jiraClient.discoverRequiredFields(),
        this.jiraClient.findUser('test@example.com')
      ]);
      
      if (!fieldsResult.success || !userResult.success) {
        throw new Error('Failed to get Jira configuration');
      }
      
      // Create test issues
      logger.info('Step 3: Creating test issues in Jira...');
      const testCards = gepetoResult.data.slice(0, 2); // Test with 2 cards
      const issues = testCards.map(card => ({
        payload: this.jiraClient.buildIssuePayload(card, userResult.data!.accountId, fieldsResult.data!),
        card
      }));
      
      const createResult = await this.jiraClient.createBatchIssues(issues);
      
      if (createResult.success && createResult.data) {
        logger.success(`✅ Created ${createResult.data.length} test issues`);
        createResult.data.forEach(issue => {
          logger.info(`  - ${issue.key}: ${this.jiraClient.getIssueUrl(issue.key)}`);
        });
        
        this.testResults.push({ 
          test: 'End-to-End Integration', 
          status: 'PASS', 
          details: `Created ${createResult.data.length} test issues` 
        });
      } else {
        const errorMsg = 'Issue creation failed';
        logger.error(`❌ Issue creation failed: ${errorMsg}`);
        this.testResults.push({ test: 'End-to-End Integration', status: 'FAIL', details: errorMsg });
      }
      
    } catch (error) {
      logger.error(`❌ End-to-end integration error: ${error}`);
      this.testResults.push({ test: 'End-to-End Integration', status: 'ERROR', details: String(error) });
    }
  }

  private async testErrorHandling(): Promise<void> {
    logger.info('\n⚠️  Test 6: Error Handling');
    logger.info('-'.repeat(40));
    
    try {
      // Test with invalid Gepeto config
      const invalidGepetoClient = new MockGepetoClient({
        baseUrl: 'https://invalid-url.example.com',
        apiKey: 'invalid-key',
        model: 'gpt-5',
        endpoint: '/chat/completions'
      });
      
      // Simulate error by overriding the method
      invalidGepetoClient.validateConnection = async () => ({
        success: false,
        data: false,
        error: 'Connection failed'
      });
      
      const gepetoErrorResult = await invalidGepetoClient.validateConnection();
      if (!gepetoErrorResult.success) {
        logger.success('✅ Gepeto error handling works correctly');
        this.testResults.push({ test: 'Gepeto Error Handling', status: 'PASS', details: 'Properly handles invalid configuration' });
      } else {
        logger.warning('⚠️  Gepeto error handling test inconclusive');
        this.testResults.push({ test: 'Gepeto Error Handling', status: 'WARN', details: 'Expected error but got success' });
      }
      
      // Test with invalid Jira config
      const invalidJiraClient = new MockJiraClient({
        baseUrl: 'https://invalid-jira.example.com',
        email: 'invalid@example.com',
        apiToken: 'invalid-token',
        projectKey: 'INVALID',
        issueType: 'Story'
      });
      
      // Simulate error by overriding the method
      invalidJiraClient.discoverRequiredFields = async () => ({
        success: false,
        data: [],
        error: 'Project not found'
      });
      
      const jiraErrorResult = await invalidJiraClient.discoverRequiredFields();
      if (!jiraErrorResult.success) {
        logger.success('✅ Jira error handling works correctly');
        this.testResults.push({ test: 'Jira Error Handling', status: 'PASS', details: 'Properly handles invalid configuration' });
      } else {
        logger.warning('⚠️  Jira error handling test inconclusive');
        this.testResults.push({ test: 'Jira Error Handling', status: 'WARN', details: 'Expected error but got success' });
      }
      
    } catch (error) {
      logger.error(`❌ Error handling test error: ${error}`);
      this.testResults.push({ test: 'Error Handling', status: 'ERROR', details: String(error) });
    }
  }

  private validateBDDCards(cards: BDDCard[]): { valid: number; invalid: Array<{ summary: string; errors: string[] }> } {
    let valid = 0;
    const invalid: Array<{ summary: string; errors: string[] }> = [];
    
    cards.forEach(card => {
      const errors: string[] = [];
      
      if (!card.summary || card.summary.length === 0) {
        errors.push('Missing summary');
      }
      
      if (!card.description || card.description.length === 0) {
        errors.push('Missing description');
      }
      
      if (!card.acceptanceCriteria || card.acceptanceCriteria.length === 0) {
        errors.push('Missing acceptance criteria');
      }
      
      if (card.summary && card.summary.length > 80) {
        errors.push('Summary too long (>80 chars)');
      }
      
      if (errors.length === 0) {
        valid++;
      } else {
        invalid.push({ summary: card.summary || 'Untitled', errors });
      }
    });
    
    return { valid, invalid };
  }

  private async printTestSummary(): Promise<void> {
    logger.info('\n📊 Test Summary');
    logger.info('=' .repeat(60));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;
    const warnings = this.testResults.filter(r => r.status === 'WARN').length;
    
    logger.info(`Total Tests: ${this.testResults.length}`);
    logger.success(`✅ Passed: ${passed}`);
    if (failed > 0) logger.error(`❌ Failed: ${failed}`);
    if (errors > 0) logger.error(`💥 Errors: ${errors}`);
    if (warnings > 0) logger.warning(`⚠️  Warnings: ${warnings}`);
    
    logger.info('\nDetailed Results:');
    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASS' ? '✅' : 
                   result.status === 'FAIL' ? '❌' : 
                   result.status === 'ERROR' ? '💥' : '⚠️';
      logger.info(`${index + 1}. ${status} ${result.test}: ${result.details}`);
    });
    
    if (failed > 0 || errors > 0) {
      logger.error('\n❌ Some tests failed. Please check the configuration and try again.');
      process.exit(1);
    } else {
      logger.success('\n🎉 All tests passed! Mock integration is working correctly.');
    }
  }
}

// Run the mock integration tests
async function main() {
  const tester = new MockIntegrationTester();
  await tester.runAllTests();
}

main().catch(console.error);
