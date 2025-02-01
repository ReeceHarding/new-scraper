export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: Record<string, any>;
  metadata: Record<string, any>;
}

export interface EmailQueueItem {
  id: string;
  templateId: string;
  contactId: string;
  status: 'pending' | 'sent' | 'failed';
  scheduledFor: Date;
  variables: Record<string, any>;
  attempts: number;
  lastError?: string;
  metadata: Record<string, any>;
}

export interface EmailTrackingEvent {
  id: string;
  emailId: string;
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced';
  occurredAt: Date;
  metadata: Record<string, any>;
}

export interface EmailAnalytics {
  id: string;
  templateId: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  metadata: Record<string, any>;
}

export interface EmailService {
  createTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate>;
  queueEmail(templateId: string, contactId: string, variables?: Record<string, any>, scheduledFor?: Date): Promise<EmailQueueItem>;
  processQueue(): Promise<void>;
  trackEvent(emailId: string, event: EmailTrackingEvent['eventType'], metadata?: Record<string, any>): Promise<EmailTrackingEvent>;
  getAnalytics(templateId: string): Promise<EmailAnalytics>;
} 