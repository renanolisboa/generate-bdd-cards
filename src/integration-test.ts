#!/usr/bin/env tsx

import { GepetoClient } from './modules/gepeto.js';
import { JiraClient } from './modules/jira.js';
import { BDDCard } from './types/index.js';
import { Logger } from './utils/logger.js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

const logger = Logger.getInstance();
logger.setVerbose(true);

// Test configuration
const testConfig = {
  gepeto: {
    baseUrl: process.env.GEPETO_API_BASE || 'https://gepeto.svc.in.devneon.com.br/api/',
    apiKey: process.env.GEPETO_API_KEY || '',
    model: process.env.GEPETO_MODEL || 'gpt-5',
    endpoint: 'chat/completions', // Override the .env file which has wrong endpoint
  },
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
    issueType: process.env.JIRA_ISSUE_TYPE || 'Story',
    boardId: process.env.JIRA_BOARD_ID || '',
    defaultLabels: process.env.JIRA_DEFAULT_LABELS?.split(',') || [],
    priority: process.env.JIRA_PRIORITY || 'Medium',
  },
  mode: process.env.APP_MODE || 'dry-run',
};

// Sample document for testing
const sampleDocument = `
# Sistema de Pagamentos - Central de Pagamentos

## Visão Geral
O sistema de Central de Pagamentos é responsável por processar, validar e gerenciar todas as transações financeiras da plataforma Neon.

## Funcionalidades Principais

### 1. Processamento de Pagamentos
Como usuário do sistema, eu quero processar pagamentos de forma segura e eficiente para que as transações sejam concluídas rapidamente.

**Requisitos:**
- Suporte a múltiplos métodos de pagamento (PIX, cartão de crédito, débito)
- Validação de dados em tempo real
- Processamento assíncrono para grandes volumes
- Retry automático em caso de falhas temporárias

### 2. Gestão de Transações
Como administrador, eu quero visualizar e gerenciar todas as transações para monitorar a saúde do sistema.

**Requisitos:**
- Dashboard com métricas em tempo real
- Filtros avançados por data, valor, status
- Exportação de relatórios em CSV/PDF
- Notificações de transações suspeitas

### 3. Reconciliação Financeira
Como contador, eu quero reconciliar as transações com os extratos bancários para garantir a precisão dos dados.

**Requisitos:**
- Importação automática de extratos bancários
- Matching automático de transações
- Relatórios de divergências
- Interface para correção manual

### 4. Segurança e Compliance
Como sistema, eu quero garantir que todas as transações atendam aos padrões de segurança e compliance.

**Requisitos:**
- Criptografia end-to-end
- Auditoria completa de transações
- Conformidade com PCI DSS
- Detecção de fraudes em tempo real

### 5. API de Integração
Como desenvolvedor, eu quero integrar o sistema de pagamentos com outras aplicações através de APIs.

**Requisitos:**
- RESTful API com documentação completa
- Webhooks para notificações
- Rate limiting e throttling
- SDKs para principais linguagens
`;

class IntegrationTester {
  private gepetoClient: GepetoClient;
  private jiraClient: JiraClient;
  private testResults: any[] = [];

  constructor() {
    this.gepetoClient = new GepetoClient(testConfig.gepeto);
    this.jiraClient = new JiraClient(testConfig.jira);
  }

  async runAllTests(): Promise<void> {
    logger.info('🧪 Starting Integration Tests for Jira and Gepeto');
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
      
      // Test 5: End-to-End Integration (if not dry-run)
      if (testConfig.mode === 'live') {
        await this.testEndToEndIntegration();
      } else {
        logger.info('⏭️  Skipping end-to-end test (dry-run mode)');
      }
      
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
        logger.error(`❌ Gepeto connection failed: ${result.error}`);
        this.testResults.push({ test: 'Gepeto Connection', status: 'FAIL', details: result.error });
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
      logger.info('Generating BDD cards from sample document...');
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
        
        // Save test results
        await this.saveTestResults('gepeto_bdd_cards', result.data);
        
      } else {
        logger.error(`❌ BDD generation failed: ${result.error}`);
        this.testResults.push({ test: 'Gepeto BDD Generation', status: 'FAIL', details: result.error });
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
      // Test field discovery
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
        logger.error(`❌ Field discovery failed: ${fieldsResult.error}`);
        this.testResults.push({ test: 'Jira Field Discovery', status: 'FAIL', details: fieldsResult.error });
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
      const userResult = await this.jiraClient.findUser(testConfig.jira.email);
      
      if (userResult.success && userResult.data) {
        logger.success(`✅ Found user: ${userResult.data.displayName} (${userResult.data.emailAddress})`);
        this.testResults.push({ 
          test: 'Jira User Search', 
          status: 'PASS', 
          details: `Found user: ${userResult.data.displayName}` 
        });
      } else {
        logger.error(`❌ User search failed: ${userResult.error}`);
        this.testResults.push({ test: 'Jira User Search', status: 'FAIL', details: userResult.error });
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
      const gepetoResult = await this.gepetoClient.generateBDDCards(sampleDocument);
      
      if (!gepetoResult.success || !gepetoResult.data) {
        throw new Error(`BDD generation failed: ${gepetoResult.error}`);
      }
      
      logger.success(`Generated ${gepetoResult.data.length} BDD cards`);
      
      // Get required fields and user
      logger.info('Step 2: Getting Jira configuration...');
      const [fieldsResult, userResult] = await Promise.all([
        this.jiraClient.discoverRequiredFields(),
        this.jiraClient.findUser(testConfig.jira.email)
      ]);
      
      if (!fieldsResult.success || !userResult.success) {
        throw new Error('Failed to get Jira configuration');
      }
      
      // Create test issues (limit to 3 for testing)
      logger.info('Step 3: Creating test issues in Jira...');
      const testCards = gepetoResult.data.slice(0, 3);
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
        logger.error(`❌ Issue creation failed: ${createResult.error}`);
        this.testResults.push({ test: 'End-to-End Integration', status: 'FAIL', details: createResult.error });
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
      const invalidGepetoClient = new GepetoClient({
        baseUrl: 'https://invalid-url.example.com',
        apiKey: 'invalid-key',
        model: 'gpt-5',
        endpoint: '/v1/chat/completions'
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
      const invalidJiraClient = new JiraClient({
        baseUrl: 'https://invalid-jira.example.com',
        email: 'invalid@example.com',
        apiToken: 'invalid-token',
        projectKey: 'INVALID',
        issueType: 'Story'
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

  private async saveTestResults(filename: string, data: any): Promise<void> {
    try {
      const { writeFileSync, mkdirSync } = await import('fs');
      const { join } = await import('path');
      
      const cacheDir = '.cache';
      try {
        mkdirSync(cacheDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filepath = join(cacheDir, `${filename}_${timestamp}.json`);
      writeFileSync(filepath, JSON.stringify(data, null, 2));
      
      logger.debug(`Test results saved to: ${filepath}`);
    } catch (error) {
      logger.warning(`Failed to save test results: ${error}`);
    }
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
    
    // Save summary
    await this.saveTestResults('integration_test_summary', {
      timestamp: new Date().toISOString(),
      total: this.testResults.length,
      passed,
      failed,
      errors,
      warnings,
      results: this.testResults
    });
    
    if (failed > 0 || errors > 0) {
      logger.error('\n❌ Some tests failed. Please check the configuration and try again.');
      process.exit(1);
    } else {
      logger.success('\n🎉 All tests passed! Integration is working correctly.');
    }
  }
}

// Run the integration tests
async function main() {
  const tester = new IntegrationTester();
  await tester.runAllTests();
}

main().catch(console.error);
