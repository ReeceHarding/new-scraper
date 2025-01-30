# Step 3: Email Integration and Campaign Management

## 1. Gmail API Integration

### 1.1 Gmail API Setup
[] Set up Google Cloud Project
   [] Navigate to Google Cloud Console
   [] Create new project:
      [] Name: "new-scraper-prod"
      [] Organization: Select or create
      [] Location: Choose appropriate region
   [] Enable required APIs:
      [] Gmail API
      [] Google Drive API (for attachments)
      [] Google People API (for contacts)
   [] Configure OAuth consent screen:
      [] User Type: External
      [] App name: "New Scraper"
      [] Support email: Set admin email
      [] Developer contact: Add contact info
      [] Authorized domains: Add your domain
      [] Scopes:
         [] gmail.send
         [] gmail.compose
         [] gmail.readonly
         [] gmail.labels
         [] gmail.settings.basic
      [] Test users: Add development emails
   [] Create OAuth 2.0 credentials:
      [] Application type: Web application
      [] Name: "New Scraper Gmail Integration"
      [] Authorized redirect URIs:
         [] Development: http://localhost:3000/api/auth/callback/google
         [] Production: https://your-domain.com/api/auth/callback/google
      [] Download and secure credentials

[] Configure environment variables
   [] Create/update .env.local:
      ```plaintext
      # Gmail API Configuration
      GOOGLE_CLIENT_ID=your-client-id
      GOOGLE_CLIENT_SECRET=your-client-secret
      GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
      
      # Email Configuration
      EMAIL_FROM_ADDRESS=your-default-sender@domain.com
      EMAIL_REPLY_TO=your-reply-to@domain.com
      
      # Security
      ENCRYPTION_KEY=your-32-char-encryption-key
      ```
   [] Add validation in src/utils/validateEnv.ts:
      ```typescript
      import { z } from 'zod'

      const envSchema = z.object({
        GOOGLE_CLIENT_ID: z.string().min(1),
        GOOGLE_CLIENT_SECRET: z.string().min(1),
        GOOGLE_REDIRECT_URI: z.string().url(),
        EMAIL_FROM_ADDRESS: z.string().email(),
        EMAIL_REPLY_TO: z.string().email(),
        ENCRYPTION_KEY: z.string().length(32)
      })

      export function validateEnv() {
        const result = envSchema.safeParse(process.env)
        if (!result.success) {
          console.error('Invalid environment variables:', result.error.flatten())
          throw new Error('Invalid environment configuration')
        }
      }
      ```

### 1.2 Gmail Service Implementation
[] Create Gmail service utility
   [] Create file: src/services/gmail/GmailService.ts
      ```typescript
      import { google } from 'googleapis'
      import { OAuth2Client } from 'google-auth-library'
      import { encrypt, decrypt } from '@/utils/encryption'
      import { logger } from '@/services/logging'

      interface GmailTokens {
        access_token: string
        refresh_token: string
        scope: string
        token_type: string
        expiry_date: number
      }

      export class GmailService {
        private oauth2Client: OAuth2Client
        private gmail: ReturnType<typeof google.gmail>

        constructor(private readonly userId: string) {
          this.oauth2Client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          )
          this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
        }

        async initialize(encryptedTokens: string): Promise<void> {
          try {
            const tokens = JSON.parse(decrypt(encryptedTokens)) as GmailTokens
            this.oauth2Client.setCredentials(tokens)

            // Verify token validity
            const { expiry_date, refresh_token } = tokens
            if (Date.now() >= expiry_date) {
              if (!refresh_token) {
                throw new Error('No refresh token available')
              }
              const { credentials } = await this.oauth2Client.refreshAccessToken()
              await this.updateTokens(credentials)
            }
          } catch (error) {
            logger.error('Failed to initialize Gmail service:', {
              userId: this.userId,
              error
            })
            throw new Error('Gmail service initialization failed')
          }
        }

        private async updateTokens(tokens: GmailTokens): Promise<string> {
          try {
            const encryptedTokens = encrypt(JSON.stringify(tokens))
            await this.saveTokensToDatabase(encryptedTokens)
            return encryptedTokens
          } catch (error) {
            logger.error('Failed to update Gmail tokens:', {
              userId: this.userId,
              error
            })
            throw new Error('Failed to update Gmail tokens')
          }
        }

        private async saveTokensToDatabase(encryptedTokens: string): Promise<void> {
          // Implementation will be added in the database section
        }

        async sendEmail({
          to,
          subject,
          body,
          threadId
        }: {
          to: string
          subject: string
          body: string
          threadId?: string
        }): Promise<string> {
          try {
            const message = [
              'Content-Type: text/html; charset=utf-8',
              'MIME-Version: 1.0',
              `To: ${to}`,
              `From: ${process.env.EMAIL_FROM_ADDRESS}`,
              `Reply-To: ${process.env.EMAIL_REPLY_TO}`,
              `Subject: ${subject}`,
              '',
              body
            ].join('\n')

            const encodedMessage = Buffer.from(message)
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '')

            const res = await this.gmail.users.messages.send({
              userId: 'me',
              requestBody: {
                raw: encodedMessage,
                threadId
              }
            })

            logger.info('Email sent successfully:', {
              userId: this.userId,
              messageId: res.data.id,
              threadId: res.data.threadId
            })

            return res.data.id!
          } catch (error) {
            logger.error('Failed to send email:', {
              userId: this.userId,
              error
            })
            throw new Error('Failed to send email')
          }
        }

        async getThread(threadId: string) {
          try {
            const res = await this.gmail.users.threads.get({
              userId: 'me',
              id: threadId
            })

            return res.data
          } catch (error) {
            logger.error('Failed to get email thread:', {
              userId: this.userId,
              threadId,
              error
            })
            throw new Error('Failed to get email thread')
          }
        }

        async createLabel(name: string): Promise<string> {
          try {
            const res = await this.gmail.users.labels.create({
              userId: 'me',
              requestBody: {
                name,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show'
              }
            })

            return res.data.id!
          } catch (error) {
            logger.error('Failed to create Gmail label:', {
              userId: this.userId,
              labelName: name,
              error
            })
            throw new Error('Failed to create Gmail label')
          }
        }

        async addLabelToThread(threadId: string, labelId: string): Promise<void> {
          try {
            await this.gmail.users.threads.modify({
              userId: 'me',
              id: threadId,
              requestBody: {
                addLabelIds: [labelId]
              }
            })
          } catch (error) {
            logger.error('Failed to add label to thread:', {
              userId: this.userId,
              threadId,
              labelId,
              error
            })
            throw new Error('Failed to add label to thread')
          }
        }
      }
      ```

