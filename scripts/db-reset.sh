#!/bin/bash

# Exit on error
set -e

# Load environment variables
source .env.local

# Store Gmail tokens in temporary variables if the table exists
echo "Checking for Gmail tokens..."
if psql $SUPABASE_DB_URL -c "SELECT to_regclass('public.gmail_tokens');" | grep -q gmail_tokens; then
    echo "Backing up Gmail tokens..."
    GMAIL_TOKENS=$(psql $SUPABASE_DB_URL -t -c "SELECT token FROM gmail_tokens;")
else
    echo "No Gmail tokens table found - skipping backup"
fi

# Reset the database
echo "Resetting database..."
npx supabase db reset

# Restore Gmail tokens if they were backed up
if [ ! -z "$GMAIL_TOKENS" ]; then
    echo "Restoring Gmail tokens..."
    psql $SUPABASE_DB_URL -c "INSERT INTO gmail_tokens (token) VALUES ('$GMAIL_TOKENS');"
else
    echo "No Gmail tokens to restore"
fi

echo "Database reset complete." 