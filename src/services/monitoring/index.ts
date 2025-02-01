export interface AuditLog {
  id: string;
  userId?: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  oldState?: Record<string, any>;
  newState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
}

export interface SystemMetric {
  id: string;
  metricName: string;
  metricValue: number;
  valueType: string;
  tags: Record<string, any>;
  metadata: Record<string, any>;
}

export interface PerformanceLog {
  id: string;
  operationType: string;
  operationName: string;
  durationMs: number;
  startTime: Date;
  endTime: Date;
  success: boolean;
  errorMessage?: string;
  resourceUsage?: Record<string, any>;
  metadata: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  alertType: string;
  condition: Record<string, any>;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notificationChannels: Record<string, any>;
  cooldownMinutes: number;
  metadata: Record<string, any>;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  triggeredValue: number;
  message: string;
  status: 'triggered' | 'resolved';
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface MonitoringService {
  logAudit(log: Omit<AuditLog, 'id'>): Promise<AuditLog>;
  recordMetric(metric: Omit<SystemMetric, 'id'>): Promise<SystemMetric>;
  logPerformance(log: Omit<PerformanceLog, 'id'>): Promise<PerformanceLog>;
  createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
  checkAlerts(): Promise<AlertHistory[]>;
  resolveAlert(alertId: string): Promise<AlertHistory>;
} 