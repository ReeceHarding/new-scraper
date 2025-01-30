#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging setup
LOG_FILE="supabase-setup.log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

echo "🔧 Setting up Supabase $(date)"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

# Install Supabase CLI if not installed
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    brew install supabase/tap/supabase
fi

# Initialize Supabase project
echo "Initializing Supabase project..."
supabase init

# Start Supabase services
echo "Starting Supabase services..."
supabase start

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Verify services are running
echo "Verifying services..."
supabase status

# Create initial schema
echo "Creating initial schema..."
cat > supabase/migrations/00000000000000_init.sql << 'EOF'
-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pgjwt";
create extension if not exists "pg_graphql";
create extension if not exists "pg_stat_statements";
create extension if not exists "vector";

-- Set up auth schema
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;

-- Create users table with vector support
create table public.users (
    id uuid default uuid_generate_v4() primary key,
    email text unique not null,
    encrypted_password text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create profiles table
create table public.profiles (
    id uuid references public.users(id) on delete cascade primary key,
    username text unique,
    full_name text,
    avatar_url text,
    website text,
    updated_at timestamptz default now()
);

-- Create RLS policies
alter table public.users enable row level security;
alter table public.profiles enable row level security;

-- Create policies
create policy "Users can view their own profile"
    on public.profiles for select
    using ( auth.uid() = id );

create policy "Users can update their own profile"
    on public.profiles for update
    using ( auth.uid() = id );

-- Create functions
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
    return new;
end;
$$ language plpgsql security definer;

-- Create triggers
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Set up realtime
alter publication supabase_realtime add table public.profiles;

-- Create indexes
create index users_email_idx on public.users (email);
create index profiles_username_idx on public.profiles (username);

EOF

# Apply migrations
echo "Applying migrations..."
supabase db reset

# Generate types
echo "Generating TypeScript types..."
supabase gen types typescript --local > src/types/supabase.ts

# Display connection info
echo -e "\n${GREEN}✅ Supabase setup completed!${NC}"
echo "Project URL: http://localhost:54321"
echo "Studio URL: http://localhost:54323"
echo "Anon Key: $(supabase status | grep 'anon key:' | awk '{print $3}')"
echo "Service Role Key: $(supabase status | grep 'service_role key:' | awk '{print $3}')"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local..."
    cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(supabase status | grep 'anon key:' | awk '{print $3}')
SUPABASE_SERVICE_ROLE_KEY=$(supabase status | grep 'service_role key:' | awk '{print $3}')
EOF
    echo -e "${GREEN}✅ Created .env.local with Supabase credentials${NC}"
fi

echo -e "\n${GREEN}✅ Setup complete! Run 'supabase status' to verify all services are running.${NC}" 