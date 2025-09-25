import { google } from 'googleapis';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { GoogleDocsConfig, GoogleDocsContent, ApiResponse } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { RetryManager } from '../utils/retry.js';

export class GoogleDocsClient {
  private docs: any;
  private config: GoogleDocsConfig;
  private logger: Logger;

  constructor(config: GoogleDocsConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<ApiResponse<void>> {
    try {
      this.logger.info('Initializing Google Docs client...');
      
      let auth;
      
      if (this.config.credentialsPath) {
        // Service account authentication
        auth = new google.auth.GoogleAuth({
          keyFile: this.config.credentialsPath,
          scopes: ['https://www.googleapis.com/auth/documents.readonly'],
        });
      } else if (this.config.credentialsJson) {
        // Inline service account JSON
        const credentials = JSON.parse(this.config.credentialsJson);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/documents.readonly'],
        });
      } else if (this.config.oauthTokenPath) {
        // OAuth token
        if (!existsSync(this.config.oauthTokenPath)) {
          throw new Error(`OAuth token file not found: ${this.config.oauthTokenPath}`);
        }
        const token = JSON.parse(readFileSync(this.config.oauthTokenPath, 'utf8'));
        auth = new google.auth.OAuth2();
        auth.setCredentials(token);
      } else {
        throw new Error('No authentication method provided for Google Docs');
      }

      this.docs = google.docs({ version: 'v1', auth });
      
      this.logger.success('Google Docs client initialized');
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.logError(error, 'initializing Google Docs client');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async readDocument(): Promise<ApiResponse<GoogleDocsContent>> {
    try {
      if (!this.docs) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return {
            success: false,
            error: initResult.error || 'Failed to initialize Google Docs client',
          };
        }
      }

      this.logger.info(`Reading Google Docs document: ${this.config.documentId}`);
      
      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('GET', `docs/v1/documents/${this.config.documentId}`);
        return await this.docs.documents.get({
          documentId: this.config.documentId,
        });
      });

      const document = response.data;
      const content = this.extractContent(document);
      const normalizedText = this.normalizeContent(content);

      // Save to cache
      this.saveToCache(content, normalizedText);

      this.logger.success(`Document read successfully: ${content.title}`);
      this.logger.info(`Content length: ${normalizedText.length} characters`);

      return {
        success: true,
        data: {
          title: content.title,
          text: content.text,
          normalizedText,
        },
      };
    } catch (error: any) {
      // Check if it's a permission error
      if (this.isPermissionError(error)) {
        this.logger.warning('Permission denied accessing Google Docs. Searching for local markdown file...');
        return await this.fallbackToLocalMarkdown();
      }
      
      this.logger.logError(error, 'reading Google Docs document');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private extractContent(document: any): { title: string; text: string } {
    const title = document.title || 'Untitled Document';
    let text = '';

    const processElement = (element: any): string => {
      if (!element) return '';

      let content = '';

      // Handle text runs
      if (element.textRun) {
        content += element.textRun.content || '';
      }

      // Handle paragraph elements
      if (element.paragraph) {
        const paragraph = element.paragraph;
        let paragraphText = '';

        // Process paragraph elements
        if (paragraph.elements) {
          paragraphText = paragraph.elements.map(processElement).join('');
        }

        // Add heading markers
        if (paragraph.paragraphStyle?.namedStyleType) {
          const style = paragraph.paragraphStyle.namedStyleType;
          if (style.startsWith('HEADING_')) {
            const level = parseInt(style.replace('HEADING_', ''));
            paragraphText = '#'.repeat(level) + ' ' + paragraphText;
          }
        }

        // Add list markers
        if (paragraph.bullet) {
          paragraphText = '- ' + paragraphText;
        }

        content += paragraphText + '\n';
      }

      // Handle table elements
      if (element.table) {
        const table = element.table;
        if (table.tableRows) {
          table.tableRows.forEach((row: any) => {
            if (row.tableCells) {
              const rowText = row.tableCells
                .map((cell: any) => {
                  if (cell.content) {
                    return cell.content.map(processElement).join('').trim();
                  }
                  return '';
                })
                .join(' | ');
              content += '| ' + rowText + ' |\n';
            }
          });
          content += '\n';
        }
      }

      // Handle list elements
      if (element.list) {
        const list = element.list;
        if (list.listProperties?.nestingLevels) {
          const level = list.listProperties.nestingLevels[0]?.nestingLevel || 0;
          const indent = '  '.repeat(level);
          content += indent + '- ';
        }
      }

      // Process child elements
      if (element.elements) {
        content += element.elements.map(processElement).join('');
      }

      return content;
    };

    // Process the document body
    if (document.body?.content) {
      text = document.body.content.map(processElement).join('');
    }

    return { title, text };
  }

  private normalizeContent(content: { title: string; text: string }): string {
    let normalized = content.text;

    // Clean up excessive whitespace
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    normalized = normalized.replace(/[ \t]+/g, ' ');
    normalized = normalized.replace(/\n[ \t]+/g, '\n');

    // Remove empty lines at the beginning and end
    normalized = normalized.trim();

    // Add title at the beginning
    normalized = `# ${content.title}\n\n${normalized}`;

    return normalized;
  }

  private saveToCache(content: { title: string; text: string }, normalizedText: string): void {
    try {
      const cacheDir = '.cache';
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `source_doc_${timestamp}.md`;
      const filepath = join(cacheDir, filename);

      writeFileSync(filepath, normalizedText);
      this.logger.debug(`Document cached to: ${filepath}`);

      // Also save the latest version
      const latestPath = join(cacheDir, 'source_doc_latest.md');
      writeFileSync(latestPath, normalizedText);
    } catch (error) {
      this.logger.warning(`Failed to save document to cache: ${error}`);
    }
  }

  async getDocumentInfo(): Promise<ApiResponse<{ title: string; documentId: string }>> {
    try {
      if (!this.docs) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return {
            success: false,
            error: initResult.error || 'Failed to initialize Google Docs client',
          };
        }
      }

      const response = await RetryManager.execute(async () => {
        this.logger.logApiCall('GET', `docs/v1/documents/${this.config.documentId}`);
        return await this.docs.documents.get({
          documentId: this.config.documentId,
        });
      });

      const document = response.data;
      
      return {
        success: true,
        data: {
          title: document.title || 'Untitled Document',
          documentId: this.config.documentId,
        },
      };
    } catch (error) {
      this.logger.logError(error, 'getting document info');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private isPermissionError(error: any): boolean {
    // Check for common permission error patterns
    if (error?.response?.status === 403) return true;
    if (error?.code === 403) return true;
    if (error?.message?.toLowerCase().includes('permission denied')) return true;
    if (error?.message?.toLowerCase().includes('access denied')) return true;
    if (error?.message?.toLowerCase().includes('forbidden')) return true;
    if (error?.message?.toLowerCase().includes('insufficient permissions')) return true;
    return false;
  }

  async fallbackToLocalMarkdown(): Promise<ApiResponse<GoogleDocsContent>> {
    try {
      this.logger.info('Searching for local markdown files...');
      
      let selectedFile: string | null = null;

      // If a specific local markdown path is configured, try that first
      if (this.config.localMarkdownPath) {
        if (existsSync(this.config.localMarkdownPath)) {
          selectedFile = this.config.localMarkdownPath;
          this.logger.info(`Using configured local markdown file: ${selectedFile}`);
        } else {
          this.logger.warning(`Configured local markdown file not found: ${this.config.localMarkdownPath}`);
        }
      }

      // If no specific file configured or it doesn't exist, search for markdown files
      if (!selectedFile) {
        const searchPaths = [
          '.',
          './docs',
          './documents',
          './markdown',
          './content',
          './.cache'
        ];

        const markdownFiles = this.findMarkdownFiles(searchPaths);
        
        if (markdownFiles.length === 0) {
          return {
            success: false,
            error: 'No local markdown files found. Please ensure you have a .md file in the current directory or subdirectories, or configure a specific path using localMarkdownPath.',
          };
        }

        // If multiple files found, use the most recent one
        selectedFile = markdownFiles[0];
        this.logger.info(`Using local markdown file: ${selectedFile}`);
      }

      const content = readFileSync(selectedFile, 'utf8');
      const title = this.extractTitleFromMarkdown(content) || basename(selectedFile, '.md');
      const normalizedText = this.normalizeMarkdownContent(content, title);

      // Save to cache
      this.saveToCache({ title, text: content }, normalizedText);

      this.logger.success(`Local markdown file read successfully: ${title}`);
      this.logger.info(`Content length: ${normalizedText.length} characters`);

      return {
        success: true,
        data: {
          title,
          text: content,
          normalizedText,
        },
      };
    } catch (error) {
      this.logger.logError(error, 'reading local markdown file');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private findMarkdownFiles(searchPaths: string[]): string[] {
    const markdownFiles: string[] = [];

    for (const searchPath of searchPaths) {
      if (!existsSync(searchPath)) continue;

      try {
        const files = this.scanDirectoryForMarkdown(searchPath);
        markdownFiles.push(...files);
      } catch (error) {
        this.logger.debug(`Error scanning directory ${searchPath}: ${error}`);
      }
    }

    // Sort by modification time (most recent first)
    return markdownFiles.sort((a, b) => {
      const statA = statSync(a);
      const statB = statSync(b);
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
  }

  private scanDirectoryForMarkdown(dirPath: string): string[] {
    const files: string[] = [];
    const items = readdirSync(dirPath);

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip hidden directories and node_modules
        if (item.startsWith('.') || item === 'node_modules') continue;
        files.push(...this.scanDirectoryForMarkdown(fullPath));
      } else if (stat.isFile() && extname(item).toLowerCase() === '.md') {
        files.push(fullPath);
      }
    }

    return files;
  }

  private extractTitleFromMarkdown(content: string): string | null {
    // Look for the first heading (# Title)
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    return null;
  }

  private normalizeMarkdownContent(content: string, title: string): string {
    let normalized = content;

    // Clean up excessive whitespace
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    normalized = normalized.replace(/[ \t]+/g, ' ');
    normalized = normalized.replace(/\n[ \t]+/g, '\n');

    // Remove empty lines at the beginning and end
    normalized = normalized.trim();

    // Ensure title is at the beginning if not already present
    if (!normalized.startsWith(`# ${title}`)) {
      normalized = `# ${title}\n\n${normalized}`;
    }

    return normalized;
  }
}
