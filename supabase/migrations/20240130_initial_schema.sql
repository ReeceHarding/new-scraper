-- Migration: Initial Schema
-- Description: Core database schema for the web scraping and outreach platform
-- Created at: 2024-01-30

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pgjwt";
create extension if not exists "pg_graphql";
create extension if not exists "pg_stat_statements";
create extension if not exists "vector";

-- Create organizations table
create table public.organizations (
    id uuid default uuid_generate_v4() primary key,
    name text not null check (char_length(name) >= 3),
    owner_id uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create profiles table
create table public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    organization_id uuid references public.organizations(id),
    full_name text,
    avatar_url text,
    role text not null default 'user',
    email_verified boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create email_templates table
create table public.email_templates (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations(id),
    name text not null,
    subject text not null,
    body text not null,
    variables jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create email_campaigns table
create table public.email_campaigns (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations(id),
    name text not null,
    template_id uuid references public.email_templates(id),
    status text not null default 'draft',
    schedule_type text not null default 'immediate',
    schedule_time timestamptz,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create contacts table
create table public.contacts (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations(id),
    email text not null,
    full_name text,
    company text,
    position text,
    linkedin_url text,
    custom_fields jsonb,
    tags text[],
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(organization_id, email)
);

-- Create campaign_contacts table
create table public.campaign_contacts (
    id uuid default uuid_generate_v4() primary key,
    campaign_id uuid references public.email_campaigns(id),
    contact_id uuid references public.contacts(id),
    status text not null default 'pending',
    scheduled_time timestamptz,
    sent_at timestamptz,
    opened_at timestamptz,
    replied_at timestamptz,
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create scraping_tasks table
create table public.scraping_tasks (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations(id),
    name text not null,
    url text not null,
    status text not null default 'pending',
    config jsonb not null default '{}',
    schedule_type text,
    schedule_config jsonb,
    last_run_at timestamptz,
    next_run_at timestamptz,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create scraping_results table
create table public.scraping_results (
    id uuid default uuid_generate_v4() primary key,
    task_id uuid references public.scraping_tasks(id),
    status text not null,
    data jsonb not null default '{}',
    error text,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now()
);

-- Create email_tracking table
create table public.email_tracking (
    id uuid default uuid_generate_v4() primary key,
    campaign_contact_id uuid references public.campaign_contacts(id),
    event_type text not null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

-- Create audit_logs table
create table public.audit_logs (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations(id),
    user_id uuid references auth.users(id),
    action text not null,
    entity_type text not null,
    entity_id uuid not null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

-- Create indexes
create index idx_profiles_organization on public.profiles(organization_id);
create index idx_email_templates_organization on public.email_templates(organization_id);
create index idx_email_campaigns_organization on public.email_campaigns(organization_id);
create index idx_contacts_organization on public.contacts(organization_id);
create index idx_contacts_email on public.contacts(email);
create index idx_campaign_contacts_campaign on public.campaign_contacts(campaign_id);
create index idx_campaign_contacts_contact on public.campaign_contacts(contact_id);
create index idx_scraping_tasks_organization on public.scraping_tasks(organization_id);
create index idx_scraping_results_task on public.scraping_results(task_id);
create index idx_email_tracking_campaign_contact on public.email_tracking(campaign_contact_id);
create index idx_audit_logs_organization on public.audit_logs(organization_id);
create index idx_audit_logs_user on public.audit_logs(user_id);

-- Enable Row Level Security (RLS)
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.contacts enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.scraping_tasks enable row level security;
alter table public.scraping_results enable row level security;
alter table public.email_tracking enable row level security;
alter table public.audit_logs enable row level security;

-- Create RLS Policies
create policy "Users can view their organization"
    on public.organizations for select
    using (auth.uid() in (
        select user_id from public.profiles
        where organization_id = organizations.id
    ));

create policy "Organization members can view profiles"
    on public.profiles for select
    using (auth.uid() in (
        select user_id from public.profiles
        where organization_id = profiles.organization_id
    ));

-- Add triggers for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger handle_organizations_updated_at
    before update on public.organizations
    for each row execute procedure public.handle_updated_at();

create trigger handle_profiles_updated_at
    before update on public.profiles
    for each row execute procedure public.handle_updated_at();

create trigger handle_email_templates_updated_at
    before update on public.email_templates
    for each row execute procedure public.handle_updated_at();

create trigger handle_email_campaigns_updated_at
    before update on public.email_campaigns
    for each row execute procedure public.handle_updated_at();

create trigger handle_contacts_updated_at
    before update on public.contacts
    for each row execute procedure public.handle_updated_at();

create trigger handle_campaign_contacts_updated_at
    before update on public.campaign_contacts
    for each row execute procedure public.handle_updated_at();

create trigger handle_scraping_tasks_updated_at
    before update on public.scraping_tasks
    for each row execute procedure public.handle_updated_at(); 