## 2. Database Schema Implementation

### 2.1 Email Credentials Table
[] Create email_credentials table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_email_credentials_table
      CREATE TABLE IF NOT EXISTS public.email_credentials (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('gmail')),
        encrypted_tokens TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT unique_user_email UNIQUE (user_id, email)
      );

      -- Add indexes
      CREATE INDEX idx_email_credentials_user_id ON public.email_credentials(user_id);
      CREATE INDEX idx_email_credentials_org_id ON public.email_credentials(org_id);
      CREATE INDEX idx_email_credentials_email ON public.email_credentials(email);

      -- Add RLS policies
      ALTER TABLE public.email_credentials ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Email credentials are viewable by organization members"
        ON public.email_credentials
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = email_credentials.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Email credentials are insertable by organization members"
        ON public.email_credentials
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Email credentials are updatable by credential owner"
        ON public.email_credentials
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Email credentials are deletable by credential owner"
        ON public.email_credentials
        FOR DELETE
        USING (auth.uid() = user_id);

      -- Add triggers
      CREATE TRIGGER update_email_credentials_updated_at
        BEFORE UPDATE ON public.email_credentials
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      ```

### 2.2 Email Campaigns Table
[] Create email_campaigns table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_email_campaigns_table
      CREATE TABLE IF NOT EXISTS public.email_campaigns (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
        schedule JSONB,
        template_id UUID,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID NOT NULL REFERENCES auth.users(id),
        updated_by UUID NOT NULL REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        CONSTRAINT campaigns_name_length CHECK (char_length(trim(name)) > 0)
      );

      -- Add indexes
      CREATE INDEX idx_email_campaigns_org_id ON public.email_campaigns(org_id);
      CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status);
      CREATE INDEX idx_email_campaigns_created_by ON public.email_campaigns(created_by);

      -- Add RLS policies
      ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Email campaigns are viewable by organization members"
        ON public.email_campaigns
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = email_campaigns.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Email campaigns are insertable by organization members"
        ON public.email_campaigns
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Email campaigns are updatable by organization members"
        ON public.email_campaigns
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = email_campaigns.org_id
              AND p.id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = NEW.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Email campaigns are deletable by organization members"
        ON public.email_campaigns
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = email_campaigns.org_id
              AND p.id = auth.uid()
          )
        );

      -- Add triggers
      CREATE TRIGGER update_email_campaigns_updated_at
        BEFORE UPDATE ON public.email_campaigns
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      -- Add audit logging
      CREATE TABLE IF NOT EXISTS audit.email_campaigns_log (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        campaign_id UUID NOT NULL,
        action TEXT NOT NULL,
        old_data JSONB,
        new_data JSONB,
        changed_by UUID NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION audit_email_campaigns_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO audit.email_campaigns_log
          (campaign_id, action, old_data, new_data, changed_by)
        VALUES
          (COALESCE(NEW.id, OLD.id),
           TG_OP,
           CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
           CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
           auth.uid());
        RETURN NULL;
      END;
      $$ language 'plpgsql' SECURITY DEFINER;

      CREATE TRIGGER audit_email_campaigns_changes
        AFTER INSERT OR UPDATE OR DELETE ON public.email_campaigns
        FOR EACH ROW
        EXECUTE FUNCTION audit_email_campaigns_changes();
      ```

