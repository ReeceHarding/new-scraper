import { createClient } from '@supabase/supabase-js';
import { EmailService, EmailTemplate, EmailQueueItem, EmailTrackingEvent, EmailAnalytics } from './index';
import { logger } from '../logging';

export class EmailServiceImpl implements EmailService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
    try {
      const { data, error } = await this.supabase
        .from('email_templates')
        .insert([template])
        .select()
        .single();

      if (error) throw error;
      
      logger.info('Created email template', { templateId: data.id });
      return data;
    } catch (error) {
      logger.error('Failed to create email template', { error });
      throw error;
    }
  }

  async queueEmail(
    templateId: string,
    contactId: string,
    variables?: Record<string, any>,
    scheduledFor?: Date
  ): Promise<EmailQueueItem> {
    try {
      const queueItem: Omit<EmailQueueItem, 'id'> = {
        templateId,
        contactId,
        status: 'pending',
        scheduledFor: scheduledFor || new Date(),
        variables: variables || {},
        attempts: 0,
        metadata: {}
      };

      const { data, error } = await this.supabase
        .from('email_queue')
        .insert([queueItem])
        .select()
        .single();

      if (error) throw error;

      logger.info('Queued email', { emailId: data.id, templateId, contactId });
      return data;
    } catch (error) {
      logger.error('Failed to queue email', { error, templateId, contactId });
      throw error;
    }
  }

  async processQueue(): Promise<void> {
    try {
      const { data: queueItems, error } = await this.supabase
        .from('email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduledFor', new Date().toISOString())
        .limit(10);

      if (error) throw error;

      for (const item of queueItems || []) {
        try {
          // Here we would integrate with actual email sending service (Gmail, etc.)
          // For now, we'll just mark it as sent
          const { error: updateError } = await this.supabase
            .from('email_queue')
            .update({ 
              status: 'sent',
              attempts: item.attempts + 1,
              metadata: { ...item.metadata, lastProcessed: new Date().toISOString() }
            })
            .eq('id', item.id);

          if (updateError) throw updateError;

          await this.trackEvent(item.id, 'sent');
          logger.info('Processed email from queue', { emailId: item.id });
        } catch (itemError) {
          logger.error('Failed to process queue item', { error: itemError, emailId: item.id });
          await this.supabase
            .from('email_queue')
            .update({ 
              status: 'failed',
              attempts: item.attempts + 1,
              lastError: itemError.message,
              metadata: { ...item.metadata, lastError: itemError.message }
            })
            .eq('id', item.id);
        }
      }
    } catch (error) {
      logger.error('Failed to process email queue', { error });
      throw error;
    }
  }

  async trackEvent(
    emailId: string,
    event: EmailTrackingEvent['eventType'],
    metadata: Record<string, any> = {}
  ): Promise<EmailTrackingEvent> {
    try {
      const trackingEvent = {
        emailId,
        eventType: event,
        occurredAt: new Date(),
        metadata
      };

      const { data, error } = await this.supabase
        .from('email_tracking_events')
        .insert([trackingEvent])
        .select()
        .single();

      if (error) throw error;

      logger.info('Tracked email event', { emailId, event });
      return data;
    } catch (error) {
      logger.error('Failed to track email event', { error, emailId, event });
      throw error;
    }
  }

  async getAnalytics(templateId: string): Promise<EmailAnalytics> {
    try {
      const { data: events, error } = await this.supabase
        .from('email_tracking_events')
        .select('*')
        .eq('templateId', templateId);

      if (error) throw error;

      const analytics: EmailAnalytics = {
        id: templateId,
        templateId,
        sentCount: events.filter(e => e.eventType === 'sent').length,
        openCount: events.filter(e => e.eventType === 'opened').length,
        clickCount: events.filter(e => e.eventType === 'clicked').length,
        bounceCount: events.filter(e => e.eventType === 'bounced').length,
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalEvents: events.length
        }
      };

      logger.info('Retrieved email analytics', { templateId, analytics });
      return analytics;
    } catch (error) {
      logger.error('Failed to get email analytics', { error, templateId });
      throw error;
    }
  }
} 