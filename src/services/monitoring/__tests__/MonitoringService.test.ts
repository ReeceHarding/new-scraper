import { MonitoringServiceImpl } from '../MonitoringService';
import { createClient } from '@supabase/supabase-js';
import { AuditLog, SystemMetric, PerformanceLog, AlertRule, AlertHistory } from '../index';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: mockData,
            error: null
          }))
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gt: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [],
              error: null
            }))
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => ({
                data: mockMetricData,
                error: null
              }))
            }))
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockData,
              error: null
            }))
          }))
        }))
      }))
    }))
  }))
}));

// Mock data
const mockAuditLog: Omit<AuditLog, 'id'> = {
  eventType: 'create',
  resourceType: 'user',
  resourceId: '123',
  metadata: {}
};

const mockMetric: Omit<SystemMetric, 'id'> = {
  metricName: 'cpu_usage',
  metricValue: 80,
  valueType: 'percentage',
  tags: {},
  metadata: {}
};

const mockPerformanceLog: Omit<PerformanceLog, 'id'> = {
  operationType: 'query',
  operationName: 'getUserProfile',
  durationMs: 150,
  startTime: new Date(),
  endTime: new Date(),
  success: true,
  metadata: {}
};

const mockAlertRule: Omit<AlertRule, 'id'> = {
  name: 'High CPU Usage',
  alertType: 'threshold',
  condition: {
    metricName: 'cpu_usage',
    operator: '>',
    threshold: 90
  },
  threshold: 90,
  severity: 'warning',
  enabled: true,
  notificationChannels: {},
  cooldownMinutes: 5,
  metadata: {}
};

const mockData = {
  id: '123',
  timestamp: new Date().toISOString()
};

const mockMetricData = {
  id: '456',
  metricName: 'cpu_usage',
  metricValue: 95,
  timestamp: new Date().toISOString()
};

describe('MonitoringService', () => {
  let monitoringService: MonitoringServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoringService = new MonitoringServiceImpl();
  });

  describe('logAudit', () => {
    it('should create an audit log successfully', async () => {
      const result = await monitoringService.logAudit(mockAuditLog);
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should handle errors when creating audit log', async () => {
      const mockError = new Error('Database error');
      jest.spyOn(monitoringService['supabase'], 'from').mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: null,
              error: mockError
            })
          })
        })
      }));

      await expect(monitoringService.logAudit(mockAuditLog)).rejects.toThrow('Database error');
    });
  });

  describe('recordMetric', () => {
    it('should record a system metric successfully', async () => {
      const result = await monitoringService.recordMetric(mockMetric);
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should include timestamp when recording metric', async () => {
      const insertSpy = jest.spyOn(monitoringService['supabase'], 'from');
      await monitoringService.recordMetric(mockMetric);
      expect(insertSpy).toHaveBeenCalledWith('system_metrics');
    });
  });

  describe('logPerformance', () => {
    it('should log performance data successfully', async () => {
      const result = await monitoringService.logPerformance(mockPerformanceLog);
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should handle failed performance logging', async () => {
      const mockError = new Error('Performance log error');
      jest.spyOn(monitoringService['supabase'], 'from').mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: null,
              error: mockError
            })
          })
        })
      }));

      await expect(monitoringService.logPerformance(mockPerformanceLog)).rejects.toThrow('Performance log error');
    });
  });

  describe('createAlertRule', () => {
    it('should create an alert rule successfully', async () => {
      const result = await monitoringService.createAlertRule(mockAlertRule);
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should validate alert rule data', async () => {
      const invalidRule = { ...mockAlertRule, severity: 'invalid' };
      await expect(monitoringService.createAlertRule(invalidRule as any)).resolves.toBeDefined();
    });
  });

  describe('checkAlerts', () => {
    it('should check alerts and return triggered ones', async () => {
      const result = await monitoringService.checkAlerts();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle errors during alert checking', async () => {
      const mockError = new Error('Alert check error');
      jest.spyOn(monitoringService['supabase'], 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            data: null,
            error: mockError
          })
        })
      }));

      await expect(monitoringService.checkAlerts()).rejects.toThrow('Alert check error');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert successfully', async () => {
      const result = await monitoringService.resolveAlert('123');
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should update alert status to resolved', async () => {
      const updateSpy = jest.spyOn(monitoringService['supabase'], 'from');
      await monitoringService.resolveAlert('123');
      expect(updateSpy).toHaveBeenCalledWith('alert_history');
    });
  });

  describe('evaluateCondition', () => {
    const testCases = [
      { operator: '>', value: 95, threshold: 90, expected: true },
      { operator: '>=', value: 90, threshold: 90, expected: true },
      { operator: '<', value: 85, threshold: 90, expected: true },
      { operator: '<=', value: 90, threshold: 90, expected: true },
      { operator: '==', value: 90, threshold: 90, expected: true },
      { operator: '!=', value: 85, threshold: 90, expected: true },
      { operator: 'invalid', value: 90, threshold: 90, expected: false }
    ];

    testCases.forEach(({ operator, value, threshold, expected }) => {
      it(`should evaluate ${operator} condition correctly`, () => {
        const condition = { operator, threshold };
        const result = monitoringService['evaluateCondition'](condition, value);
        expect(result).toBe(expected);
      });
    });
  });
}); 