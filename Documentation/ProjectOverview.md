# AI-Powered Lead Generation and Outreach Platform

## Project Vision

An intelligent, automated platform that helps businesses find and connect with potential clients by:
1. Understanding business goals through natural language
2. Generating targeted search strategies
3. Discovering and analyzing potential client websites
4. Extracting contact information
5. Generating personalized outreach templates

## Core Features

### 1. Goal-Based Lead Discovery
- Single-page interface for entering business goals
- Natural language processing of user intent
- Automatic conversion of goals into search strategies
- Example: "I make websites for dentists" → Generates targeted queries for dental practices

### 2. Intelligent Search
- Integration with Brave Search API
- Smart query generation using OpenAI
- Location-aware searching
- Industry-specific term optimization
- Result filtering and ranking

### 3. Website Analysis
- Depth-first crawling (up to 2 levels deep)
- Full XML content storage
- Email extraction and validation
- Business information extraction
- Contact details discovery

### 4. Lead Organization
- Structured data storage in Supabase
- Email categorization and validation
- Website content summarization
- Business metadata extraction
- Relationship tracking

### 5. Outreach Automation
- AI-generated email templates
- Context-aware messaging
- Industry-specific value propositions
- Personalization based on website analysis

## Technical Architecture

### 1. Frontend Layer
```typescript
// Simple, Single-Page Application
- Next.js for server-side rendering
- Chakra UI for clean, modern interface
- React Query for state management
- No authentication required (MVP)
```

### 2. Backend Services
```typescript
// Core Services
- QueryGenerator: OpenAI-powered search query generation
- BraveSearch: Web search integration
- WebsiteAnalyzer: Content analysis and extraction
- EmailGenerator: Personalized outreach templates

// Support Services
- BrowserService: Selenium-based web scraping
- LoggingService: Comprehensive activity tracking
- MonitoringService: Performance and error tracking
```

### 3. Data Model
```sql
-- Core Tables
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prospects_url ON prospects(url);
CREATE INDEX idx_prospects_emails ON prospects USING gin(emails);
CREATE INDEX idx_prospects_target_industry ON prospects(target_industry);
```

## Implementation Flow

### 1. User Input Processing
```typescript
// 1. User enters goal
"I make websites for dentists"

// 2. AI generates search context
{
  targetIndustry: "dental",
  serviceOffering: "web design",
  queries: [
    "dental practice website",
    "dentist office near me",
    "dental clinic website",
    // ... more targeted queries
  ]
}
```

### 2. Search and Discovery
```typescript
// 1. Execute search queries
const results = await Promise.all(
  queries.map(query => braveSearch.search(query))
)

// 2. Filter and normalize results
const uniqueUrls = [...new Set(
  results.flat().map(result => result.url)
)]
```

### 3. Website Analysis
```typescript
// 1. Crawl each website
for (const url of uniqueUrls) {
  // Initialize crawler
  const crawler = new WebsiteCrawler(url, {
    maxDepth: 2,
    respectRobotsTxt: true,
    rateLimit: 1000 // 1 request per second
  })

  // Extract content and structure
  const pages = await crawler.crawl()
  
  // Convert to XML
  const xmlContent = convertToXML(pages)
  
  // Extract emails
  const emails = extractEmails(pages)
  
  // Store results
  await storeResults(url, xmlContent, emails)
}
```

### 4. Content Processing
```typescript
// 1. Generate website summary
const summary = await openai.analyze(websiteContent, {
  focus: [
    "business type",
    "services offered",
    "target market",
    "unique selling points"
  ]
})

// 2. Generate email template
const emailTemplate = await openai.generateEmail({
  businessContext: summary,
  targetIndustry,
  serviceOffering
})
```

### 5. Data Presentation
```typescript
// Frontend display structure
interface ProspectCard {
  title: string
  url: string
  summary: string
  emails: string[]
  suggestedEmail: string
  metadata: {
    industry: string
    services: string[]
    contactInfo: {
      phone?: string
      address?: string
      socialMedia?: string[]
    }
  }
}
```

## Performance Considerations

### 1. Rate Limiting
- Brave Search: 100 requests/minute
- Website Crawling: 1 request/second per domain
- OpenAI: 10,000 tokens/minute

### 2. Resource Management
- Browser pool: 5 concurrent instances
- Request timeouts: 30 seconds
- Memory limits: 512MB per process

### 3. Error Handling
- Automatic retry for failed requests
- Graceful degradation
- Comprehensive error logging

## Monitoring and Logging

### 1. Key Metrics
```typescript
// Performance Metrics
- Search query generation time
- Website crawl duration
- Content analysis time
- Email generation speed

// Business Metrics
- Successful discoveries
- Email extraction rate
- Template generation success
```

### 2. Error Tracking
```typescript
// Critical Errors
- API failures
- Crawling errors
- Content extraction issues
- Database connection problems

// Business Logic Errors
- Invalid email formats
- Poor quality summaries
- Irrelevant search results
```

## Future Enhancements

### 1. Immediate Next Steps
- User authentication and workspaces
- Bulk processing capabilities
- Export functionality
- Email sending integration

### 2. Advanced Features
- Custom crawling rules
- Template customization
- Industry-specific analyzers
- Campaign tracking

### 3. Scalability Improvements
- Distributed crawling
- Caching layer
- Rate limit optimization
- Result persistence

## Development Guidelines

### 1. Code Organization
```typescript
src/
  ├── services/          // Core business logic
  ├── pages/            // Next.js pages
  ├── components/       // React components
  ├── lib/             // Shared utilities
  ├── types/           // TypeScript definitions
  └── config/          // Environment configuration
```

### 2. Testing Strategy
```typescript
// Unit Tests
- Service functions
- Utility helpers
- Component rendering

// Integration Tests
- API endpoints
- Database operations
- Service interactions

// E2E Tests
- User flow scenarios
- Error handling
- Performance benchmarks
```

### 3. Deployment Process
```bash
# Development
npm run dev

# Testing
npm run test
npm run lint

# Production
npm run build
npm start
```

## MVP Success Criteria

### 1. Functional Requirements
- [ ] Goal input and processing
- [ ] Search query generation
- [ ] Website discovery and analysis
- [ ] Email extraction
- [ ] Template generation
- [ ] Results display

### 2. Performance Requirements
- [ ] < 5s for query generation
- [ ] < 30s for website analysis
- [ ] < 1min for full prospect processing
- [ ] 95% uptime

### 3. Quality Requirements
- [ ] Valid email extraction
- [ ] Relevant website summaries
- [ ] Personalized email templates
- [ ] Error-free operation 