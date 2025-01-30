#!/bin/bash

# Exit on error
set -e

# Load environment variables
source .env.local

# Store Gmail tokens in temporary variables
echo "Backing up Gmail tokens..."
GMAIL_TOKENS=$(psql $SUPABASE_DB_URL -t -c "SELECT token FROM gmail_tokens;")

# Reset the database
echo "Resetting database..."
supabase db reset

# Restore Gmail tokens
echo "Restoring Gmail tokens..."
if [ ! -z "$GMAIL_TOKENS" ]; then
    psql $SUPABASE_DB_URL -c "INSERT INTO gmail_tokens (token) VALUES ('$GMAIL_TOKENS');"
fi

echo "Database reset complete with Gmail tokens preserved." 