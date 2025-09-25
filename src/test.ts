#!/usr/bin/env tsx

import { GepetoClient } from './modules/gepeto.js';
import { BDDCard } from './types/index.js';
import { Logger } from './utils/logger.js';

const logger = Logger.getInstance();
logger.setVerbose(true);

// Mock configuration for testing
const mockGepetoConfig = {
  baseUrl: 'https://mock-gepeto.example.com',
  apiKey: 'mock-api-key',
  model: 'gpt-5',
  endpoint: '/chat/completions',
};

// Sample document content for testing
const sampleDocument = `
# Product Requirements Document

## User Authentication

As a user, I want to be able to login to the system so that I can access my personal dashboard.

### Requirements
- Users should be able to login with email and password
- Users should be able to reset their password
- Users should be able to logout
- Session should timeout after 30 minutes of inactivity

## Dashboard Features

As a logged-in user, I want to see a personalized dashboard with my recent activity and key metrics.

### Requirements
- Display recent notifications
- Show key performance indicators
- Allow quick access to frequently used features
- Responsive design for mobile devices

## Data Export

As a user, I want to export my data in various formats so that I can use it in other tools.

### Requirements
- Export data as CSV, JSON, and PDF
- Support filtering and date range selection
- Email export results to user
- Large exports should be processed asynchronously
`;

