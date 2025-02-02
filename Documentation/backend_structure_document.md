# Backend Structure Documentation

This document outlines the backend architecture and technical specifications of our AI-powered lead generation platform.

# API Endpoints

## Authentication Endpoints
- POST /api/auth/register
  - Register new user
  - Create organization
  - Send verification email
  - Rate limit: 10/hour per IP

- POST /api/auth/login
  - Email/password authentication
  - Social auth providers
  - Return JWT token
  - Rate limit: 20/minute per IP

- POST /api/auth/verify
  - Verify email token
  - Activate account
  - Rate limit: 10/hour per email

- POST /api/auth/reset-password
  - Request password reset
  - Send reset email
  - Rate limit: 5/hour per email

## Search Endpoints
- POST /api/search/goals
  - Process business goals
  - Generate search strategy
  - Return search parameters
  - Rate limit: 100/day per user

- GET /api/search/results
  - Execute search strategy
  - Filter and rank results
  - Return paginated leads
  - Rate limit: 1000/day per user

- POST /api/search/validate
  - Validate contact info
  - Check email deliverability
  - Rate limit: 5000/day per user

## Lead Management Endpoints
- GET /api/leads
  - List leads with filters
  - Support pagination
  - Include metadata
  - Rate limit: 1000/hour per user

- POST /api/leads
  - Create new lead
  - Validate data
  - Generate score
  - Rate limit: 500/hour per user

- PUT /api/leads/:id
  - Update lead info
  - Track changes
  - Trigger notifications
  - Rate limit: 1000/hour per user

## Campaign Endpoints
- POST /api/campaigns
  - Create campaign
  - Set schedule
  - Configure rules
  - Rate limit: 100/day per user

- POST /api/campaigns/:id/send
  - Send campaign
  - Track delivery
  - Handle bounces
  - Rate limit: 10000/day per user

- GET /api/campaigns/:id/stats
  - Get performance metrics
  - Track engagement
  - Generate reports
  - Rate limit: 1000/hour per user

## Analytics Endpoints
- GET /api/analytics/overview
  - Get summary metrics
  - Calculate KPIs
  - Generate insights
  - Rate limit: 100/hour per user

- GET /api/analytics/reports
  - Generate custom reports
  - Export data
  - Schedule reports
  - Rate limit: 50/day per user

# Database Schema

## User Tables
- auth.users
  - Core auth fields
  - Email verification
  - Password hashing
  - Session management

- public.profiles
  - User details
  - Organization link
  - Preferences
  - UI settings

- public.organizations
  - Company info
  - Subscription
  - Team settings
  - Billing details

## Search Tables
- public.search_goals
  - Business goals
  - Target market
  - Location data
  - Search history

- public.search_results
  - Raw results
  - Ranking data
  - Validation status
  - Contact info

## Lead Tables
- public.leads
  - Contact details
  - Company info
  - Lead score
  - Status tracking

- public.lead_interactions
  - Communication log
  - Follow-ups
  - Notes
  - Timeline

## Campaign Tables
- public.campaigns
  - Campaign settings
  - Schedule
  - Templates
  - Rules

- public.campaign_stats
  - Delivery metrics
  - Engagement data
  - Performance stats
  - A/B results

## Analytics Tables
- public.metrics
  - Raw metrics
  - Aggregations
  - Time series
  - Benchmarks

- public.reports
  - Report configs
  - Export history
  - Custom views
  - Schedules

# External Services

## Brave Search Integration
- API Version: v1.0
- Endpoint: https://api.search.brave.com/
- Rate Limits: 100 requests/minute
- Authentication: API key in header
- Response Format: JSON
- Error Handling: Retry with exponential backoff

## OpenAI Integration
- Model: GPT-4
- Token Limit: 4096
- Temperature: 0.7
- Response Format: JSON
- Streaming: Enabled
- Error Handling: Fallback to GPT-3.5

## Email Service Integration
- Provider: SendGrid/Mailgun
- API Version: Latest
- Authentication: API key
- Features:
  - Bulk sending
  - Template management
  - Bounce handling
  - Analytics tracking

## Redis Integration
- Version: 6.2+
- Persistence: RDB + AOF
- Replication: Master-Replica
- Features:
  - Caching
  - Rate limiting
  - Job queues
  - Pub/Sub

# Caching Strategy

## Cache Layers
- Browser Cache
  - Static assets
  - API responses
  - User preferences
  - TTL: 1 hour

- Redis Cache
  - Session data
  - API results
  - Search cache
  - TTL: 24 hours

- Database Cache
  - Query results
  - Aggregations
  - Materialized views
  - Refresh: Daily

## Cache Invalidation
- Time-based expiration
- Event-based invalidation
- Soft invalidation first
- Hard invalidation fallback
- Cache warming strategy

## Cache Monitoring
- Hit/miss ratios
- Memory usage
- Eviction rates
- Response times
- Cache size metrics

# Error Handling

## Error Types
- Validation Errors
  - Invalid input
  - Missing fields
  - Format errors
  - Business rules

- System Errors
  - Database errors
  - Service failures
  - Network issues
  - Resource limits

- Integration Errors
  - API failures
  - Rate limits
  - Auth errors
  - Timeout issues

## Error Responses
- Standard Format
  ```json
  {
    "error": {
      "code": "string",
      "message": "string",
      "details": "object",
      "requestId": "string"
    }
  }
  ```

- HTTP Status Codes
  - 400: Bad Request
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 429: Too Many Requests
  - 500: Server Error

## Error Logging
- Log Levels
  - DEBUG: Development info
  - INFO: Normal operations
  - WARN: Potential issues
  - ERROR: System problems
  - FATAL: Critical failures

- Log Format
  ```json
  {
    "timestamp": "ISO8601",
    "level": "string",
    "service": "string",
    "message": "string",
    "metadata": "object",
    "stackTrace": "string"
  }
  ```

- Monitoring
  - Real-time alerts
  - Error aggregation
  - Trend analysis
  - Performance impact
