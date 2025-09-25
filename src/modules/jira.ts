import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { JiraConfig, JiraField, JiraCreateMeta, JiraUser, JiraIssuePayload, JiraIssueResponse, ApiResponse } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { RetryManager } from '../utils/retry.js';

export class JiraClient {
  private client: AxiosInstance;
  private config: JiraConfig;
  private logger: Logger;

  constructor(config: JiraConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Set up authentication
    if (config.apiToken) {
      this.client.defaults.auth = {
        username: config.email,
        password: config.apiToken,
      };
    } else if (config.oauthClientId && config.oauthClientSecret) {
      // OAuth implementation would go here
      throw new Error('OAuth authentication not yet implemented. Please use API token for now.');
    } else {
      throw new Error('No authentication method provided');
    }
  }

  async discoverRequiredFields(): Promise<ApiResponse<JiraField[]>> {
    try {
      this.logger.info('Discovering required fields for Jira project...');
      
      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('GET', `/rest/api/3/issue/createmeta?projectKeys=${this.config.projectKey}&expand=projects.issuetypes.fields`);
        return await this.client.get(`/rest/api/3/issue/createmeta?projectKeys=${this.config.projectKey}&expand=projects.issuetypes.fields`);
      });

      const createMeta: JiraCreateMeta = response.data;
      const project = createMeta.projects.find(p => p.key === this.config.projectKey);
      
      if (!project) {
        throw new Error(`Project ${this.config.projectKey} not found`);
      }

      const issueType = project.issuetypes.find(it => it.name === this.config.issueType);
      if (!issueType) {
        throw new Error(`Issue type ${this.config.issueType} not found in project ${this.config.projectKey}`);
      }

      const requiredFields: JiraField[] = Object.entries(issueType.fields)
        .filter(([fieldId, field]) => field.required)
        .map(([fieldId, field]) => ({ ...field, id: fieldId }));
      
      this.logger.success(`Found ${requiredFields.length} required fields`);
      this.logger.debug(`Required fields: ${requiredFields.map(f => f.name).join(', ')}`);

