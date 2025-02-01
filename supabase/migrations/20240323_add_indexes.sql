-- Migration: Add Missing Indexes
-- Description: Add indexes to improve query performance for commonly accessed columns
-- Created at: 2024-03-23

--------------------------------------------------------------------------------
-- Add indexes for organizations table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS organizations_owner_id_idx ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS organizations_slug_idx ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS organizations_domain_idx ON public.organizations(domain);

--------------------------------------------------------------------------------
-- Add indexes for profiles table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

--------------------------------------------------------------------------------
-- Add indexes for knowledge_docs table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS knowledge_docs_org_id_idx ON public.knowledge_docs(org_id);
CREATE INDEX IF NOT EXISTS knowledge_docs_doc_type_idx ON public.knowledge_docs(doc_type);
CREATE INDEX IF NOT EXISTS knowledge_docs_tags_idx ON public.knowledge_docs USING GIN(tags);

--------------------------------------------------------------------------------
-- Add indexes for knowledge_doc_chunks table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_doc_id_idx ON public.knowledge_doc_chunks(doc_id);
CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_chunk_index_idx ON public.knowledge_doc_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS knowledge_doc_chunks_embedding_idx ON public.knowledge_doc_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

--------------------------------------------------------------------------------
-- Add indexes for outreach_campaigns table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS outreach_campaigns_org_id_idx ON public.outreach_campaigns(org_id);
CREATE INDEX IF NOT EXISTS outreach_campaigns_status_idx ON public.outreach_campaigns(status);
CREATE INDEX IF NOT EXISTS outreach_campaigns_tags_idx ON public.outreach_campaigns USING GIN(tags);

--------------------------------------------------------------------------------
-- Add indexes for outreach_contacts table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS outreach_contacts_pipeline_stage_idx ON public.outreach_contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS outreach_contacts_email_idx ON public.outreach_contacts(email);

--------------------------------------------------------------------------------
-- Add indexes for job_queue table
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS job_queue_status_idx ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS job_queue_priority_idx ON public.job_queue(priority);
CREATE INDEX IF NOT EXISTS job_queue_scheduled_at_idx ON public.job_queue(scheduled_at); 