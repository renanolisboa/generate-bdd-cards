export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export class RetryManager {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryCondition: (error: any) => {
      // Retry on network errors, 5xx, and 429 (rate limit)
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
      if (error.response?.status >= 500) return true;
      if (error.response?.status === 429) return true;
      return false;
    },
  };

  static async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await operation();
    } catch (error: any) {
      lastError = error;

        // Don't retry if it's the last attempt or retry condition is not met
        if (attempt === opts.maxAttempts || !opts.retryCondition(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
          opts.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;
        const totalDelay = delay + jitter;

        // Check for Retry-After header
        const retryAfter = error.response?.headers?.['retry-after'];
        const finalDelay = retryAfter ? Math.max(parseInt(retryAfter) * 1000, totalDelay) : totalDelay;

        console.log(`⏳ Retry attempt ${attempt}/${opts.maxAttempts} in ${Math.round(finalDelay)}ms...`);
        await this.sleep(finalDelay);
      }
    }

    throw lastError;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