      return {
        success: true,
        data: requiredFields,
      };
    } catch (error) {
      this.logger.logError(error, 'discovering required fields');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async findUser(emailOrName: string): Promise<ApiResponse<JiraUser>> {
    try {
      this.logger.info(`Searching for user: ${emailOrName}`);
      
      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('GET', `/rest/api/3/user/search?query=${encodeURIComponent(emailOrName)}`);
        return await this.client.get(`/rest/api/3/user/search?query=${encodeURIComponent(emailOrName)}`);
      });

      const users: JiraUser[] = response.data;
      
      if (users.length === 0) {
        return {
          success: false,
          error: `No user found matching "${emailOrName}"`,
        };
      }

      // Try to find exact email match first
      let user = users.find(u => u.emailAddress === emailOrName);
      
      // If no exact email match, try display name
      if (!user) {
        user = users.find(u => u.displayName.toLowerCase().includes(emailOrName.toLowerCase()));
      }

      // If still no match, return the first result
      if (!user) {
        user = users[0];
      }

      this.logger.success(`Found user: ${user.displayName} (${user.emailAddress})`);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      this.logger.logError(error, 'finding user');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createIssue(payload: JiraIssuePayload): Promise<ApiResponse<JiraIssueResponse>> {
    try {
      this.logger.info('Creating Jira issue...');
      this.logger.debug(`Issue payload: ${JSON.stringify(payload, null, 2)}`);
      
      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('POST', '/rest/api/3/issue');
        return await this.client.post('/rest/api/3/issue', payload);
      });

      const issue: JiraIssueResponse = response.data;
      const issueUrl = `${this.config.baseUrl}/browse/${issue.key}`;
      
      this.logger.success(`Created issue: ${issue.key}`);
      this.logger.info(`Issue URL: ${issueUrl}`);

      return {
        success: true,
        data: issue,
      };
    } catch (error: any) {
      this.logger.logError(error, 'creating issue');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: error.response?.status,
      };
    }
  }

  async createExampleIssue(assigneeAccountId: string): Promise<ApiResponse<JiraIssueResponse>> {
    const payload: JiraIssuePayload = {
      fields: {
        project: { key: this.config.projectKey },
        issuetype: { name: this.config.issueType },
        summary: 'Example issue created by Jira-GDocs-Gepeto CLI',
        description: 'This is an example issue created to test the integration. You can safely delete this issue.',
        assignee: { accountId: assigneeAccountId },
        ...(this.config.defaultLabels && { labels: this.config.defaultLabels }),
        ...(this.config.priority && { priority: { name: this.config.priority } }),
      },
    };

    return this.createIssue(payload);
  }

  async createBatchIssues(issues: Array<{ payload: JiraIssuePayload; card: any }>): Promise<ApiResponse<JiraIssueResponse[]>> {
    const results: JiraIssueResponse[] = [];
    const errors: string[] = [];

    this.logger.info(`Creating ${issues.length} issues in batch...`);

    for (let i = 0; i < issues.length; i++) {
      const { payload, card } = issues[i];
      this.logger.logStep(`Creating issue ${i + 1}/${issues.length}`, issues.length, i + 1);
      
      try {
        const result = await this.createIssue(payload);
        if (result.success && result.data) {
          results.push(result.data);
          this.logger.success(`Created: ${result.data.key} - ${card.summary}`);
        } else {
          errors.push(`Issue ${i + 1}: ${result.error}`);
          this.logger.error(`Failed: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Issue ${i + 1}: ${errorMsg}`);
        this.logger.error(`Failed: ${errorMsg}`);
      }

      // Add small delay between requests to avoid rate limiting
      if (i < issues.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (errors.length > 0) {
      this.logger.warning(`${errors.length} issues failed to create:`);
      errors.forEach(error => this.logger.error(`  ${error}`));
    }

    return {
      success: results.length > 0,
      data: results,
      error: errors.length > 0 ? `${errors.length} issues failed` : undefined,
    };
  }

  buildIssuePayload(card: any, assigneeAccountId: string, requiredFields: JiraField[]): JiraIssuePayload {
    const payload: JiraIssuePayload = {
      fields: {
        project: { key: this.config.projectKey },
        issuetype: { name: this.config.issueType },
        summary: card.summary,
        description: this.buildDescription(card),
        assignee: { accountId: assigneeAccountId },
        ...(card.labels && { labels: card.labels }),
      },
    };

    // Add any required custom fields that we can map
    requiredFields.forEach(field => {
      if (field.id.startsWith('customfield_')) {
        // Map common custom fields
        switch (field.id) {
          case 'customfield_10016': // Story Points
            if (card.storyPoints) {
              payload.fields[field.id] = card.storyPoints;
            }
            break;
          case 'customfield_10014': // Epic Link
            if (card.epicLink) {
              payload.fields[field.id] = card.epicLink;
            }
            break;
          // Add more custom field mappings as needed
        }
      }
    });

    return payload;
  }

  private buildDescription(card: any): any {
    const content: any[] = [];
    
    // Add main description
    if (card.description) {
      content.push({
        type: 'paragraph',
        content: [{
          type: 'text',
          text: card.description
        }]
      });
    }
    
    // Add acceptance criteria
    if (card.acceptanceCriteria && card.acceptanceCriteria.length > 0) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{
          type: 'text',
          text: 'Acceptance Criteria'
        }]
      });
      
      card.acceptanceCriteria.forEach((criteria: string) => {
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: criteria
              }]
            }]
          }]
        });
      });
    }

    // Add linked issues
    if (card.linkedIssues && card.linkedIssues.length > 0) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{
          type: 'text',
          text: 'Linked Issues'
        }]
      });
      
      card.linkedIssues.forEach((issue: string) => {
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: issue
              }]
            }]
          }]
        });
      });
    }

    return {
      type: 'doc',
      version: 1,
      content: content
    };
  }

  getIssueUrl(issueKey: string): string {
    return `${this.config.baseUrl}/browse/${issueKey}`;
  }
}
