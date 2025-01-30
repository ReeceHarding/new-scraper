# Step 2: Authentication and Single-Admin Model Implementation

## 1. Supabase Authentication Setup

### 1.1 Environment Configuration
[] Set up Supabase project
   [] Navigate to supabase.com and log in
   [] Click "New Project" button
   [] Enter project details:
      [] Name: "new-scraper-prod"
      [] Database Password: Generate strong password (min 16 chars)
      [] Region: Select closest to target users
      [] Pricing Plan: Select appropriate tier
   [] Configure project settings in dashboard:
      [] Enable Row Level Security (RLS)
      [] Set up daily backups
      [] Configure project API settings
      [] Set up project JWT settings
   [] Enable email authentication:
      [] Navigate to Authentication > Providers
      [] Enable Email provider
      [] Configure password strength requirements:
         [] Minimum length: 12 characters
         [] Require uppercase letters
         [] Require numbers
         [] Require special characters
      [] Set up email templates:
         [] Customize confirmation email
            [] Add company logo
            [] Update email content
            [] Test email template
         [] Customize reset password email
            [] Add company branding
            [] Update reset instructions
            [] Test reset flow
         [] Customize magic link email (if using)
            [] Add security notices
            [] Update email content
            [] Test magic link flow

[] Configure environment variables
   [] Create .env.local file in project root
   [] Add Supabase configuration:
      [] NEXT_PUBLIC_SUPABASE_URL:
         [] Format: https://<project-id>.supabase.co
         [] Copy from Supabase dashboard > Settings > API
         [] Verify URL format and accessibility
      [] NEXT_PUBLIC_SUPABASE_ANON_KEY:
         [] Copy from dashboard > Settings > API > Project API keys
         [] Verify key starts with 'eyJ...'
         [] Test key permissions
      [] SUPABASE_SERVICE_ROLE_KEY:
         [] Copy from dashboard > Settings > API > Project API keys
         [] Store securely, never expose in frontend
         [] Set up key rotation schedule
      [] SUPABASE_JWT_SECRET:
         [] Generate using secure method
         [] Minimum 32 characters
         [] Store in password manager
   [] Set up environment validation:
      [] Create validateEnv.ts script
      [] Add validation for each variable
      [] Implement startup checks
      [] Add error handling for missing vars

[] Set up development environment
   [] Install Supabase CLI:
      [] Run: `npm install -g supabase`
      [] Verify installation: `supabase -v`
      [] Configure CLI authentication:
         [] Generate access token from Supabase dashboard
         [] Run: `supabase login`
         [] Verify login success
   [] Configure local development:
      [] Initialize Supabase project locally:
         [] Run: `supabase init`
         [] Set up local config files
         [] Configure local database
      [] Set up local database schema:
         [] Create migration files
         [] Test migrations locally
         [] Verify schema integrity
   [] Configure test environment:
      [] Create separate Supabase test project
      [] Set up test environment variables
      [] Configure test database
      [] Set up automated testing
   [] Set up staging environment:
      [] Create staging Supabase project
      [] Configure staging variables
      [] Set up deployment pipeline
      [] Implement staging checks

### 1.2 Supabase Client Setup
[] Create frontend client configuration
   [] Create src/lib/supabase/client.ts:
      ```typescript
      import { createClient } from '@supabase/supabase-js'
      import { Database } from '@/types/supabase'

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
      }

      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
      }

      export const supabaseClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          },
          db: {
            schema: 'public'
          },
          global: {
            headers: {
              'x-application-name': 'new-scraper'
            }
          }
        }
      )
      ```
   [] Add type definitions:
      [] Generate Supabase types:
         [] Run: `supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts`
         [] Add custom type augmentations
         [] Set up type utilities
   [] Set up error handling:
      [] Create custom error classes
      [] Implement error interceptors
      [] Add error reporting
      [] Set up retry logic
   [] Configure authentication hooks:
      [] Create useAuth hook:
         ```typescript
         export function useAuth() {
           const [session, setSession] = useState<Session | null>(null)
           const [loading, setLoading] = useState(true)
           const [error, setError] = useState<Error | null>(null)

           useEffect(() => {
             let mounted = true

             async function getInitialSession() {
               try {
                 const { data: { session }, error } = await supabaseClient.auth.getSession()
                 if (error) throw error
                 if (mounted) {
                   setSession(session)
                   setLoading(false)
                 }
               } catch (e) {
                 if (mounted) {
                   setError(e as Error)
                   setLoading(false)
                 }
               }
             }

             getInitialSession()

             const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
               (_event, session) => {
                 if (mounted) setSession(session)
               }
             )

             return () => {
               mounted = false
               subscription.unsubscribe()
             }
           }, [])

           return { session, loading, error }
         }
         ```
      [] Add session management
      [] Implement auth state sync
      [] Set up auth listeners

