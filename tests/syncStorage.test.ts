import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageQuotaMonitorService } from '../src/services/StorageQuotaMonitor';

describe('StorageQuotaMonitorService Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should calculate the percentage correctly', async () => {
    const mockEstimate = vi.fn().mockResolvedValue({
      usage: 800,
      quota: 1000
    });

    vi.stubGlobal('navigator', {
      storage: {
        estimate: mockEstimate
      }
    });

    const monitor = new StorageQuotaMonitorService(60000, 80);
    const estimate = await monitor.getEstimate();

    expect(estimate).not.toBeNull();
    expect(estimate?.percentage).toBe(80);
    expect(mockEstimate).toHaveBeenCalledTimes(1);
  });

  it('should fire warning callback if usage exceeds the warning threshold', async () => {
    const mockEstimate = vi.fn().mockResolvedValue({
      usage: 850,
      quota: 1000
    });

    vi.stubGlobal('navigator', {
      storage: {
        estimate: mockEstimate
      }
    });

    const monitor = new StorageQuotaMonitorService(60000, 80);
    const callback = vi.fn();

    const unsubscribe = monitor.start(callback);

    // Initial check is asynchronous
    await vi.advanceTimersByTimeAsync(0);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      usage: 850,
      quota: 1000,
      percentage: 85
    });

    // Advance time to trigger another check
    await vi.advanceTimersByTimeAsync(60000);
    
    // Total 2 checks (initial + 1 interval tick)
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('should NOT fire warning callback if usage does not exceed warning threshold', async () => {
    const mockEstimate = vi.fn().mockResolvedValue({
      usage: 500,
      quota: 1000
    });

    vi.stubGlobal('navigator', {
      storage: {
        estimate: mockEstimate
      }
    });

    const monitor = new StorageQuotaMonitorService(60000, 80);
    const callback = vi.fn();

    const unsubscribe = monitor.start(callback);
    await vi.advanceTimersByTimeAsync(0);

    expect(callback).not.toHaveBeenCalled();

    unsubscribe();
  });
});
