import { z } from 'zod';

// Configuration schemas
export const JiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  projectKey: z.string(),
  issueType: z.string(),
  boardId: z.string().optional(),
  defaultLabels: z.array(z.string()).optional(),
  priority: z.string().optional(),
});

export const GoogleDocsConfigSchema = z.object({
  documentId: z.string(),
  credentialsPath: z.string().optional(),
  credentialsJson: z.string().optional(),
  oauthTokenPath: z.string().optional(),
  localMarkdownPath: z.string().optional(),
});

export const GepetoConfigSchema = z.object({
  baseUrl: z.string().url().default('https://gepeto.svc.in.devneon.com.br'),
  apiKey: z.string(),
  model: z.string().optional(),
  endpoint: z.string().default('chat/completions'),
});

export const AppConfigSchema = z.object({
  jira: JiraConfigSchema,
  googleDocs: GoogleDocsConfigSchema,
  gepeto: GepetoConfigSchema,
  mode: z.enum(['dry-run', 'live']).default('dry-run'),
});

export type JiraConfig = z.infer<typeof JiraConfigSchema>;
export type GoogleDocsConfig = z.infer<typeof GoogleDocsConfigSchema>;
export type GepetoConfig = z.infer<typeof GepetoConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Jira API types
export interface JiraField {
  id: string;
  name: string;
  required: boolean;
  schema: {
    type: string;
    custom?: string;
    customId?: number;
  };
  allowedValues?: Array<{
    id: string;
    value: string;
    name?: string;
  }>;
}

export interface JiraCreateMeta {
  projects: Array<{
    key: string;
    name: string;
    issuetypes: Array<{
      id: string;
      name: string;
      fields: Record<string, JiraField>;
    }>;
  }>;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

export interface JiraIssuePayload {
  fields: {
    project: { key: string };
    issuetype: { name: string };
    summary: string;
    description?: string;
    assignee?: { accountId: string };
    labels?: string[];
    priority?: { name: string };
    components?: Array<{ name: string }>;
    [key: string]: any;
  };
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
}

// BDD Card types
export const BDDCardSchema = z.object({
  summary: z.string().max(80),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  labels: z.array(z.string()).optional(),
  priority: z.enum(['Muito Baixa', 'Baixa', 'Média', 'Alta', 'Muito Alta', 'Lowest', 'Low', 'Medium', 'High', 'Highest']).optional(),
  storyPoints: z.number().optional(),
  component: z.string().optional(),
  epicLink: z.string().optional(),
  linkedIssues: z.array(z.string()).optional(),
});

export type BDDCard = z.infer<typeof BDDCardSchema>;

// Google Docs types
export interface GoogleDocsContent {
  title: string;
  text: string;
  normalizedText: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

// CLI Command types
export interface CommandOptions {
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
  output?: string;
}
