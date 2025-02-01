import { EmailServiceImpl } from '../EmailService';
import { createClient } from '@supabase/supabase-js';
import { EmailTemplate, EmailQueueItem, EmailTrackingEvent } from '../index';

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
          lte: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [mockQueueItem],
              error: null
            }))
          }))
        })),
        single: jest.fn(() => ({
          data: mockData,
          error: null
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }))
}));

// Mock data
const mockTemplate: Omit<EmailTemplate, 'id'> = {
  name: 'Test Template',
  subject: 'Test Subject',
  body: 'Test Body',
  variables: {},
  metadata: {}
};

const mockData = {
  id: '123',
  ...mockTemplate
};

const mockQueueItem: EmailQueueItem = {
  id: '456',
  templateId: '123',
  contactId: '789',
  status: 'pending',
  scheduledFor: new Date(),
  variables: {},
  attempts: 0,
  metadata: {}
};

describe('EmailService', () => {
  let emailService: EmailServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailServiceImpl();
  });

  describe('createTemplate', () => {
    it('should create an email template successfully', async () => {
      const result = await emailService.createTemplate(mockTemplate);
      expect(result).toEqual(mockData);
      expect(createClient).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    });

    it('should handle errors when creating template', async () => {
      const mockError = new Error('Database error');
      jest.spyOn(emailService['supabase'], 'from').mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: null,
              error: mockError
            })
          })
        })
      }));

      await expect(emailService.createTemplate(mockTemplate)).rejects.toThrow('Database error');
    });
  });

  describe('queueEmail', () => {
    it('should queue an email successfully', async () => {
      const result = await emailService.queueEmail('123', '789');
      expect(result).toEqual(mockQueueItem);
    });

    it('should handle optional parameters', async () => {
      const variables = { name: 'Test' };
      const scheduledFor = new Date();
      const result = await emailService.queueEmail('123', '789', variables, scheduledFor);
      expect(result).toEqual(mockQueueItem);
    });
  });

  describe('processQueue', () => {
    it('should process pending emails in queue', async () => {
      await emailService.processQueue();
      expect(emailService['supabase'].from).toHaveBeenCalledWith('email_queue');
    });

    it('should handle errors during queue processing', async () => {
      const mockError = new Error('Queue processing error');
      jest.spyOn(emailService['supabase'], 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            lte: () => ({
              limit: () => ({
                data: null,
                error: mockError
              })
            })
          })
        })
      }));

      await expect(emailService.processQueue()).rejects.toThrow('Queue processing error');
    });
  });

  describe('trackEvent', () => {
    it('should track email events successfully', async () => {
      const event: EmailTrackingEvent['eventType'] = 'sent';
      const result = await emailService.trackEvent('123', event);
      expect(result).toBeDefined();
    });

    it('should include metadata in tracking events', async () => {
      const event: EmailTrackingEvent['eventType'] = 'opened';
      const metadata = { browser: 'Chrome' };
      const result = await emailService.trackEvent('123', event, metadata);
      expect(result).toBeDefined();
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve email analytics successfully', async () => {
      const mockEvents = [
        { eventType: 'sent', templateId: '123' },
        { eventType: 'opened', templateId: '123' },
        { eventType: 'clicked', templateId: '123' }
      ];

      jest.spyOn(emailService['supabase'], 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            data: mockEvents,
            error: null
          })
        })
      }));

      const result = await emailService.getAnalytics('123');
      expect(result.sentCount).toBe(1);
      expect(result.openCount).toBe(1);
      expect(result.clickCount).toBe(1);
    });

    it('should handle errors when retrieving analytics', async () => {
      const mockError = new Error('Analytics error');
      jest.spyOn(emailService['supabase'], 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            data: null,
            error: mockError
          })
        })
      }));

      await expect(emailService.getAnalytics('123')).rejects.toThrow('Analytics error');
    });
  });
}); 