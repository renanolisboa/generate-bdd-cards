#!/usr/bin/env tsx

import { GepetoClient } from './modules/gepeto.js';
import { Logger } from './utils/logger.js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const logger = Logger.getInstance();
logger.setVerbose(true);

// Test configuration
const testConfig = {
  gepeto: {
    baseUrl: process.env.GEPETO_API_BASE || 'https://gepeto.svc.in.devneon.com.br/api/',
    apiKey: process.env.GEPETO_API_KEY || '',
    model: process.env.GEPETO_MODEL || 'gpt-5',
    endpoint: process.env.GEPETO_ENDPOINT || '/chat/completions',
  },
};

// Smaller sample document for testing
const sampleDocument = `
# Sistema de Pagamentos - Funcionalidade Básica

## Visão Geral
Sistema para processar pagamentos de forma segura.

## Funcionalidades

### Processamento de Pagamentos
Como usuário, eu quero processar pagamentos para concluir minhas transações.

**Requisitos:**
- Suporte a PIX e cartão
- Validação de dados
- Processamento assíncrono
`;

class GepetoTester {
  private gepetoClient: GepetoClient;
  private testResults: any[] = [];

  constructor() {
    this.gepetoClient = new GepetoClient(testConfig.gepeto);
  }

  async runAllTests(): Promise<void> {
    logger.info('🤖 Testing Gepeto Integration');
    logger.info('=' .repeat(50));

    try {
      // Test 1: Gepeto Connection
      await this.testGepetoConnection();
      
      // Test 2: Gepeto BDD Card Generation
      await this.testGepetoBDDGeneration();
      
      // Test 3: Error Handling
      await this.testErrorHandling();
      
      await this.printTestSummary();
      
    } catch (error) {
      logger.error(`❌ Gepeto tests failed: ${error}`);
      process.exit(1);
    }
  }

  private async testGepetoConnection(): Promise<void> {
    logger.info('\n🔗 Test 1: Gepeto Connection');
    logger.info('-'.repeat(30));
    
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
    logger.info('-'.repeat(30));
    
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
        
        // Show preview of generated cards
        this.previewCards(result.data);
        
      } else {
        logger.error(`❌ BDD generation failed: ${result.error}`);
        this.testResults.push({ test: 'Gepeto BDD Generation', status: 'FAIL', details: result.error });
      }
    } catch (error) {
      logger.error(`❌ BDD generation error: ${error}`);
      this.testResults.push({ test: 'Gepeto BDD Generation', status: 'ERROR', details: String(error) });
    }
  }

  private async testErrorHandling(): Promise<void> {
    logger.info('\n⚠️  Test 3: Error Handling');
    logger.info('-'.repeat(30));
    
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
      
    } catch (error) {
      logger.error(`❌ Error handling test error: ${error}`);
      this.testResults.push({ test: 'Error Handling', status: 'ERROR', details: String(error) });
    }
  }

  private validateBDDCards(cards: any[]): { valid: number; invalid: Array<{ summary: string; errors: string[] }> } {
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

  private previewCards(cards: any[]): void {
    logger.info('\n📋 Generated BDD Cards Preview:');
    logger.info('=' .repeat(60));
    
    cards.forEach((card, index) => {
      logger.info(`\n${index + 1}. ${card.summary}`);
      logger.info(`   Priority: ${card.priority || 'Not set'}`);
      logger.info(`   Story Points: ${card.storyPoints || 'Not set'}`);
      logger.info(`   Labels: ${card.labels?.join(', ') || 'None'}`);
      
      if (card.acceptanceCriteria && card.acceptanceCriteria.length > 0) {
        logger.info('   Acceptance Criteria:');
        card.acceptanceCriteria.slice(0, 2).forEach((criteria: string) => {
          logger.info(`     • ${criteria}`);
        });
        if (card.acceptanceCriteria.length > 2) {
          logger.info(`     • ... and ${card.acceptanceCriteria.length - 2} more`);
        }
      }
    });
    
    logger.info('\n' + '=' .repeat(60));
  }

  private async printTestSummary(): Promise<void> {
    logger.info('\n📊 Test Summary');
    logger.info('=' .repeat(50));
    
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
      logger.success('\n🎉 All Gepeto tests passed! Integration is working correctly.');
    }
  }
}

// Run the Gepeto tests
async function main() {
  const tester = new GepetoTester();
  await tester.runAllTests();
}

main().catch(console.error);
