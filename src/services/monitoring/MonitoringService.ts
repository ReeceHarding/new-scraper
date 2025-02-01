import { createClient } from '@supabase/supabase-js';
import { 
  MonitoringService, 
  AuditLog, 
  SystemMetric, 
  PerformanceLog, 
  AlertRule, 
  AlertHistory 
} from './index';
import { logger } from '../logging';

export class MonitoringServiceImpl implements MonitoringService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async logAudit(log: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .insert([{
          ...log,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info('Audit log created', { 
        eventType: log.eventType, 
        resourceType: log.resourceType 
      });
      return data;
    } catch (error) {
      logger.error('Failed to create audit log', { error });
      throw error;
    }
  }

  async recordMetric(metric: Omit<SystemMetric, 'id'>): Promise<SystemMetric> {
    try {
      const { data, error } = await this.supabase
        .from('system_metrics')
        .insert([{
          ...metric,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info('System metric recorded', { 
        metricName: metric.metricName, 
        value: metric.metricValue 
      });
      return data;
    } catch (error) {
      logger.error('Failed to record system metric', { error });
      throw error;
    }
  }

  async logPerformance(log: Omit<PerformanceLog, 'id'>): Promise<PerformanceLog> {
    try {
      const { data, error } = await this.supabase
        .from('performance_logs')
        .insert([{
          ...log,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info('Performance log created', { 
        operationType: log.operationType,
        durationMs: log.durationMs
      });
      return data;
    } catch (error) {
      logger.error('Failed to create performance log', { error });
      throw error;
    }
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    try {
      const { data, error } = await this.supabase
        .from('alert_rules')
        .insert([rule])
        .select()
        .single();

      if (error) throw error;

      logger.info('Alert rule created', { 
        name: rule.name, 
        alertType: rule.alertType 
      });
      return data;
    } catch (error) {
      logger.error('Failed to create alert rule', { error });
      throw error;
    }
  }

  async checkAlerts(): Promise<AlertHistory[]> {
    try {
      // Get active alert rules
      const { data: rules, error: rulesError } = await this.supabase
        .from('alert_rules')
        .select('*')
        .eq('enabled', true);

      if (rulesError) throw rulesError;

      const triggeredAlerts: AlertHistory[] = [];

      for (const rule of rules || []) {
        try {
          // Get latest metric value for the rule's metric
          const { data: metrics, error: metricsError } = await this.supabase
            .from('system_metrics')
            .select('*')
            .eq('metricName', rule.condition.metricName)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          if (metricsError) throw metricsError;

          // Check if metric value violates the rule's condition
          if (this.evaluateCondition(rule.condition, metrics.metricValue)) {
            // Check cooldown period
            const cooldownTime = new Date();
            cooldownTime.setMinutes(cooldownTime.getMinutes() - rule.cooldownMinutes);

            const { data: recentAlerts } = await this.supabase
              .from('alert_history')
              .select('*')
              .eq('ruleId', rule.id)
              .eq('status', 'triggered')
              .gt('timestamp', cooldownTime.toISOString())
              .limit(1);

            if (!recentAlerts?.length) {
              // Create new alert
              const alert: Omit<AlertHistory, 'id'> = {
                ruleId: rule.id,
                triggeredValue: metrics.metricValue,
                message: `Alert: ${rule.name} - Threshold ${rule.threshold} violated with value ${metrics.metricValue}`,
                status: 'triggered',
                metadata: {
                  severity: rule.severity,
                  condition: rule.condition
                }
              };

              const { data: newAlert, error: alertError } = await this.supabase
                .from('alert_history')
                .insert([alert])
                .select()
                .single();

              if (alertError) throw alertError;

              triggeredAlerts.push(newAlert);
              logger.warn('Alert triggered', { 
                ruleName: rule.name, 
                value: metrics.metricValue 
              });
            }
          }
        } catch (ruleError) {
          logger.error('Error processing alert rule', { 
            error: ruleError, 
            ruleId: rule.id 
          });
        }
      }

      return triggeredAlerts;
    } catch (error) {
      logger.error('Failed to check alerts', { error });
      throw error;
    }
  }

  async resolveAlert(alertId: string): Promise<AlertHistory> {
    try {
      const { data, error } = await this.supabase
        .from('alert_history')
        .update({ 
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          metadata: {
            resolvedBy: 'system'
          }
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Alert resolved', { alertId });
      return data;
    } catch (error) {
      logger.error('Failed to resolve alert', { error, alertId });
      throw error;
    }
  }

  private evaluateCondition(condition: Record<string, any>, value: number): boolean {
    const { operator, threshold } = condition;
    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        logger.warn('Unknown operator in alert condition', { operator });
        return false;
    }
  }
} 