### 2.3 Campaign Recipients Table
[] Create campaign_recipients table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_campaign_recipients_table
      CREATE TABLE IF NOT EXISTS public.campaign_recipients (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        company TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'opened', 'clicked', 'replied', 'unsubscribed')),
        sent_at TIMESTAMPTZ,
        opened_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        replied_at TIMESTAMPTZ,
        thread_id TEXT,
        message_id TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT recipients_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
      );

      -- Add indexes
      CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
      CREATE INDEX idx_campaign_recipients_email ON public.campaign_recipients(email);
      CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(status);
      CREATE INDEX idx_campaign_recipients_thread_id ON public.campaign_recipients(thread_id);

      -- Add RLS policies
      ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Campaign recipients are viewable by organization members"
        ON public.campaign_recipients
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.email_campaigns ec
            JOIN public.profiles p ON p.org_id = ec.org_id
            WHERE ec.id = campaign_recipients.campaign_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Campaign recipients are insertable by organization members"
        ON public.campaign_recipients
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.email_campaigns ec
            JOIN public.profiles p ON p.org_id = ec.org_id
            WHERE ec.id = campaign_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Campaign recipients are updatable by organization members"
        ON public.campaign_recipients
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.email_campaigns ec
            JOIN public.profiles p ON p.org_id = ec.org_id
            WHERE ec.id = campaign_recipients.campaign_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Campaign recipients are deletable by organization members"
        ON public.campaign_recipients
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.email_campaigns ec
            JOIN public.profiles p ON p.org_id = ec.org_id
            WHERE ec.id = campaign_recipients.campaign_id
              AND p.id = auth.uid()
          )
        );

      -- Add triggers
      CREATE TRIGGER update_campaign_recipients_updated_at
        BEFORE UPDATE ON public.campaign_recipients
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      ```

## 3. Campaign Management Implementation

### 3.1 Campaign Service
[] Create campaign service
   [] Create file: src/services/campaigns/CampaignService.ts
      ```typescript
      import { supabaseClient } from '@/lib/supabase/client'
      import { GmailService } from '@/services/gmail/GmailService'
      import { logger } from '@/services/logging'
      import { Database } from '@/types/supabase'

      type Campaign = Database['public']['Tables']['email_campaigns']['Row']
      type CampaignRecipient = Database['public']['Tables']['campaign_recipients']['Row']
      type EmailCredentials = Database['public']['Tables']['email_credentials']['Row']

      export class CampaignService {
        constructor(private readonly orgId: string) {}

        async createCampaign({
          name,
          description,
          schedule,
          templateId,
          settings
        }: {
          name: string
          description?: string
          schedule?: Record<string, any>
          templateId?: string
          settings?: Record<string, any>
        }): Promise<Campaign> {
          try {
            const { data: campaign, error } = await supabaseClient
              .from('email_campaigns')
              .insert({
                org_id: this.orgId,
                name,
                description,
                status: 'draft',
                schedule,
                template_id: templateId,
                settings: settings || {},
                created_by: (await supabaseClient.auth.getUser()).data.user!.id,
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .select()
              .single()

            if (error) throw error

            logger.info('Campaign created:', {
              campaignId: campaign.id,
              orgId: this.orgId
            })

            return campaign
          } catch (error) {
            logger.error('Failed to create campaign:', {
              orgId: this.orgId,
              error
            })
            throw new Error('Failed to create campaign')
          }
        }

        async addRecipients(
          campaignId: string,
          recipients: Array<{
            email: string
            firstName?: string
            lastName?: string
            company?: string
            metadata?: Record<string, any>
          }>
        ): Promise<void> {
          try {
            const { error } = await supabaseClient
              .from('campaign_recipients')
              .insert(
                recipients.map((recipient) => ({
                  campaign_id: campaignId,
                  email: recipient.email,
                  first_name: recipient.firstName,
                  last_name: recipient.lastName,
                  company: recipient.company,
                  metadata: recipient.metadata || {},
                  status: 'pending'
                }))
              )

            if (error) throw error

            logger.info('Recipients added to campaign:', {
              campaignId,
              count: recipients.length
            })
          } catch (error) {
            logger.error('Failed to add recipients:', {
              campaignId,
              error
            })
            throw new Error('Failed to add recipients')
          }
        }

        async startCampaign(campaignId: string): Promise<void> {
          try {
            // 1. Update campaign status
            const { error: updateError } = await supabaseClient
              .from('email_campaigns')
              .update({
                status: 'running',
                started_at: new Date().toISOString(),
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', campaignId)
              .eq('status', 'draft')

            if (updateError) throw updateError

            // 2. Get campaign details
            const { data: campaign, error: campaignError } = await supabaseClient
              .from('email_campaigns')
              .select('*')
              .eq('id', campaignId)
              .single()

            if (campaignError) throw campaignError

            // 3. Get email credentials
            const { data: credentials, error: credentialsError } = await supabaseClient
              .from('email_credentials')
              .select('*')
              .eq('org_id', this.orgId)
              .single()

            if (credentialsError) throw credentialsError

            // 4. Initialize Gmail service
            const gmailService = new GmailService(credentials.user_id)
            await gmailService.initialize(credentials.encrypted_tokens)

            // 5. Create campaign label
            const labelId = await gmailService.createLabel(`Campaign: ${campaign.name}`)

            // 6. Process recipients
            await this.processRecipients(campaignId, credentials, labelId)

            logger.info('Campaign started successfully:', {
              campaignId,
              orgId: this.orgId
            })
          } catch (error) {
            // Revert campaign status on error
            await supabaseClient
              .from('email_campaigns')
              .update({
                status: 'failed',
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', campaignId)

            logger.error('Failed to start campaign:', {
              campaignId,
              error
            })
            throw new Error('Failed to start campaign')
          }
        }

        private async processRecipients(
          campaignId: string,
          credentials: EmailCredentials,
          labelId: string
        ): Promise<void> {
          const batchSize = 10
          let lastProcessedId: string | null = null

          while (true) {
            // 1. Get next batch of recipients
            const { data: recipients, error: recipientsError } = await supabaseClient
              .from('campaign_recipients')
              .select('*')
              .eq('campaign_id', campaignId)
              .eq('status', 'pending')
              .order('created_at', { ascending: true })
              .limit(batchSize)
              .gt('id', lastProcessedId || '0')

            if (recipientsError) throw recipientsError
            if (!recipients?.length) break

            // 2. Process each recipient
            for (const recipient of recipients) {
              try {
                const gmailService = new GmailService(credentials.user_id)
                await gmailService.initialize(credentials.encrypted_tokens)

                // Send email
                const messageId = await gmailService.sendEmail({
                  to: recipient.email,
                  subject: 'Your Subject Here', // TODO: Get from template
                  body: 'Your Email Body Here' // TODO: Get from template
                })

                // Add label to thread
                const message = await gmailService.getThread(messageId)
                if (message.threadId) {
                  await gmailService.addLabelToThread(message.threadId, labelId)
                }

                // Update recipient status
                await supabaseClient
                  .from('campaign_recipients')
                  .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    message_id: messageId,
                    thread_id: message.threadId
                  })
                  .eq('id', recipient.id)

                logger.info('Email sent successfully:', {
                  campaignId,
                  recipientId: recipient.id,
                  messageId
                })
              } catch (error) {
                // Update recipient status to failed
                await supabaseClient
                  .from('campaign_recipients')
                  .update({
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                  })
                  .eq('id', recipient.id)

                logger.error('Failed to send email:', {
                  campaignId,
                  recipientId: recipient.id,
                  error
                })
              }

              // Add delay between emails
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }

            lastProcessedId = recipients[recipients.length - 1].id
          }

          // Update campaign status to completed
          await supabaseClient
            .from('email_campaigns')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_by: (await supabaseClient.auth.getUser()).data.user!.id
            })
            .eq('id', campaignId)
        }

        async pauseCampaign(campaignId: string): Promise<void> {
          try {
            const { error } = await supabaseClient
              .from('email_campaigns')
              .update({
                status: 'paused',
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', campaignId)
              .eq('status', 'running')

            if (error) throw error

            logger.info('Campaign paused:', {
              campaignId,
              orgId: this.orgId
            })
          } catch (error) {
            logger.error('Failed to pause campaign:', {
              campaignId,
              error
            })
            throw new Error('Failed to pause campaign')
          }
        }

        async resumeCampaign(campaignId: string): Promise<void> {
          try {
            const { error } = await supabaseClient
              .from('email_campaigns')
              .update({
                status: 'running',
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', campaignId)
              .eq('status', 'paused')

            if (error) throw error

            logger.info('Campaign resumed:', {
              campaignId,
              orgId: this.orgId
            })

            // Continue processing recipients
            const { data: campaign } = await supabaseClient
              .from('email_campaigns')
              .select('*')
              .eq('id', campaignId)
              .single()

            const { data: credentials } = await supabaseClient
              .from('email_credentials')
              .select('*')
              .eq('org_id', this.orgId)
              .single()

            const gmailService = new GmailService(credentials!.user_id)
            await gmailService.initialize(credentials!.encrypted_tokens)
            const labelId = await gmailService.createLabel(`Campaign: ${campaign!.name}`)

            await this.processRecipients(campaignId, credentials!, labelId)
          } catch (error) {
            logger.error('Failed to resume campaign:', {
              campaignId,
              error
            })
            throw new Error('Failed to resume campaign')
          }
        }

        async getCampaignStats(campaignId: string): Promise<{
          total: number
          pending: number
          sent: number
          failed: number
          opened: number
          clicked: number
          replied: number
        }> {
          try {
            const { data: stats, error } = await supabaseClient
              .from('campaign_recipients')
              .select('status', { count: 'exact' })
              .eq('campaign_id', campaignId)

            if (error) throw error

            const counts = {
              total: stats.length,
              pending: stats.filter((r) => r.status === 'pending').length,
              sent: stats.filter((r) => r.status === 'sent').length,
              failed: stats.filter((r) => r.status === 'failed').length,
              opened: stats.filter((r) => r.status === 'opened').length,
              clicked: stats.filter((r) => r.status === 'clicked').length,
              replied: stats.filter((r) => r.status === 'replied').length
            }

            return counts
          } catch (error) {
            logger.error('Failed to get campaign stats:', {
              campaignId,
              error
            })
            throw new Error('Failed to get campaign stats')
          }
        }
      }
      ```

### 3.2 Campaign Management UI
[] Create campaign list page
   [] Create file: src/pages/campaigns/index.tsx
      ```typescript
      import { useState } from 'react'
      import { useRouter } from 'next/router'
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { Database } from '@/types/supabase'
      import { format } from 'date-fns'

      type Campaign = Database['public']['Tables']['email_campaigns']['Row']

      export default function CampaignsPage() {
        const router = useRouter()
        const supabase = useSupabaseClient<Database>()
        const [campaigns, setCampaigns] = useState<Campaign[]>([])
        const [isLoading, setIsLoading] = useState(true)

        useEffect(() => {
          async function loadCampaigns() {
            try {
              const { data, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .order('created_at', { ascending: false })

              if (error) throw error
              setCampaigns(data || [])
            } catch (error) {
              console.error('Error loading campaigns:', error)
            } finally {
              setIsLoading(false)
            }
          }

          void loadCampaigns()
        }, [supabase])

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Email Campaigns
                    </h1>
                    <button
                      onClick={() => router.push('/campaigns/new')}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Create Campaign
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="loader">Loading...</div>
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-12">
                      <h3 className="text-lg font-medium text-gray-900">
                        No campaigns yet
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Get started by creating your first email campaign.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <ul className="divide-y divide-gray-200">
                        {campaigns.map((campaign) => (
                          <li key={campaign.id}>
                            <a
                              href={`/campaigns/${campaign.id}`}
                              className="block hover:bg-gray-50"
                            >
                              <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-indigo-600 truncate">
                                      {campaign.name}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-500">
                                      {campaign.description || 'No description'}
                                    </p>
                                  </div>
                                  <div className="ml-4 flex-shrink-0 flex">
                                    <p
                                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                        campaign.status
                                      )}`}
                                    >
                                      {campaign.status}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                  <div className="sm:flex">
                                    <p className="flex items-center text-sm text-gray-500">
                                      Created{' '}
                                      {format(
                                        new Date(campaign.created_at),
                                        'MMM d, yyyy'
                                      )}
                                    </p>
                                  </div>
                                  {campaign.completed_at && (
                                    <div className="mt-2 sm:mt-0">
                                      <p className="flex items-center text-sm text-gray-500">
                                        Completed{' '}
                                        {format(
                                          new Date(campaign.completed_at),
                                          'MMM d, yyyy'
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )
      }

      function getStatusColor(status: string): string {
        switch (status) {
          case 'draft':
            return 'bg-gray-100 text-gray-800'
          case 'scheduled':
            return 'bg-yellow-100 text-yellow-800'
          case 'running':
            return 'bg-green-100 text-green-800'
          case 'paused':
            return 'bg-orange-100 text-orange-800'
          case 'completed':
            return 'bg-blue-100 text-blue-800'
          case 'failed':
            return 'bg-red-100 text-red-800'
          default:
            return 'bg-gray-100 text-gray-800'
        }
      }
      ```

[] Create campaign creation page
   [] Create file: src/pages/campaigns/new.tsx
      ```typescript
      import { useState } from 'react'
      import { useRouter } from 'next/router'
      import { useForm } from 'react-hook-form'
      import { zodResolver } from '@hookform/resolvers/zod'
      import { z } from 'zod'
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { CampaignService } from '@/services/campaigns/CampaignService'
      import { useAuth } from '@/contexts/AuthContext'

      const campaignSchema = z.object({
        name: z.string().min(1, 'Campaign name is required'),
        description: z.string().optional(),
        schedule: z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          sendTime: z.string().optional()
        }).optional(),
        recipients: z.array(z.object({
          email: z.string().email('Invalid email address'),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          company: z.string().optional()
        })).min(1, 'At least one recipient is required')
      })

      type CampaignForm = z.infer<typeof campaignSchema>

      export default function NewCampaignPage() {
        const router = useRouter()
        const { organization } = useAuth()
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [error, setError] = useState<string | null>(null)

        const {
          register,
          handleSubmit,
          formState: { errors }
        } = useForm<CampaignForm>({
          resolver: zodResolver(campaignSchema)
        })

        const onSubmit = async (data: CampaignForm) => {
          if (!organization) return

          setIsSubmitting(true)
          setError(null)

          try {
            const campaignService = new CampaignService(organization.id)
            
            // Create campaign
            const campaign = await campaignService.createCampaign({
              name: data.name,
              description: data.description,
              schedule: data.schedule
            })

            // Add recipients
            await campaignService.addRecipients(campaign.id, data.recipients)

            router.push(`/campaigns/${campaign.id}`)
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to create campaign')
          } finally {
            setIsSubmitting(false)
          }
        }

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-semibold text-gray-900 mb-6">
                      Create New Campaign
                    </h1>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Campaign Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          {...register('name')}
                        />
                        {errors.name && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.name.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="description"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Description
                        </label>
                        <textarea
                          id="description"
                          rows={3}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          {...register('description')}
                        />
                      </div>

                      {/* Add recipient form fields here */}

                      {error && (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="text-sm text-red-700">{error}</div>
                        </div>
                      )}

                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => router.back()}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Creating...' : 'Create Campaign'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )
      }
      ```

[] Create campaign details page
   [] Create file: src/pages/campaigns/[id].tsx
      ```typescript
      import { useState, useEffect } from 'react'
      import { useRouter } from 'next/router'
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { Database } from '@/types/supabase'
      import { format } from 'date-fns'
      import { CampaignService } from '@/services/campaigns/CampaignService'
      import { useAuth } from '@/contexts/AuthContext'

      type Campaign = Database['public']['Tables']['email_campaigns']['Row']
      type CampaignRecipient = Database['public']['Tables']['campaign_recipients']['Row']

      interface CampaignStats {
        total: number
        pending: number
        sent: number
        failed: number
        opened: number
        clicked: number
        replied: number
      }

      export default function CampaignDetailsPage() {
        const router = useRouter()
        const { id } = router.query
        const { organization } = useAuth()
        const supabase = useSupabaseClient<Database>()
        const [campaign, setCampaign] = useState<Campaign | null>(null)
        const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
        const [stats, setStats] = useState<CampaignStats | null>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [error, setError] = useState<string | null>(null)
        const [isActionInProgress, setIsActionInProgress] = useState(false)

        useEffect(() => {
          if (id && organization) {
            void loadCampaignData()
          }
        }, [id, organization])

        async function loadCampaignData() {
          try {
            // Load campaign details
            const { data: campaign, error: campaignError } = await supabase
              .from('email_campaigns')
              .select('*')
              .eq('id', id)
              .single()

            if (campaignError) throw campaignError
            setCampaign(campaign)

            // Load recipients
            const { data: recipients, error: recipientsError } = await supabase
              .from('campaign_recipients')
              .select('*')
              .eq('campaign_id', id)
              .order('created_at', { ascending: true })

            if (recipientsError) throw recipientsError
            setRecipients(recipients || [])

            // Load stats
            const campaignService = new CampaignService(organization.id)
            const stats = await campaignService.getCampaignStats(id as string)
            setStats(stats)
          } catch (error) {
            console.error('Error loading campaign data:', error)
            setError('Failed to load campaign data')
          } finally {
            setIsLoading(false)
          }
        }

        async function handleAction(action: 'start' | 'pause' | 'resume') {
          if (!campaign || !organization) return

          setIsActionInProgress(true)
          setError(null)

          try {
            const campaignService = new CampaignService(organization.id)

            switch (action) {
              case 'start':
                await campaignService.startCampaign(campaign.id)
                break
              case 'pause':
                await campaignService.pauseCampaign(campaign.id)
                break
              case 'resume':
                await campaignService.resumeCampaign(campaign.id)
                break
            }

            await loadCampaignData()
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : `Failed to ${action} campaign`
            )
          } finally {
            setIsActionInProgress(false)
          }
        }

        if (isLoading) {
          return (
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="loader">Loading...</div>
              </div>
            </ProtectedRoute>
          )
        }

        if (!campaign) {
          return (
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-100">
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        Campaign not found
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        The campaign you're looking for doesn't exist or you don't
                        have access to it.
                      </p>
                      <button
                        onClick={() => router.push('/campaigns')}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Back to Campaigns
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          )
        }

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  {/* Campaign Header */}
                  <div className="md:flex md:items-center md:justify-between mb-8">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {campaign.name}
                      </h1>
                      {campaign.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {campaign.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex md:mt-0 md:ml-4">
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleAction('start')}
                          disabled={isActionInProgress}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          {isActionInProgress ? 'Starting...' : 'Start Campaign'}
                        </button>
                      )}
                      {campaign.status === 'running' && (
                        <button
                          onClick={() => handleAction('pause')}
                          disabled={isActionInProgress}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                        >
                          {isActionInProgress ? 'Pausing...' : 'Pause Campaign'}
                        </button>
                      )}
                      {campaign.status === 'paused' && (
                        <button
                          onClick={() => handleAction('resume')}
                          disabled={isActionInProgress}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          {isActionInProgress ? 'Resuming...' : 'Resume Campaign'}
                        </button>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-md bg-red-50 p-4 mb-6">
                      <div className="text-sm text-red-700">{error}</div>
                    </div>
                  )}

                  {/* Campaign Stats */}
                  {stats && (
                    <div className="bg-white shadow rounded-lg mb-8">
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Campaign Statistics
                        </h3>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Total
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.total}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Pending
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.pending}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Sent
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.sent}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Failed
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.failed}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Opened
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.opened}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Clicked
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.clicked}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Replied
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.replied}
                            </dd>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recipients List */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Recipients
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Sent At
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Activity
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {recipients.map((recipient) => (
                              <tr key={recipient.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {recipient.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {recipient.first_name
                                    ? `${recipient.first_name} ${
                                        recipient.last_name || ''
                                      }`
                                    : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                      recipient.status
                                    )}`}
                                  >
                                    {recipient.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {recipient.sent_at
                                    ? format(
                                        new Date(recipient.sent_at),
                                        'MMM d, yyyy HH:mm'
                                      )
                                    : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {getLastActivity(recipient)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )
      }

      function getLastActivity(recipient: CampaignRecipient): string {
        const activities = [
          { date: recipient.replied_at, action: 'Replied' },
          { date: recipient.clicked_at, action: 'Clicked' },
          { date: recipient.opened_at, action: 'Opened' },
          { date: recipient.sent_at, action: 'Sent' }
        ].filter((activity) => activity.date)

        if (activities.length === 0) return '-'

        const latest = activities.reduce((latest, current) => {
          return new Date(current.date!) > new Date(latest.date!)
            ? current
            : latest
        })

        return `${latest.action} on ${format(
          new Date(latest.date!),
          'MMM d, yyyy HH:mm'
        )}`
      }

      function getStatusColor(status: string): string {
        switch (status) {
          case 'pending':
            return 'bg-gray-100 text-gray-800'
          case 'sent':
            return 'bg-green-100 text-green-800'
          case 'failed':
            return 'bg-red-100 text-red-800'
          case 'bounced':
            return 'bg-red-100 text-red-800'
          case 'opened':
            return 'bg-blue-100 text-blue-800'
          case 'clicked':
            return 'bg-indigo-100 text-indigo-800'
          case 'replied':
            return 'bg-purple-100 text-purple-800'
          case 'unsubscribed':
            return 'bg-yellow-100 text-yellow-800'
          default:
            return 'bg-gray-100 text-gray-800'
        }
      }
      ```

## 4. Testing Implementation

### 4.1 Unit Tests
[] Create Gmail service tests
   [] Create file: src/__tests__/services/gmail/GmailService.test.ts
      ```typescript
      import { GmailService } from '@/services/gmail/GmailService'
      import { encrypt } from '@/utils/encryption'
      import { google } from 'googleapis'
      import { OAuth2Client } from 'google-auth-library'

      jest.mock('googleapis')
      jest.mock('google-auth-library')
      jest.mock('@/utils/encryption')

      describe('GmailService', () => {
        let gmailService: GmailService
        const mockUserId = 'test-user-id'
        const mockTokens = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          scope: 'test-scope',
          token_type: 'Bearer',
          expiry_date: Date.now() + 3600000 // 1 hour from now
        }

        beforeEach(() => {
          jest.clearAllMocks()
          gmailService = new GmailService(mockUserId)
        })

        describe('initialize', () => {
          it('should initialize with valid tokens', async () => {
            const mockDecrypt = jest.fn().mockReturnValue(JSON.stringify(mockTokens))
            require('@/utils/encryption').decrypt = mockDecrypt

            await gmailService.initialize('encrypted-tokens')

            expect(mockDecrypt).toHaveBeenCalledWith('encrypted-tokens')
            expect(OAuth2Client.prototype.setCredentials).toHaveBeenCalledWith(
              mockTokens
            )
          })

          it('should refresh tokens if expired', async () => {
            const expiredTokens = {
              ...mockTokens,
              expiry_date: Date.now() - 3600000 // 1 hour ago
            }
            const mockDecrypt = jest
              .fn()
              .mockReturnValue(JSON.stringify(expiredTokens))
            require('@/utils/encryption').decrypt = mockDecrypt

            const mockRefreshResponse = {
              credentials: {
                ...mockTokens,
                expiry_date: Date.now() + 3600000
              }
            }
            OAuth2Client.prototype.refreshAccessToken = jest
              .fn()
              .mockResolvedValue(mockRefreshResponse)

            await gmailService.initialize('encrypted-tokens')

            expect(OAuth2Client.prototype.refreshAccessToken).toHaveBeenCalled()
          })
        })

        describe('sendEmail', () => {
          it('should send email successfully', async () => {
            const mockSendResponse = {
              data: {
                id: 'test-message-id',
                threadId: 'test-thread-id'
              }
            }
            const mockGmail = {
              users: {
                messages: {
                  send: jest.fn().mockResolvedValue(mockSendResponse)
                }
              }
            }
            google.gmail = jest.fn().mockReturnValue(mockGmail)

            const result = await gmailService.sendEmail({
              to: 'test@example.com',
              subject: 'Test Subject',
              body: 'Test Body'
            })

            expect(result).toBe('test-message-id')
            expect(mockGmail.users.messages.send).toHaveBeenCalled()
          })
        })

        describe('createLabel', () => {
          it('should create label successfully', async () => {
            const mockCreateResponse = {
              data: {
                id: 'test-label-id',
                name: 'Test Label'
              }
            }
            const mockGmail = {
              users: {
                labels: {
                  create: jest.fn().mockResolvedValue(mockCreateResponse)
                }
              }
            }
            google.gmail = jest.fn().mockReturnValue(mockGmail)

            const result = await gmailService.createLabel('Test Label')

            expect(result).toBe('test-label-id')
            expect(mockGmail.users.labels.create).toHaveBeenCalledWith({
              userId: 'me',
              requestBody: {
                name: 'Test Label',
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show'
              }
            })
          })
        })
      })
      ```

[] Create campaign service tests
   [] Create file: src/__tests__/services/campaigns/CampaignService.test.ts
      ```typescript
      import { CampaignService } from '@/services/campaigns/CampaignService'
      import { supabaseClient } from '@/lib/supabase/client'
      import { GmailService } from '@/services/gmail/GmailService'

      jest.mock('@/lib/supabase/client')
      jest.mock('@/services/gmail/GmailService')

      describe('CampaignService', () => {
        let campaignService: CampaignService
        const mockOrgId = 'test-org-id'
        const mockUserId = 'test-user-id'

        beforeEach(() => {
          jest.clearAllMocks()
          campaignService = new CampaignService(mockOrgId)

          // Mock auth.getUser
          supabaseClient.auth.getUser = jest.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null
          })
        })

        describe('createCampaign', () => {
          it('should create campaign successfully', async () => {
            const mockCampaign = {
              id: 'test-campaign-id',
              name: 'Test Campaign',
              org_id: mockOrgId,
              status: 'draft'
            }
            supabaseClient.from = jest.fn().mockReturnValue({
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockCampaign,
                    error: null
                  })
                })
              })
            })

            const result = await campaignService.createCampaign({
              name: 'Test Campaign'
            })

            expect(result).toEqual(mockCampaign)
          })
        })

        describe('startCampaign', () => {
          it('should start campaign successfully', async () => {
            // Mock campaign data
            const mockCampaign = {
              id: 'test-campaign-id',
              name: 'Test Campaign',
              status: 'draft'
            }
            supabaseClient.from = jest.fn().mockReturnValue({
              update: jest.fn().mockResolvedValue({ error: null }),
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockCampaign,
                    error: null
                  })
                })
              })
            })
          })

          // Mock credentials
          const mockCredentials = {
            user_id: mockUserId,
            encrypted_tokens: 'encrypted-tokens'
          }
          supabaseClient.from = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCredentials,
                  error: null
                })
              })
            })
          })
        })

        // Mock Gmail service
        const mockLabelId = 'test-label-id'
        GmailService.prototype.createLabel = jest
          .fn()
          .mockResolvedValue(mockLabelId)

        await campaignService.startCampaign('test-campaign-id')

        expect(GmailService.prototype.createLabel).toHaveBeenCalledWith(
          `Campaign: ${mockCampaign.name}`
        )
      })
    })

    describe('getCampaignStats', () => {
      it('should return campaign stats', async () => {
        const mockRecipients = [
          { status: 'pending' },
          { status: 'sent' },
          { status: 'sent' },
          { status: 'opened' },
          { status: 'clicked' }
        ]
        supabaseClient.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockRecipients,
              error: null
            })
          })
        })

        const stats = await campaignService.getCampaignStats('test-campaign-id')

        expect(stats).toEqual({
          total: 5,
          pending: 1,
          sent: 2,
          failed: 0,
          opened: 1,
          clicked: 1,
          replied: 0
        })
      })
    })
  })
})
```

### 4.2 Integration Tests
[] Create campaign flow tests
   [] Create file: src/__tests__/integration/campaigns.test.ts
      ```typescript
      import { test, expect } from '@playwright/test'
      import { supabaseClient } from '@/lib/supabase/client'
      import { createTestUser, cleanupTestUser } from '../helpers/auth'
      import { setupGmailMock } from '../helpers/gmail'

      test.describe('Campaign Management', () => {
        let testUser: { id: string; email: string }

        test.beforeAll(async () => {
          testUser = await createTestUser()
        })

        test.afterAll(async () => {
          await cleanupTestUser(testUser.id)
        })

        test('should create and manage campaign', async ({ page }) => {
          // 1. Sign in
          await page.goto('/auth/signin')
          await page.fill('input[type="email"]', testUser.email)
          await page.fill('input[type="password"]', 'testpassword')
          await page.click('button[type="submit"]')
          await expect(page).toHaveURL('/dashboard')

          // 2. Navigate to campaigns
          await page.click('a[href="/campaigns"]')
          await expect(page).toHaveURL('/campaigns')

          // 3. Create new campaign
          await page.click('text=Create Campaign')
          await expect(page).toHaveURL('/campaigns/new')

          await page.fill('input[name="name"]', 'Test Campaign')
          await page.fill('textarea[name="description"]', 'Test Description')
          
          // Add test recipient
          await page.click('button:text("Add Recipient")')
          await page.fill('input[name="recipients.0.email"]', 'test@example.com')
          await page.fill('input[name="recipients.0.firstName"]', 'Test')
          await page.fill('input[name="recipients.0.lastName"]', 'User')

          await page.click('button[type="submit"]')

          // 4. Verify campaign created
          await expect(page).toHaveURL(/\/campaigns\/[\w-]+/)
          await expect(page.locator('h1')).toHaveText('Test Campaign')

          // 5. Start campaign
          await page.click('button:text("Start Campaign")')
          await expect(page.locator('span:text("running")')).toBeVisible()

          // 6. Verify recipient status
          await expect(
            page.locator('td:text("test@example.com")')
          ).toBeVisible()
          await expect(page.locator('td:text("Test User")')).toBeVisible()

          // 7. Pause campaign
          await page.click('button:text("Pause Campaign")')
          await expect(page.locator('span:text("paused")')).toBeVisible()

          // 8. Resume campaign
          await page.click('button:text("Resume Campaign")')
          await expect(page.locator('span:text("running")')).toBeVisible()

          // 9. Wait for completion
          await expect(page.locator('span:text("completed")')).toBeVisible({
            timeout: 30000
          })

          // 10. Verify stats
          const statsCard = page.locator('.campaign-stats')
          await expect(statsCard.locator('text=Total: 1')).toBeVisible()
          await expect(statsCard.locator('text=Sent: 1')).toBeVisible()
        })
      })
      ```

### 4.3 Test Helpers
[] Create test helpers
   [] Create file: src/__tests__/helpers/auth.ts
      ```typescript
      import { supabaseClient } from '@/lib/supabase/client'
      import { v4 as uuidv4 } from 'uuid'

      export async function createTestUser() {
        const email = `test-${uuidv4()}@example.com`
        const password = 'testpassword'

        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email,
          password
        })

        if (authError) throw authError

        const { data: org, error: orgError } = await supabaseClient
          .from('organizations')
          .insert({
            name: 'Test Organization',
            owner_id: authData.user!.id
          })
          .select()
          .single()

        if (orgError) throw orgError

        const { error: profileError } = await supabaseClient
          .from('profiles')
          .insert({
            id: authData.user!.id,
            org_id: org.id,
            display_name: 'Test User',
            role: 'admin',
            email
          })

        if (profileError) throw profileError

        return { id: authData.user!.id, email }
      }

      export async function cleanupTestUser(userId: string) {
        await supabaseClient.auth.admin.deleteUser(userId)
      }
      ```

   [] Create file: src/__tests__/helpers/gmail.ts
      ```typescript
      import { rest } from 'msw'
      import { setupServer } from 'msw/node'

      export function setupGmailMock() {
        const server = setupServer(
          rest.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            (req, res, ctx) => {
              return res(
                ctx.json({
                  id: 'test-message-id',
                  threadId: 'test-thread-id'
                })
              )
            }
          ),

          rest.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/labels',
            (req, res, ctx) => {
              return res(
                ctx.json({
                  id: 'test-label-id',
                  name: req.body.name
                })
              )
            }
          )
        )

        beforeAll(() => server.listen())
        afterEach(() => server.resetHandlers())
        afterAll(() => server.close())

        return server
      }
      ```

## 5. Documentation and Deployment

### 5.1 API Documentation
[] Create API documentation
   [] Create file: docs/api/email-campaigns.md
      ```markdown
      # Email Campaign API Documentation

      ## Overview
      The Email Campaign API provides endpoints for managing email campaigns, including creation, monitoring, and statistics.

      ## Authentication
      All API endpoints require authentication using a valid JWT token. Include the token in the Authorization header:
      ```bash
      Authorization: Bearer <your-jwt-token>
      ```

      ## Endpoints

      ### Create Campaign
      ```http
      POST /api/campaigns
      ```

      **Request Body:**
      ```json
      {
        "name": "string",
        "description": "string (optional)",
        "schedule": {
          "startDate": "string (ISO date, optional)",
          "endDate": "string (ISO date, optional)",
          "sendTime": "string (optional)"
        },
        "recipients": [
          {
            "email": "string",
            "firstName": "string (optional)",
            "lastName": "string (optional)",
            "company": "string (optional)",
            "metadata": "object (optional)"
          }
        ]
      }
      ```

      **Response:**
      ```json
      {
        "id": "string (UUID)",
        "name": "string",
        "status": "draft",
        "created_at": "string (ISO date)"
      }
      ```

      ### Start Campaign
      ```http
      POST /api/campaigns/{id}/start
      ```

      **Response:**
      ```json
      {
        "status": "running",
        "started_at": "string (ISO date)"
      }
      ```

      ### Pause Campaign
      ```http
      POST /api/campaigns/{id}/pause
      ```

      **Response:**
      ```json
      {
        "status": "paused"
      }
      ```

      ### Resume Campaign
      ```http
      POST /api/campaigns/{id}/resume
      ```

      **Response:**
      ```json
      {
        "status": "running"
      }
      ```

      ### Get Campaign Stats
      ```http
      GET /api/campaigns/{id}/stats
      ```

      **Response:**
      ```json
      {
        "total": "number",
        "pending": "number",
        "sent": "number",
        "failed": "number",
        "opened": "number",
        "clicked": "number",
        "replied": "number"
      }
      ```

      ## Error Handling
      The API uses standard HTTP status codes and returns error messages in the following format:

      ```json
      {
        "error": {
          "code": "string",
          "message": "string",
          "details": "object (optional)"
        }
      }
      ```

      Common error codes:
      - 400: Bad Request
      - 401: Unauthorized
      - 403: Forbidden
      - 404: Not Found
      - 429: Too Many Requests
      - 500: Internal Server Error

      ## Rate Limiting
      API requests are limited to:
      - 100 requests per minute per IP
      - 1000 requests per hour per user
      - 50 concurrent campaign processes per organization

      ## Webhook Events
      The API can send webhook notifications for the following events:
      - campaign.started
      - campaign.paused
      - campaign.resumed
      - campaign.completed
      - email.sent
      - email.opened
      - email.clicked
      - email.replied
      - email.bounced
      - email.unsubscribed
      ```

### 5.2 Implementation Guide
[] Create implementation guide
   [] Create file: docs/guides/email-campaigns.md
      ```markdown
      # Email Campaign Implementation Guide

      ## Overview
      This guide explains how to implement and use the email campaign functionality in your application.

      ## Prerequisites
      1. Supabase project set up
      2. Gmail API credentials configured
      3. Required environment variables set

      ## Setup Steps

      ### 1. Database Setup
      1. Run the provided migrations to create required tables:
         - email_credentials
         - email_campaigns
         - campaign_recipients

      2. Verify RLS policies are in place for each table

      ### 2. Gmail Integration
      1. Configure Gmail API in Google Cloud Console:
         - Enable required APIs
         - Set up OAuth consent screen
         - Create credentials
         - Configure redirect URIs

      2. Store encrypted Gmail tokens:
         - Implement secure token storage
         - Handle token refresh
         - Set up encryption for sensitive data

      ### 3. Campaign Management
      1. Create a new campaign:
         ```typescript
         const campaignService = new CampaignService(organizationId)
         const campaign = await campaignService.createCampaign({
           name: 'My Campaign',
           description: 'Campaign description'
         })
         ```

      2. Add recipients:
         ```typescript
         await campaignService.addRecipients(campaign.id, [
           {
             email: 'recipient@example.com',
             firstName: 'John',
             lastName: 'Doe'
           }
         ])
         ```

      3. Start the campaign:
         ```typescript
         await campaignService.startCampaign(campaign.id)
         ```

      4. Monitor progress:
         ```typescript
         const stats = await campaignService.getCampaignStats(campaign.id)
         ```

      ### 4. Error Handling
      1. Implement error handling for:
         - API rate limits
         - Token expiration
         - Network issues
         - Invalid recipients
         - Bounce handling

      2. Set up logging and monitoring:
         - Use structured logging
         - Monitor campaign metrics
         - Track error rates
         - Set up alerts

      ### 5. Testing
      1. Unit tests:
         - Test service methods
         - Mock external dependencies
         - Verify error handling

      2. Integration tests:
         - Test complete campaign flow
         - Verify email delivery
         - Check status updates

      3. End-to-end tests:
         - Test UI interactions
         - Verify campaign management
         - Check statistics display

      ## Best Practices
      1. Rate Limiting
         - Implement gradual sending
         - Add delays between emails
         - Monitor API usage

      2. Security
         - Encrypt sensitive data
         - Validate input
         - Implement access controls

      3. Monitoring
         - Track success rates
         - Monitor bounce rates
         - Set up alerting

      4. Compliance
         - Include unsubscribe links
         - Honor opt-out requests
         - Maintain audit logs
      ```

### 5.3 Deployment Checklist
[] Create deployment checklist
   [] Create file: docs/deployment/email-campaigns.md
      ```markdown
      # Email Campaign Deployment Checklist

      ## Pre-deployment
      [] Environment Configuration
         [] Set up production environment variables
         [] Configure Gmail API credentials
         [] Set up encryption keys
         [] Configure rate limits

      [] Database Setup
         [] Run migrations
         [] Verify indexes
         [] Check RLS policies
         [] Set up backups

      [] Security
         [] Audit authentication
         [] Review access controls
         [] Check encryption
         [] Verify API security

      [] Testing
         [] Run unit tests
         [] Complete integration tests
         [] Perform load testing
         [] Test error scenarios

      ## Deployment
      [] Database
         [] Apply migrations
         [] Verify data integrity
         [] Check connections
         [] Monitor performance

      [] API
         [] Deploy API updates
         [] Configure rate limiting
         [] Set up monitoring
         [] Enable logging

      [] Frontend
         [] Deploy UI changes
         [] Verify routing
         [] Check authentication
         [] Test responsiveness

      [] Monitoring
         [] Set up error tracking
         [] Configure alerts
         [] Enable performance monitoring
         [] Set up logging

      ## Post-deployment
      [] Verification
         [] Test authentication flow
         [] Verify campaign creation
         [] Check email sending
         [] Monitor statistics

      [] Documentation
         [] Update API docs
         [] Update user guides
         [] Document changes
         [] Update troubleshooting guides

      [] Monitoring
         [] Check error rates
         [] Monitor performance
         [] Verify logging
         [] Test alerting

      [] Maintenance
         [] Schedule backups
         [] Plan updates
         [] Set up maintenance windows
         [] Document procedures
      ```

### 5.4 Implementation Checklist Summary
[] Backend Implementation
   [] Gmail API integration complete
   [] Database schema implemented
   [] Campaign service implemented
   [] Error handling in place
   [] Testing suite complete

[] Frontend Implementation
   [] Campaign management UI complete
   [] Form validation implemented
   [] Error handling in place
   [] Loading states added
   [] Responsive design verified

[] Testing
   [] Unit tests written
   [] Integration tests complete
   [] E2E tests passing
   [] Performance testing done
   [] Security testing complete

[] Documentation
   [] API documentation complete
   [] Implementation guide written
   [] Deployment guide created
   [] Testing procedures documented

### 5.5 Next Steps
[] Review and enhance error handling
[] Implement advanced campaign features
[] Add analytics and reporting
[] Enhance monitoring and alerting
[] Conduct security audit
[] Optimize performance
[] Add A/B testing capabilities
[] Implement template management 