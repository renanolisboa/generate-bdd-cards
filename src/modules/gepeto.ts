import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { GepetoConfig, BDDCard, BDDCardSchema, ApiResponse } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { RetryManager } from '../utils/retry.js';

// Schema for validating Gepeto response
const GepetoResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }),
  })),
});

const BDDCardsArraySchema = z.array(BDDCardSchema);

export class GepetoClient {
  private client: AxiosInstance;
  private config: GepetoConfig;
  private logger: Logger;

  constructor(config: GepetoConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 90000, // 30 seconds timeout
    });
  }

  async generateBDDCards(documentContent: string): Promise<ApiResponse<BDDCard[]>> {
    try {
      this.logger.info('Generating BDD cards using Gepeto...');
      
      const prompt = this.buildPrompt(documentContent);
      this.logger.debug(`Prompt length: ${prompt.length} characters`);

      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('POST', this.config.endpoint);
        return await this.client.post(this.config.endpoint, {
          model: this.config.model || 'gpt-5',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 4000,
          temperature: 0.3,
        });
      });

      // Validate response structure
      const validatedResponse = GepetoResponseSchema.parse(response.data);
      const content = validatedResponse.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from Gepeto');
      }

      this.logger.debug(`Raw Gepeto response: ${content}`);

      // Try to parse JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;

      let cards: BDDCard[];
      try {
        const parsed = JSON.parse(jsonString);
        cards = BDDCardsArraySchema.parse(parsed);
      } catch (parseError) {
        this.logger.warning('Failed to parse JSON from Gepeto response, attempting to fix...');
        const fixedJson = this.attemptJsonFix(jsonString);
        const parsed = JSON.parse(fixedJson);
        cards = BDDCardsArraySchema.parse(parsed);
      }

      // Save response to cache
      this.saveToCache(content, cards);

      this.logger.success(`Generated ${cards.length} BDD cards`);
      this.previewCards(cards);

      return {
        success: true,
        data: cards,
      };
    } catch (error) {
      this.logger.logError(error, 'generating BDD cards');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getSystemPrompt(): string {
    return `Você é um analista de produto especializado em criar histórias de usuário concisas e acionáveis no formato BDD (Behavior-Driven Development) a partir de documentação de produto em Markdown.

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
  }

  private buildPrompt(documentContent: string): string {
    return `Por favor, analise o seguinte documento Markdown e gere histórias de usuário no formato BDD para o Jira:

${documentContent}

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
  }

  private attemptJsonFix(jsonString: string): string {
    // Common fixes for malformed JSON
    let fixed = jsonString.trim();
    
    // Remove any text before the first [
    const arrayStart = fixed.indexOf('[');
    if (arrayStart > 0) {
      fixed = fixed.substring(arrayStart);
    }
    
    // Remove any text after the last ]
    const arrayEnd = fixed.lastIndexOf(']');
    if (arrayEnd > 0 && arrayEnd < fixed.length - 1) {
      fixed = fixed.substring(0, arrayEnd + 1);
    }
    
    // Fix common JSON issues
    fixed = fixed
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
      .replace(/:\s*([^",{\[\s][^,}\]]*?)(\s*[,}])/g, ': "$1"$2') // Add quotes to unquoted string values
      .replace(/"\s*:\s*"/g, '": "') // Fix spacing around colons
      .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
      .replace(/,\s*]/g, ']'); // Remove trailing commas before closing brackets
    
    return fixed;
  }

  private previewCards(cards: BDDCard[]): void {
    console.log('\n📋 Generated BDD Cards Preview:');
    console.log('=' .repeat(80));
    
    cards.forEach((card, index) => {
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
  }

  private saveToCache(rawResponse: string, cards: BDDCard[]): void {
    try {
      const cacheDir = '.cache';
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save raw response
      const rawFilename = `gepeto_response_${timestamp}.txt`;
      const rawFilepath = join(cacheDir, rawFilename);
      writeFileSync(rawFilepath, rawResponse);

      // Save parsed cards
      const cardsFilename = `bdd_cards_${timestamp}.json`;
      const cardsFilepath = join(cacheDir, cardsFilename);
      writeFileSync(cardsFilepath, JSON.stringify(cards, null, 2));

      // Save latest versions
      writeFileSync(join(cacheDir, 'gepeto_response_latest.txt'), rawResponse);
      writeFileSync(join(cacheDir, 'bdd_cards_latest.json'), JSON.stringify(cards, null, 2));

      this.logger.debug(`Gepeto response cached to: ${rawFilepath}`);
      this.logger.debug(`BDD cards cached to: ${cardsFilepath}`);
    } catch (error) {
      this.logger.warning(`Failed to save Gepeto response to cache: ${error}`);
    }
  }

  async validateConnection(): Promise<ApiResponse<boolean>> {
    try {
      this.logger.info('Validating Gepeto connection...');
      
      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('POST', this.config.endpoint);
        return await this.client.post(this.config.endpoint, {
          model: this.config.model || 'gpt-5',
          messages: [
            {
              role: 'user',
              content: 'Hello, please respond with "OK"',
            },
          ],
          max_tokens: 10,
          temperature: 0.3,
        });
      });

      this.logger.success('Gepeto connection validated');
      return { success: true, data: true };
    } catch (error) {
      this.logger.logError(error, 'validating Gepeto connection');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
