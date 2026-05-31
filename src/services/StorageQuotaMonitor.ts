export interface StorageQuotaEstimate {
  usage: number;
  quota: number;
  percentage: number;
}

export class StorageQuotaMonitorService {
  private intervalId: any = null;
  private onWarningCallback: ((estimate: StorageQuotaEstimate) => void) | null = null;
  private checkIntervalMs = 60000; // Check every 60 seconds (1 minute)
  private warningThreshold = 80;   // 80% threshold

  constructor(intervalMs?: number, threshold?: number) {
    if (intervalMs) this.checkIntervalMs = intervalMs;
    if (threshold) this.warningThreshold = threshold;
  }

  /**
   * Fetches the current storage estimate using browser's Storage Manager API.
   */
  public async getEstimate(): Promise<StorageQuotaEstimate | null> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        if (usage !== undefined && quota !== undefined && quota > 0) {
          return {
            usage,
            quota,
            percentage: (usage / quota) * 100
          };
        }
      }
    } catch (error) {
      console.error('Storage quota estimation failed:', error);
    }
    return null;
  }

  /**
   * Starts periodic quota checking. Returns an unsubscribe function for cleanup.
   */
  public start(onWarning: (estimate: StorageQuotaEstimate) => void): () => void {
    // Prevent starting multiple intervals
    this.stop();

    this.onWarningCallback = onWarning;
    
    // Initial check
    this.check();

    this.intervalId = setInterval(() => this.check(), this.checkIntervalMs);

    // Return a cleanup function
    return () => this.stop();
  }

  /**
   * Stops checking and cleans up references.
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onWarningCallback = null;
  }

  private async check() {
    const estimate = await this.getEstimate();
    if (estimate && estimate.percentage >= this.warningThreshold) {
      if (this.onWarningCallback) {
        this.onWarningCallback(estimate);
      }
    }
  }
}

export const storageQuotaMonitor = new StorageQuotaMonitorService();
