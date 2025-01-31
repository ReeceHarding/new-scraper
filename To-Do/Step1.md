# Step 1: Project Infrastructure and Setup

## Overview
Set up a robust development environment for an AI-powered lead generation platform that helps businesses discover and connect with potential clients through intelligent web scraping and personalized outreach.

## 1. Project Structure

### 1.1 Directory Organization
```bash
.
├── src/
│   ├── services/           # Core business logic
│   │   ├── search/        # Search and query generation
│   │   ├── analyzer/      # Website analysis and content extraction
│   │   ├── browser/       # Browser automation
│   │   ├── email/         # Email template generation
│   │   └── monitoring/    # Performance monitoring
│   ├── pages/             # Next.js pages
│   │   ├── api/          # API routes
│   │   └── index.tsx     # Main prospecting interface
│   ├── components/        # React components
│   ├── lib/              # Shared utilities
│   ├── types/            # TypeScript definitions
│   └── config/           # Environment configuration
├── tests/                 # Test files
├── migrations/            # Database migrations
├── scripts/              # Utility scripts
└── Documentation/        # Project documentation
```

### 1.2 Core Configuration Files
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "es2018",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

## 2. Development Environment

### 2.1 Dependencies
```json
// package.json
{
  "dependencies": {
    "@chakra-ui/react": "^2.8.0",
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "next": "^14.0.0",
    "openai": "^4.0.0",
    "react": "^18.2.0",
    "selenium-webdriver": "^4.16.0",
    "winston": "^3.11.0",
    "xml-js": "^1.6.11"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/selenium-webdriver": "^4.1.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

### 2.2 Environment Configuration
```env
# .env.local
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL_VERSION=gpt-4
OPENAI_MAX_TOKENS=4096

# Brave Search Configuration
BRAVE_API_KEY=your_brave_api_key
BRAVE_SEARCH_RATE_LIMIT=100

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Browser Service Configuration
BROWSER_POOL_SIZE=5
BROWSER_PAGE_TIMEOUT=30000
BROWSER_REQUEST_TIMEOUT=10000
```

## 3. Infrastructure Setup

### 3.1 Database Schema
```sql
-- migrations/[timestamp]_initial_schema.sql

-- Prospects table for storing discovered businesses
CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  content_xml TEXT,
  emails TEXT[],
  suggested_email TEXT,
  metadata JSONB,
  search_query TEXT,
  target_industry TEXT,
  service_offering TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT prospects_url_unique UNIQUE (url)
);

-- Create necessary indexes
CREATE INDEX idx_prospects_url ON prospects(url);
CREATE INDEX idx_prospects_emails ON prospects USING gin(emails);
CREATE INDEX idx_prospects_target_industry ON prospects(target_industry);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();
```

### 3.2 Error Handling
```typescript
// src/lib/errors/index.ts
export class SearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SearchError'
  }
}

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalysisError'
  }
}

export class BrowserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BrowserError'
  }
}
```

### 3.3 Logging Configuration
```typescript
// src/lib/logging/index.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
})
```

## 4. Development Workflow

### 4.1 Git Configuration
```bash
# .gitignore
node_modules/
.env*
.next/
dist/
logs/
*.log
.DS_Store
coverage/
```

### 4.2 ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### 4.3 Testing Setup
```typescript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: [
    '**/__tests__/**/*.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)'
  ]
}
```

## 5. Security Measures

### 5.1 Environment Variable Validation
```typescript
// src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_VERSION: z.string().min(1),
  BRAVE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
})

export const validateEnv = () => {
  try {
    envSchema.parse(process.env)
  } catch (error) {
    console.error('Invalid environment variables:', error.errors)
    process.exit(1)
  }
}
```

### 5.2 Rate Limiting
```typescript
// src/lib/rateLimit.ts
export class RateLimiter {
  private timestamps: number[] = []
  private readonly limit: number
  private readonly interval: number

  constructor(limit: number, interval: number) {
    this.limit = limit
    this.interval = interval
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now()
    this.timestamps = this.timestamps.filter(
      time => now - time < this.interval
    )

    if (this.timestamps.length >= this.limit) {
      const oldestTimestamp = this.timestamps[0]
      const waitTime = this.interval - (now - oldestTimestamp)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.timestamps.push(now)
  }
}
```

## 6. Monitoring Setup

### 6.1 Performance Monitoring
```typescript
// src/lib/monitoring/performance.ts
import { logger } from '../logging'

export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    logger.info('Performance measurement:', {
      operation,
      duration: `${duration}ms`,
      success: true
    })
    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error('Performance measurement:', {
      operation,
      duration: `${duration}ms`,
      success: false,
      error
    })
    throw error
  }
}
```

### 6.2 Health Checks
```typescript
// src/pages/api/health.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check database connection
    const { data, error } = await supabase
      .from('prospects')
      .select('count(*)')
    if (error) throw error

    res.status(200).json({ 
      status: 'healthy',
      database: 'connected'
    })
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message
    })
  }
}
```

## 7. Documentation

### 7.1 API Documentation
Create comprehensive API documentation using TypeDoc or similar tools.

### 7.2 Setup Instructions
Provide clear setup instructions in the README.md file.

### 7.3 Contributing Guidelines
Create CONTRIBUTING.md with coding standards and PR process.

## 8. Deployment Preparation

### 8.1 Build Configuration
```json
// next.config.js
module.exports = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
  }
}
```

### 8.2 Production Checks
Create a pre-deployment checklist including:
- Environment variable validation
- Database migration verification
- Security headers configuration
- Performance optimization