[] Set up backend client
   [] Create src/lib/supabase/admin.ts:
      ```typescript
      import { createClient } from '@supabase/supabase-js'
      import { Database } from '@/types/supabase'

      if (!process.env.SUPABASE_URL) {
        throw new Error('Missing SUPABASE_URL')
      }

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
      }

      export const supabaseAdmin = createClient<Database>(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        }
      )
      ```
   [] Configure service role client:
      [] Set up admin permissions
      [] Configure security policies
      [] Implement access controls
      [] Add role validation
   [] Add security measures:
      [] Implement request signing
      [] Add rate limiting
      [] Set up IP allowlisting
      [] Configure audit logging
   [] Set up error handling:
      [] Create error handlers
      [] Implement retry logic
      [] Add timeout handling
      [] Set up fallback mechanisms
   [] Add logging:
      [] Configure structured logging
      [] Set up error tracking
      [] Implement audit trails
      [] Add performance monitoring

## 2. Database Schema Implementation

### 2.1 Organizations Table
[] Create organizations table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_organizations_table
      CREATE TABLE IF NOT EXISTS public.organizations (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT NOT NULL CHECK (char_length(name) >= 3),
        owner_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT organizations_name_length CHECK (char_length(trim(name)) > 0)
      );

      -- Add indexes
      CREATE INDEX idx_organizations_owner_id ON public.organizations(owner_id);
      CREATE INDEX idx_organizations_name ON public.organizations(name);

      -- Add RLS policies
      ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Organizations are viewable by owner"
        ON public.organizations
        FOR SELECT
        USING (auth.uid() = owner_id);

      CREATE POLICY "Organizations are insertable by authenticated users"
        ON public.organizations
        FOR INSERT
        WITH CHECK (auth.role() = 'authenticated');

      CREATE POLICY "Organizations are updatable by owner"
        ON public.organizations
        FOR UPDATE
        USING (auth.uid() = owner_id)
        WITH CHECK (auth.uid() = owner_id);

      CREATE POLICY "Organizations are deletable by owner"
        ON public.organizations
        FOR DELETE
        USING (auth.uid() = owner_id);
      ```
   [] Add constraints:
      [] Create foreign key to auth.users:
         ```sql
         ALTER TABLE public.organizations
           ADD CONSTRAINT fk_organizations_owner
           FOREIGN KEY (owner_id)
           REFERENCES auth.users(id)
           ON DELETE CASCADE;
         ```
      [] Add unique constraint on owner_id:
         ```sql
         ALTER TABLE public.organizations
           ADD CONSTRAINT unique_organization_owner
           UNIQUE (owner_id);
         ```
   [] Create triggers:
      [] Add updated_at trigger:
         ```sql
         CREATE OR REPLACE FUNCTION update_updated_at_column()
         RETURNS TRIGGER AS $$
         BEGIN
           NEW.updated_at = now();
           RETURN NEW;
         END;
         $$ language 'plpgsql';

         CREATE TRIGGER update_organizations_updated_at
           BEFORE UPDATE ON public.organizations
           FOR EACH ROW
           EXECUTE FUNCTION update_updated_at_column();
         ```
      [] Add audit logging trigger:
         ```sql
         CREATE TABLE IF NOT EXISTS audit.organizations_log (
           id UUID DEFAULT uuid_generate_v4(),
           organization_id UUID,
           action TEXT,
           old_data JSONB,
           new_data JSONB,
           changed_by UUID,
           changed_at TIMESTAMPTZ DEFAULT now(),
           PRIMARY KEY (id)
         );

         CREATE OR REPLACE FUNCTION audit_organizations_changes()
         RETURNS TRIGGER AS $$
         BEGIN
           INSERT INTO audit.organizations_log
             (organization_id, action, old_data, new_data, changed_by)
           VALUES
             (COALESCE(NEW.id, OLD.id),
              TG_OP,
              CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
              CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
              auth.uid());
           RETURN NULL;
         END;
         $$ language 'plpgsql' SECURITY DEFINER;

         CREATE TRIGGER audit_organizations_changes
           AFTER INSERT OR UPDATE OR DELETE ON public.organizations
           FOR EACH ROW
           EXECUTE FUNCTION audit_organizations_changes();
         ```

### 2.2 Profiles Table
[] Create profiles table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_profiles_table
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY,
        org_id UUID NOT NULL,
        display_name TEXT NOT NULL CHECK (char_length(display_name) >= 2),
        role TEXT NOT NULL CHECK (role IN ('admin')),
        email CITEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT profiles_display_name_length CHECK (char_length(trim(display_name)) > 0)
      );

      -- Add indexes
      CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);
      CREATE INDEX idx_profiles_email ON public.profiles(email);
      CREATE INDEX idx_profiles_role ON public.profiles(role);

      -- Add RLS policies
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Profiles are viewable by organization members"
        ON public.profiles
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = profiles.org_id
              AND o.owner_id = auth.uid()
          )
        );

      CREATE POLICY "Profiles are insertable by organization owner"
        ON public.profiles
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = org_id
              AND o.owner_id = auth.uid()
          )
        );

      CREATE POLICY "Profiles are updatable by organization owner"
        ON public.profiles
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = profiles.org_id
              AND o.owner_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = NEW.org_id
              AND o.owner_id = auth.uid()
          )
        );

      CREATE POLICY "Profiles are deletable by organization owner"
        ON public.profiles
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = profiles.org_id
              AND o.owner_id = auth.uid()
          )
        );
      ```
   [] Add constraints:
      [] Create foreign key to organizations:
         ```sql
         ALTER TABLE public.profiles
           ADD CONSTRAINT fk_profiles_organization
           FOREIGN KEY (org_id)
           REFERENCES public.organizations(id)
           ON DELETE CASCADE;
         ```
      [] Add unique constraint on email:
         ```sql
         ALTER TABLE public.profiles
           ADD CONSTRAINT unique_profile_email
           UNIQUE (email);
         ```
   [] Create triggers:
      [] Add updated_at trigger:
         ```sql
         CREATE TRIGGER update_profiles_updated_at
           BEFORE UPDATE ON public.profiles
           FOR EACH ROW
           EXECUTE FUNCTION update_updated_at_column();
         ```
      [] Add audit logging trigger:
         ```sql
         CREATE TABLE IF NOT EXISTS audit.profiles_log (
           id UUID DEFAULT uuid_generate_v4(),
           profile_id UUID,
           action TEXT,
           old_data JSONB,
           new_data JSONB,
           changed_by UUID,
           changed_at TIMESTAMPTZ DEFAULT now(),
           PRIMARY KEY (id)
         );

         CREATE OR REPLACE FUNCTION audit_profiles_changes()
         RETURNS TRIGGER AS $$
         BEGIN
           INSERT INTO audit.profiles_log
             (profile_id, action, old_data, new_data, changed_by)
           VALUES
             (COALESCE(NEW.id, OLD.id),
              TG_OP,
              CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
              CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
              auth.uid());
           RETURN NULL;
         END;
         $$ language 'plpgsql' SECURITY DEFINER;

         CREATE TRIGGER audit_profiles_changes
           AFTER INSERT OR UPDATE OR DELETE ON public.profiles
           FOR EACH ROW
           EXECUTE FUNCTION audit_profiles_changes();
         ```