// Mock Gepeto client for testing
class MockGepetoClient extends GepetoClient {
  async generateBDDCards(documentContent: string) {
    logger.info('🧪 MOCK MODE: Generating BDD cards...');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock BDD cards based on the document content
    const mockCards: BDDCard[] = [
      {
        summary: 'Usuário pode fazer login com email e senha',
        description: 'Como usuário, eu quero fazer login no sistema para que eu possa acessar meu dashboard pessoal.',
        acceptanceCriteria: [
          'Dado que estou na página de login',
          'Quando eu inserir email e senha válidos',
          'Então devo ser redirecionado para o dashboard',
          'E devo ver meu conteúdo personalizado'
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
          'Então devo receber um email de redefinição de senha',
          'E devo conseguir definir uma nova senha'
        ],
        labels: ['autenticação', 'segurança'],
        priority: 'Média',
        storyPoints: 2
      },
      {
        summary: 'Sessão do usuário expira após inatividade',
        description: 'Como sistema, eu quero fazer logout automático de usuários inativos para manter a segurança.',
        acceptanceCriteria: [
          'Dado que um usuário está logado',
          'Quando o usuário ficar inativo por 30 minutos',
          'Então o usuário deve ser automaticamente deslogado',
          'E o usuário deve ser redirecionado para a página de login'
        ],
        labels: ['autenticação', 'segurança'],
        priority: 'Média',
        storyPoints: 1
      },
      {
        summary: 'Usuário pode visualizar dashboard personalizado',
        description: 'Como usuário logado, eu quero ver um dashboard personalizado com minha atividade recente e métricas principais.',
        acceptanceCriteria: [
          'Dado que estou logado',
          'Quando eu navegar para o dashboard',
          'Então devo ver minhas notificações recentes',
          'E devo ver indicadores-chave de performance',
          'E devo ter acesso rápido a funcionalidades frequentemente usadas'
        ],
        labels: ['dashboard', 'interface-do-usuário'],
        priority: 'Alta',
        storyPoints: 5
      },
      {
        summary: 'Dashboard é responsivo em dispositivos móveis',
        description: 'Como usuário móvel, eu quero que o dashboard funcione bem no meu dispositivo móvel.',
        acceptanceCriteria: [
          'Dado que estou usando um dispositivo móvel',
          'Quando eu acessar o dashboard',
          'Então o layout deve se adaptar ao tamanho da minha tela',
          'E todas as funcionalidades devem ser acessíveis via toque'
        ],
        labels: ['dashboard', 'móvel', 'responsivo'],
        priority: 'Média',
        storyPoints: 3
      },
      {
        summary: 'Usuário pode exportar dados como CSV',
        description: 'Como usuário, eu quero exportar meus dados como CSV para que eu possa usá-los em aplicações de planilha.',
        acceptanceCriteria: [
          'Dado que estou na página de exportação de dados',
          'Quando eu selecionar formato CSV',
          'E eu escolher meus filtros de dados',
          'Então devo conseguir baixar um arquivo CSV',
          'E o arquivo deve conter os dados filtrados'
        ],
        labels: ['exportação-de-dados', 'csv'],
        priority: 'Média',
        storyPoints: 2
      },
      {
        summary: 'Usuário pode exportar dados como JSON',
        description: 'Como desenvolvedor, eu quero exportar meus dados como JSON para que eu possa usá-los em minhas aplicações.',
        acceptanceCriteria: [
          'Dado que estou na página de exportação de dados',
          'Quando eu selecionar formato JSON',
          'E eu escolher meus filtros de dados',
          'Então devo conseguir baixar um arquivo JSON',
          'E o arquivo deve conter os dados filtrados em formato JSON'
        ],
        labels: ['exportação-de-dados', 'json', 'api'],
        priority: 'Baixa',
        storyPoints: 2
      },
      {
        summary: 'Exportações grandes de dados são processadas assincronamente',
        description: 'Como usuário, eu quero que exportações grandes de dados sejam processadas em segundo plano para que eu não precise esperar.',
        acceptanceCriteria: [
          'Dado que eu solicito uma exportação grande de dados',
          'Quando a exportação demorar mais de 30 segundos',
          'Então devo receber um email quando a exportação estiver pronta',
          'E devo conseguir baixar o arquivo do email'
        ],
        labels: ['exportação-de-dados', 'performance', 'assíncrono'],
        priority: 'Baixa',
        storyPoints: 4
      }
    ];

    logger.success(`Generated ${mockCards.length} BDD cards`);
    
    // Display preview
    console.log('\n📋 Generated BDD Cards Preview:');
    console.log('=' .repeat(80));
    
    mockCards.forEach((card, index) => {
      console.log(`\n${index + 1}. ${card.summary}`);
      console.log(`   Priority: ${card.priority || 'Not set'}`);
      console.log(`   Story Points: ${card.storyPoints || 'Not set'}`);
      console.log(`   Labels: ${card.labels?.join(', ') || 'None'}`);
      
      if (card.acceptanceCriteria && card.acceptanceCriteria.length > 0) {
        console.log('   Acceptance Criteria:');
        card.acceptanceCriteria.slice(0, 2).forEach(criteria => {
          console.log(`     • ${criteria}`);
        });
        if (card.acceptanceCriteria.length > 2) {
          console.log(`     • ... and ${card.acceptanceCriteria.length - 2} more`);
        }
      }
    });
    
    console.log('\n' + '=' .repeat(80));

    return {
      success: true,
      data: mockCards,
    };
  }
}

// Test function
async function runTest() {
  logger.info('🧪 Running mock test...');
  
  try {
    const mockClient = new MockGepetoClient(mockGepetoConfig);
    const result = await mockClient.generateBDDCards(sampleDocument);
    
    if (result.success && result.data) {
      logger.success(`✅ Test completed successfully! Generated ${result.data.length} cards.`);
      
      // Save test results
      const { writeFileSync, mkdirSync } = await import('fs');
      const { join } = await import('path');
      
      const cacheDir = '.cache';
      try {
        mkdirSync(cacheDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
      
      const testResultsPath = join(cacheDir, 'test_results.json');
      writeFileSync(testResultsPath, JSON.stringify(result.data, null, 2));
      logger.info(`Test results saved to: ${testResultsPath}`);
    } else {
      logger.error(`❌ Test failed: ${(result as any).error || 'Unknown error'}`);
    }
  } catch (error) {
    logger.error(`❌ Test error: ${error}`);
  }
}

// Run the test
runTest().catch(console.error);
