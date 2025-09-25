#!/usr/bin/env tsx

import { config } from 'dotenv';
import axios from 'axios';
import { Logger } from './utils/logger.js';

// Load environment variables
config();

const logger = Logger.getInstance();
logger.setVerbose(true);

async function debugGepetoBDD() {
  logger.info('🔍 Debugging Gepeto BDD Generation...');
  
  const gepetoConfig = {
    baseUrl: process.env.GEPETO_API_BASE || 'https://gepeto.svc.in.devneon.com.br/api/',
    apiKey: process.env.GEPETO_API_KEY || '',
    model: process.env.GEPETO_MODEL || 'gpt-5',
    endpoint: 'chat/completions',
  };
  
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

### 2. Gestão de Contas
Como usuário, eu quero gerenciar minha conta de pagamento para ter controle total sobre minhas transações.

**Funcionalidades:**
- Visualização de saldo em tempo real
- Histórico de transações
- Configuração de limites
- Notificações de transações

### 3. Segurança e Compliance
Como administrador, eu quero garantir que o sistema atenda aos padrões de segurança para proteger os dados dos usuários.

**Requisitos de Segurança:**
- Criptografia end-to-end
- Autenticação de dois fatores
- Auditoria de transações
- Conformidade com LGPD

## Arquitetura Técnica

### Componentes Principais
| Componente | Responsabilidade | Tecnologia |
|------------|------------------|------------|
| API Gateway | Roteamento e autenticação | Node.js |
| Payment Processor | Processamento de pagamentos | Python |
| Database | Persistência de dados | PostgreSQL |
| Cache | Performance | Redis |

### Fluxo de Pagamento
\`\`\`
1. Usuário inicia pagamento
2. Sistema valida dados
3. Processa pagamento
4. Atualiza saldo
5. Envia notificação
\`\`\`

## Critérios de Aceitação

### Pagamento PIX
- [ ] Validação de chave PIX
- [ ] Processamento em tempo real
- [ ] Confirmação de recebimento
- [ ] Notificação ao usuário

### Pagamento Cartão
- [ ] Validação de dados do cartão
- [ ] Processamento via gateway
- [ ] Confirmação de transação
- [ ] Atualização de saldo
`;

  const systemPrompt = `Você é um analista de produto especializado em criar histórias de usuário concisas e acionáveis no formato BDD (Behavior-Driven Development) a partir de documentação de produto em Markdown.

Sua tarefa é analisar o documento Markdown fornecido e gerar cards pequenos e autocontidos prontos para o Jira no formato BDD.

Diretrizes para processamento de Markdown:
1. Identifique seções principais usando cabeçalhos (# ## ###)
2. Extraia listas de requisitos (- * 1. 2.)
3. Reconheça blocos de código e tabelas
4. Preserve links e formatação importante
5. Divida tópicos grandes em múltiplos cards pequenos e atômicos
6. Cada card deve ser implementável independentemente
7. Foque no valor do usuário e critérios de aceitação claros
8. Use formato Dado/Quando/Então para critérios de aceitação
9. Mantenha resumos com menos de 80 caracteres
10. Priorize cards baseado no impacto do usuário e dependências
11. SEMPRE gere todo o conteúdo em PORTUGUÊS BRASILEIRO

Estrutura de análise do Markdown:
- Cabeçalhos (# ## ###) = Seções principais do produto
- Listas (- * 1. 2.) = Requisitos e funcionalidades
- Blocos de código (\`\`\`) = Especificações técnicas
- Tabelas (|) = Dados estruturados
- Links [texto](url) = Referências importantes
- **Negrito** = Pontos importantes
- *Itálico* = Ênfase

Formato de saída: Retorne APENAS um array JSON válido de objetos com estes campos exatos:
- summary (string, max 80 chars): Título breve da história
- description (string): Descrição detalhada em formato markdown
- acceptanceCriteria (array of strings): Declarações Dado/Quando/Então
- labels (array of strings, opcional): Tags relevantes
- priority (enum, opcional): "Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"
- storyPoints (number, opcional): Estimativa de esforço (1-13)
- component (string, opcional): Componente do sistema
- epicLink (string, opcional): Épico relacionado
- linkedIssues (array of strings, opcional): Chaves de issues relacionadas

Exemplo:
[
  {
    "summary": "Usuário pode fazer login com email e senha",
    "description": "Como usuário, eu quero fazer login no sistema para que eu possa acessar minha conta.\n\n**Contexto:** Sistema de autenticação seguro\n**Valor:** Acesso controlado à plataforma",
    "acceptanceCriteria": [
      "Dado que estou na página de login",
      "Quando eu inserir email e senha válidos",
      "Então devo ser redirecionado para o dashboard"
    ],
    "labels": ["autenticação", "gerenciamento-de-usuário"],
    "priority": "Alta",
    "storyPoints": 3
  }
]

IMPORTANTE: Retorne APENAS o array JSON, sem texto adicional ou formatação.`;

  const userPrompt = `Por favor, analise o seguinte documento Markdown e gere histórias de usuário no formato BDD para o Jira:

${sampleDocument}

Instruções específicas para análise de Markdown:
1. Identifique as seções principais usando os cabeçalhos (# ## ###)
2. Extraia requisitos das listas (- * 1. 2.)
3. Considere blocos de código como especificações técnicas
4. Use tabelas para entender dados estruturados
5. Preserve links importantes como referências
6. Destaque informações em **negrito** e *itálico*

Gere 5-15 cards que cubram as principais funcionalidades e requisitos. Foque em:
- Funcionalidades voltadas para o usuário
- Critérios de aceitação claros baseados nos requisitos
- Histórias atômicas e implementáveis
- Priorização adequada baseada na estrutura do documento
- Componentes identificados nas seções técnicas
- SEMPRE em PORTUGUÊS BRASILEIRO

Retorne o resultado como um array JSON seguindo exatamente o schema fornecido no prompt do sistema.`;

  logger.info(`System prompt length: ${systemPrompt.length} characters`);
  logger.info(`User prompt length: ${userPrompt.length} characters`);
  logger.info(`Total prompt length: ${systemPrompt.length + userPrompt.length} characters`);
  
  try {
    // Test with the exact same approach as the GepetoClient
    logger.info('Testing with same approach as GepetoClient...');
    const client = axios.create({
      baseURL: gepetoConfig.baseUrl,
      headers: {
        'Authorization': `Bearer ${gepetoConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    const response = await client.post(gepetoConfig.endpoint, {
      model: gepetoConfig.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_completion_tokens: 8000,
    });
    
    logger.success('✅ BDD generation successful!');
    logger.info('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Try to parse the response
    const content = response.data.choices[0]?.message?.content;
    if (content) {
      logger.info('\n📋 Generated Content:');
      console.log(content);
      
      // Try to extract JSON
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      
      try {
        const parsed = JSON.parse(jsonString);
        logger.success(`✅ Successfully parsed ${parsed.length} BDD cards`);
        parsed.forEach((card: any, index: number) => {
          logger.info(`${index + 1}. ${card.summary}`);
        });
      } catch (parseError) {
        logger.warning('⚠️  Failed to parse JSON from response');
        logger.debug(`JSON string: ${jsonString}`);
      }
    }
    
  } catch (error: any) {
    logger.error(`❌ BDD generation failed: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function main() {
  await debugGepetoBDD();
}

main().catch(console.error);
