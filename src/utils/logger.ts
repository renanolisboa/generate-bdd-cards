import chalk from 'chalk';
import ora from 'ora';

export class Logger {
  private static instance: Logger;
  private verbose: boolean = false;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  success(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }

  warning(message: string): void {
    console.log(chalk.yellow(`⚠️  ${message}`));
  }

  error(message: string): void {
    console.log(chalk.red(`❌ ${message}`));
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`🐛 ${message}`));
    }
  }

  createSpinner(text: string): any {
    return ora({
      text,
      spinner: 'dots',
      color: 'blue',
    });
  }

  logStep(step: string, total: number, current: number): void {
    const progress = `[${current}/${total}]`;
    console.log(chalk.cyan(`${progress} ${step}`));
  }

  logApiCall(method: string, url: string, statusCode?: number): void {
    if (this.verbose) {
      const status = statusCode ? ` (${statusCode})` : '';
      console.log(chalk.gray(`🌐 ${method} ${url}${status}`));
    }
  }

  logError(error: any, context?: string): void {
    const contextMsg = context ? ` in ${context}` : '';
    
    if (error.response) {
      const { status, statusText, data } = error.response;
      this.error(`API Error${contextMsg}: ${status} ${statusText}`);
      if (data?.errorMessages) {
        data.errorMessages.forEach((msg: string) => {
          console.log(chalk.red(`   • ${msg}`));
        });
      }
      if (data?.errors) {
        Object.entries(data.errors).forEach(([field, message]) => {
          console.log(chalk.red(`   • ${field}: ${message}`));
        });
      }
    } else if (error.message) {
      this.error(`Error${contextMsg}: ${error.message}`);
    } else {
      this.error(`Unknown error${contextMsg}: ${JSON.stringify(error)}`);
    }
  }
}