## 3. Authentication Flows

### 3.1 Sign Up Implementation
[] Create signup page component
   [] Create file: src/pages/auth/signup.tsx
      ```typescript
      import { useState } from 'react'
      import { useRouter } from 'next/router'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { zodResolver } from '@hookform/resolvers/zod'
      import { useForm } from 'react-hook-form'
      import { z } from 'zod'

      const signupSchema = z.object({
        email: z.string().email('Invalid email address'),
        password: z
          .string()
          .min(12, 'Password must be at least 12 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number')
          .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
        organizationName: z
          .string()
          .min(3, 'Organization name must be at least 3 characters')
          .max(50, 'Organization name must be less than 50 characters'),
        confirmPassword: z.string()
      }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
      })

      type SignupForm = z.infer<typeof signupSchema>

      export default function SignupPage() {
        const router = useRouter()
        const supabase = useSupabaseClient()
        const [isLoading, setIsLoading] = useState(false)
        const [serverError, setServerError] = useState<string | null>(null)

        const {
          register,
          handleSubmit,
          formState: { errors }
        } = useForm<SignupForm>({
          resolver: zodResolver(signupSchema)
        })

        const onSubmit = async (data: SignupForm) => {
          setIsLoading(true)
          setServerError(null)

          try {
            // 1. Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: data.email,
              password: data.password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`
              }
            })

            if (authError) throw authError

            if (authData.user) {
              // 2. Create organization and profile
              const response = await fetch('/api/auth/create-organization', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId: authData.user.id,
                  email: data.email,
                  organizationName: data.organizationName
                })
              })

              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to create organization')
              }

              // 3. Redirect to verification page
              router.push('/auth/verify-email')
            }
          } catch (error) {
            setServerError(error instanceof Error ? error.message : 'An error occurred')
          } finally {
            setIsLoading(false)
          }
        }

        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
              <div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                  Create your account
                </h2>
              </div>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div className="rounded-md shadow-sm -space-y-px">
                  <div>
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Email address"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="organizationName" className="sr-only">
                      Organization name
                    </label>
                    <input
                      id="organizationName"
                      type="text"
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Organization name"
                      {...register('organizationName')}
                    />
                    {errors.organizationName && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.organizationName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="sr-only">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Password"
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="sr-only">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Confirm password"
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                {serverError && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{serverError}</div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating account...' : 'Sign up'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      ```

[] Create API route for organization creation
   [] Create file: src/pages/api/auth/create-organization.ts
      ```typescript
      import { NextApiRequest, NextApiResponse } from 'next'
      import { supabaseAdmin } from '@/lib/supabase/admin'
      import { z } from 'zod'

      const createOrgSchema = z.object({
        userId: z.string().uuid(),
        email: z.string().email(),
        organizationName: z.string().min(3).max(50)
      })

      export default async function handler(
        req: NextApiRequest,
        res: NextApiResponse
      ) {
        if (req.method !== 'POST') {
          return res.status(405).json({ message: 'Method not allowed' })
        }

        try {
          const { userId, email, organizationName } = createOrgSchema.parse(req.body)

          // Start a transaction
          const { data: organization, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
              name: organizationName,
              owner_id: userId
            })
            .select('id')
            .single()

          if (orgError) {
            console.error('Error creating organization:', orgError)
            return res.status(400).json({ message: 'Failed to create organization' })
          }

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: userId,
              org_id: organization.id,
              display_name: email.split('@')[0],
              role: 'admin',
              email
            })

          if (profileError) {
            console.error('Error creating profile:', profileError)
            // Attempt to rollback organization creation
            await supabaseAdmin
              .from('organizations')
              .delete()
              .match({ id: organization.id })
            return res.status(400).json({ message: 'Failed to create profile' })
          }

          return res.status(200).json({ message: 'Organization created successfully' })
        } catch (error) {
          console.error('Error in create-organization:', error)
          return res.status(400).json({
            message: error instanceof Error ? error.message : 'An error occurred'
          })
        }
      }
      ```

[] Create email verification page
   [] Create file: src/pages/auth/verify-email.tsx
      ```typescript
      import { useEffect } from 'react'
      import { useRouter } from 'next/router'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'

      export default function VerifyEmailPage() {
        const router = useRouter()
        const supabase = useSupabaseClient()

        useEffect(() => {
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              if (event === 'SIGNED_IN') {
                router.push('/dashboard')
              }
            }
          )

          return () => {
            authListener.subscription.unsubscribe()
          }
        }, [router, supabase.auth])

        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
              <div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                  Check your email
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                  We've sent you a verification link. Please check your email to
                  continue.
                </p>
              </div>
            </div>
          </div>
        )
      }
      ```

### 3.2 Sign In Implementation
[] Create sign-in page component
   [] Create file: src/pages/auth/signin.tsx
      ```typescript
      import { useState } from 'react'
      import { useRouter } from 'next/router'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { zodResolver } from '@hookform/resolvers/zod'
      import { useForm } from 'react-hook-form'
      import { z } from 'zod'

      const signinSchema = z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required')
      })

      type SigninForm = z.infer<typeof signinSchema>

      export default function SigninPage() {
        const router = useRouter()
        const supabase = useSupabaseClient()
        const [isLoading, setIsLoading] = useState(false)
        const [serverError, setServerError] = useState<string | null>(null)

        const {
          register,
          handleSubmit,
          formState: { errors }
        } = useForm<SigninForm>({
          resolver: zodResolver(signinSchema)
        })

        const onSubmit = async (data: SigninForm) => {
          setIsLoading(true)
          setServerError(null)

          try {
            const { error } = await supabase.auth.signInWithPassword({
              email: data.email,
              password: data.password
            })

            if (error) throw error

            router.push('/dashboard')
          } catch (error) {
            setServerError(
              error instanceof Error ? error.message : 'Failed to sign in'
            )
          } finally {
            setIsLoading(false)
          }
        }

        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
              <div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                  Sign in to your account
                </h2>
              </div>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div className="rounded-md shadow-sm -space-y-px">
                  <div>
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Email address"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="sr-only">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Password"
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                {serverError && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{serverError}</div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      ```

### 3.3 Session Management
[] Create authentication callback handler
   [] Create file: src/pages/auth/callback.tsx
      ```typescript
      import { useEffect } from 'react'
      import { useRouter } from 'next/router'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'

      export default function AuthCallbackPage() {
        const router = useRouter()
        const supabase = useSupabaseClient()

        useEffect(() => {
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              if (event === 'SIGNED_IN') {
                router.push('/dashboard')
              }
            }
          )

          return () => {
            authListener.subscription.unsubscribe()
          }
        }, [router, supabase.auth])

        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Processing authentication...</h2>
              <p className="mt-2 text-gray-600">Please wait while we redirect you.</p>
            </div>
          </div>
        )
      }
      ```

[] Create authentication context provider
   [] Create file: src/contexts/AuthContext.tsx
      ```typescript
      import {
        createContext,
        useContext,
        useEffect,
        useState,
        ReactNode
      } from 'react'
      import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
      import { Database } from '@/types/supabase'

      type Profile = Database['public']['Tables']['profiles']['Row']
      type Organization = Database['public']['Tables']['organizations']['Row']

      interface AuthContextType {
        profile: Profile | null
        organization: Organization | null
        isLoading: boolean
        error: Error | null
      }

      const AuthContext = createContext<AuthContextType>({
        profile: null,
        organization: null,
        isLoading: true,
        error: null
      })

      export function AuthProvider({ children }: { children: ReactNode }) {
        const supabase = useSupabaseClient<Database>()
        const user = useUser()
        const [profile, setProfile] = useState<Profile | null>(null)
        const [organization, setOrganization] = useState<Organization | null>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [error, setError] = useState<Error | null>(null)

        useEffect(() => {
          async function loadUserData() {
            if (!user) {
              setProfile(null)
              setOrganization(null)
              setIsLoading(false)
              return
            }

            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

              if (profileError) throw profileError

              if (profile) {
                setProfile(profile)

                const { data: org, error: orgError } = await supabase
                  .from('organizations')
                  .select('*')
                  .eq('id', profile.org_id)
                  .single()

                if (orgError) throw orgError

                setOrganization(org)
              }
            } catch (error) {
              console.error('Error loading user data:', error)
              setError(error instanceof Error ? error : new Error('Failed to load user data'))
            } finally {
              setIsLoading(false)
            }
          }

          void loadUserData()
        }, [user, supabase])

        return (
          <AuthContext.Provider
            value={{
              profile,
              organization,
              isLoading,
              error
            }}
          >
            {children}
          </AuthContext.Provider>
        )
      }

      export function useAuth() {
        return useContext(AuthContext)
      }
      ```

### 3.4 Protected Routes and Middleware
[] Create authentication middleware
   [] Create file: src/middleware.ts
      ```typescript
      import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
      import { NextResponse } from 'next/server'
      import type { NextRequest } from 'next/server'
      import type { Database } from '@/types/supabase'

      const PUBLIC_ROUTES = [
        '/auth/signin',
        '/auth/signup',
        '/auth/verify-email',
        '/auth/callback'
      ]

      export async function middleware(req: NextRequest) {
        const res = NextResponse.next()
        const supabase = createMiddlewareClient<Database>({ req, res })

        const {
          data: { session },
          error
        } = await supabase.auth.getSession()

        const isPublicRoute = PUBLIC_ROUTES.includes(req.nextUrl.pathname)

        // Handle errors
        if (error) {
          console.error('Auth middleware error:', error)
          if (isPublicRoute) {
            return res
          }
          return NextResponse.redirect(new URL('/auth/signin', req.url))
        }

        // Redirect authenticated users away from auth pages
        if (session && isPublicRoute) {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }

        // Redirect unauthenticated users to signin
        if (!session && !isPublicRoute) {
          return NextResponse.redirect(new URL('/auth/signin', req.url))
        }

        return res
      }

      export const config = {
        matcher: [
          /*
           * Match all request paths except:
           * - _next/static (static files)
           * - _next/image (image optimization files)
           * - favicon.ico (favicon file)
           * - public folder
           */
          '/((?!_next/static|_next/image|favicon.ico|public/).*)'
        ]
      }
      ```

[] Create protected route wrapper component
   [] Create file: src/components/auth/ProtectedRoute.tsx
      ```typescript
      import { useEffect } from 'react'
      import { useRouter } from 'next/router'
      import { useAuth } from '@/contexts/AuthContext'

      interface ProtectedRouteProps {
        children: React.ReactNode
        requiredRole?: 'admin' | 'user'
      }

      export default function ProtectedRoute({
        children,
        requiredRole
      }: ProtectedRouteProps) {
        const router = useRouter()
        const { profile, isLoading, error } = useAuth()

        useEffect(() => {
          if (!isLoading) {
            if (error || !profile) {
              void router.push('/auth/signin')
              return
            }

            if (requiredRole && profile.role !== requiredRole) {
              void router.push('/dashboard')
            }
          }
        }, [isLoading, error, profile, requiredRole, router])

        if (isLoading) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold">Loading...</h2>
                <p className="mt-2 text-gray-600">
                  Please wait while we verify your access.
                </p>
              </div>
            </div>
          )
        }

        if (!profile || (requiredRole && profile.role !== requiredRole)) {
          return null
        }

        return <>{children}</>
      }
      ```

[] Create protected page example
   [] Create file: src/pages/dashboard/index.tsx
      ```typescript
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { useAuth } from '@/contexts/AuthContext'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { useRouter } from 'next/router'

      export default function DashboardPage() {
        const { profile, organization } = useAuth()
        const supabase = useSupabaseClient()
        const router = useRouter()

        const handleSignOut = async () => {
          await supabase.auth.signOut()
          router.push('/auth/signin')
        }

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-16">
                    <div className="flex items-center">
                      <h1 className="text-xl font-semibold">
                        {organization?.name} Dashboard
                      </h1>
                    </div>
                    <div className="flex items-center">
                      <span className="mr-4">
                        Welcome, {profile?.display_name}
                      </span>
                      <button
                        onClick={handleSignOut}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </nav>

              <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Add your dashboard content here */}
                <div className="px-4 py-6 sm:px-0">
                  <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-4">
                    <h2 className="text-2xl font-bold mb-4">
                      Welcome to Your Dashboard
                    </h2>
                    <p className="text-gray-600">
                      This is a protected page that can only be accessed by
                      authenticated users.
                    </p>
                  </div>
                </div>
              </main>
            </div>
          </ProtectedRoute>
        )
      }
      ```

### 3.5 Testing Authentication Flow
[] Create test suite for authentication
   [] Create file: src/__tests__/auth/authentication.test.ts
      ```typescript
      import { test, expect } from '@playwright/test'

      test.describe('Authentication Flow', () => {
        test('should allow user to sign up', async ({ page }) => {
          await page.goto('/auth/signup')
          
          // Fill in the signup form
          await page.fill('input[type="email"]', 'test@example.com')
          await page.fill('input[type="text"]', 'Test Organization')
          await page.fill('input[type="password"]', 'Test123!@#$')
          await page.fill('input[name="confirmPassword"]', 'Test123!@#$')
          
          // Submit the form
          await page.click('button[type="submit"]')
          
          // Should be redirected to verification page
          await expect(page).toHaveURL('/auth/verify-email')
        })

        test('should allow user to sign in', async ({ page }) => {
          await page.goto('/auth/signin')
          
          // Fill in the signin form
          await page.fill('input[type="email"]', 'test@example.com')
          await page.fill('input[type="password"]', 'Test123!@#$')
          
          // Submit the form
          await page.click('button[type="submit"]')
          
          // Should be redirected to dashboard
          await expect(page).toHaveURL('/dashboard')
        })

        test('should protect dashboard route', async ({ page }) => {
          // Try to access dashboard without authentication
          await page.goto('/dashboard')
          
          // Should be redirected to signin
          await expect(page).toHaveURL('/auth/signin')
        })

        test('should allow user to sign out', async ({ page }) => {
          // Sign in first
          await page.goto('/auth/signin')
          await page.fill('input[type="email"]', 'test@example.com')
          await page.fill('input[type="password"]', 'Test123!@#$')
          await page.click('button[type="submit"]')
          
          // Wait for dashboard to load
          await expect(page).toHaveURL('/dashboard')
          
          // Click sign out button
          await page.click('button:has-text("Sign Out")')
          
          // Should be redirected to signin
          await expect(page).toHaveURL('/auth/signin')
          
          // Try to access dashboard again
          await page.goto('/dashboard')
          await expect(page).toHaveURL('/auth/signin')
        })
      })
      ```

### 3.6 Error Handling and Logging
[] Create error handling utilities
   [] Create file: src/utils/error-handling.ts
      ```typescript
      import { AuthError } from '@supabase/supabase-js'

      export class AuthenticationError extends Error {
        constructor(
          message: string,
          public readonly code: string,
          public readonly originalError?: Error
        ) {
          super(message)
          this.name = 'AuthenticationError'
        }
      }

      export function handleAuthError(error: unknown): AuthenticationError {
        console.error('Authentication error:', error)

        if (error instanceof AuthError) {
          switch (error.status) {
            case 400:
              return new AuthenticationError(
                'Invalid credentials. Please check your email and password.',
                'INVALID_CREDENTIALS',
                error
              )
            case 401:
              return new AuthenticationError(
                'Your session has expired. Please sign in again.',
                'SESSION_EXPIRED',
                error
              )
            case 422:
              return new AuthenticationError(
                'Invalid email format.',
                'INVALID_EMAIL',
                error
              )
            default:
              return new AuthenticationError(
                'An unexpected authentication error occurred.',
                'UNKNOWN_ERROR',
                error
              )
          }
        }

        return new AuthenticationError(
          'An unexpected error occurred.',
          'UNKNOWN_ERROR',
          error instanceof Error ? error : undefined
        )
      }
      ```

[] Create logging service
   [] Create file: src/services/logging.ts
      ```typescript
      type LogLevel = 'debug' | 'info' | 'warn' | 'error'

      interface LogEntry {
        timestamp: string
        level: LogLevel
        message: string
        context?: Record<string, unknown>
      }

      class Logger {
        private static instance: Logger
        private logBuffer: LogEntry[] = []
        private readonly bufferSize = 100

        private constructor() {
          // Private constructor to enforce singleton pattern
        }

        public static getInstance(): Logger {
          if (!Logger.instance) {
            Logger.instance = new Logger()
          }
          return Logger.instance
        }

        private formatLogEntry(entry: LogEntry): string {
          const context = entry.context
            ? ` | ${JSON.stringify(entry.context)}`
            : ''
          return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${
            entry.message
          }${context}`
        }

        private addToBuffer(entry: LogEntry) {
          this.logBuffer.push(entry)
          if (this.logBuffer.length > this.bufferSize) {
            this.logBuffer.shift()
          }

          // In development, also log to console
          if (process.env.NODE_ENV === 'development') {
            console[entry.level](this.formatLogEntry(entry))
          }
        }

        private createLogEntry(
          level: LogLevel,
          message: string,
          context?: Record<string, unknown>
        ): LogEntry {
          return {
            timestamp: new Date().toISOString(),
            level,
            message,
            context
          }
        }

        public debug(message: string, context?: Record<string, unknown>) {
          this.addToBuffer(this.createLogEntry('debug', message, context))
        }

        public info(message: string, context?: Record<string, unknown>) {
          this.addToBuffer(this.createLogEntry('info', message, context))
        }

        public warn(message: string, context?: Record<string, unknown>) {
          this.addToBuffer(this.createLogEntry('warn', message, context))
        }

        public error(message: string, context?: Record<string, unknown>) {
          this.addToBuffer(this.createLogEntry('error', message, context))
        }

        public getRecentLogs(): LogEntry[] {
          return [...this.logBuffer]
        }

        public async exportLogs(): Promise<string> {
          return this.logBuffer
            .map((entry) => this.formatLogEntry(entry))
            .join('\n')
        }
      }

      export const logger = Logger.getInstance()
      ```

[] Implement error boundary component
   [] Create file: src/components/error/ErrorBoundary.tsx
      ```typescript
      import React from 'react'
      import { logger } from '@/services/logging'

      interface ErrorBoundaryProps {
        children: React.ReactNode
        fallback?: React.ReactNode
      }

      interface ErrorBoundaryState {
        hasError: boolean
        error?: Error
      }

      export default class ErrorBoundary extends React.Component<
        ErrorBoundaryProps,
        ErrorBoundaryState
      > {
        constructor(props: ErrorBoundaryProps) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError(error: Error) {
          return { hasError: true, error }
        }

        componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
          logger.error('React error boundary caught error:', {
            error: {
              message: error.message,
              stack: error.stack
            },
            componentStack: errorInfo.componentStack
          })
        }

        render() {
          if (this.state.hasError) {
            return (
              this.props.fallback || (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="max-w-md w-full space-y-8">
                    <div>
                      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Something went wrong
                      </h2>
                      <p className="mt-2 text-center text-sm text-gray-600">
                        We're sorry, but something went wrong. Please try refreshing
                        the page or contact support if the problem persists.
                      </p>
                      {process.env.NODE_ENV === 'development' && (
                        <pre className="mt-4 p-4 bg-gray-100 rounded-md overflow-auto text-sm">
                          {this.state.error?.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )
            )
          }

          return this.props.children
        }
      }
      ```

[] Update _app.tsx to include error handling
   [] Create file: src/pages/_app.tsx
      ```typescript
      import { useState } from 'react'
      import type { AppProps } from 'next/app'
      import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
      import { SessionContextProvider } from '@supabase/auth-helpers-react'
      import { AuthProvider } from '@/contexts/AuthContext'
      import ErrorBoundary from '@/components/error/ErrorBoundary'
      import { logger } from '@/services/logging'
      import '@/styles/globals.css'

      export default function App({ Component, pageProps }: AppProps) {
        const [supabase] = useState(() => createBrowserSupabaseClient())

        // Global error handler for unhandled promise rejections
        if (typeof window !== 'undefined') {
          window.addEventListener('unhandledrejection', (event) => {
            logger.error('Unhandled promise rejection:', {
              reason: event.reason
            })
          })

          // Global error handler for uncaught errors
          window.addEventListener('error', (event) => {
            logger.error('Uncaught error:', {
              message: event.message,
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              error: event.error
            })
          })
        }

        return (
          <ErrorBoundary>
            <SessionContextProvider supabaseClient={supabase}>
              <AuthProvider>
                <Component {...pageProps} />
              </AuthProvider>
            </SessionContextProvider>
          </ErrorBoundary>
        )
      }
      ```

### 4. Implementation Checklist Summary
[] Backend Setup
   [] Database schema created and migrations applied
   [] Supabase project configured
   [] Environment variables set up
   [] Authentication endpoints implemented
   [] Error handling and logging configured

[] Frontend Implementation
   [] Authentication pages created (signup, signin, verification)
   [] Protected routes implemented
   [] Error boundaries set up
   [] Context providers configured
   [] Middleware implemented

[] Testing
   [] Authentication flow tests written
   [] Error handling tests implemented
   [] Integration tests completed
   [] Manual testing performed

[] Documentation
   [] API documentation updated
   [] Authentication flow documented
   [] Error codes documented
   [] Testing procedures documented

### 5. Next Steps
[] Review and test all authentication flows
[] Implement password reset functionality
[] Add multi-factor authentication
[] Enhance error reporting
[] Set up monitoring and alerting
[] Conduct security audit
[] Update user documentation

[Continued in next section...] 