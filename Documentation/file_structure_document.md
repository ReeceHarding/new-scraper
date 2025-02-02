# File Structure Documentation

This document outlines the organization and structure of our AI-powered lead generation platform's codebase.

# Frontend Structure

## Component Organization
```text
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── ResetPassword.tsx
│   │   └── SocialAuth.tsx
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── Loading.tsx
│   ├── dashboard/
│   │   ├── Overview.tsx
│   │   ├── Analytics.tsx
│   │   ├── Charts.tsx
│   │   └── Metrics.tsx
│   ├── leads/
│   │   ├── LeadList.tsx
│   │   ├── LeadCard.tsx
│   │   ├── LeadForm.tsx
│   │   └── LeadFilters.tsx
│   ├── search/
│   │   ├── GoalInput.tsx
│   │   ├── SearchResults.tsx
│   │   ├── ResultCard.tsx
│   │   └── Filters.tsx
│   └── campaigns/
│       ├── CampaignList.tsx
│       ├── CampaignForm.tsx
│       ├── TemplateEditor.tsx
│       └── Scheduler.tsx
```

## Component Guidelines
- One component per file
- PascalCase for component names
- Colocate related components
- Shared components in common/
- Feature-based organization

# API Integration

## API Client Structure
```text
src/
├── api/
│   ├── client.ts
│   ├── config.ts
│   ├── types.ts
│   ├── auth/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── endpoints.ts
│   ├── search/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── endpoints.ts
│   ├── leads/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── endpoints.ts
│   └── campaigns/
│       ├── index.ts
│       ├── types.ts
│       └── endpoints.ts
```

## API Guidelines
- Axios for HTTP requests
- TypeScript interfaces
- Error handling middleware
- Request/response interceptors
- Rate limiting handling

# State Management

## State Architecture
```text
src/
├── store/
│   ├── index.ts
│   ├── types.ts
│   ├── auth/
│   │   ├── slice.ts
│   │   ├── selectors.ts
│   │   └── thunks.ts
│   ├── search/
│   │   ├── slice.ts
│   │   ├── selectors.ts
│   │   └── thunks.ts
│   ├── leads/
│   │   ├── slice.ts
│   │   ├── selectors.ts
│   │   └── thunks.ts
│   └── campaigns/
│       ├── slice.ts
│       ├── selectors.ts
│       └── thunks.ts
```

## State Guidelines
- Redux Toolkit
- Feature-based slices
- Normalized state shape
- Memoized selectors
- Async thunks

# Testing Organization

## Test File Layout
```text
src/
├── __tests__/
│   ├── components/
│   │   ├── auth/
│   │   ├── common/
│   │   ├── dashboard/
│   │   ├── leads/
│   │   └── search/
│   ├── api/
│   │   ├── auth/
│   │   ├── search/
│   │   └── leads/
│   ├── store/
│   │   ├── auth/
│   │   ├── search/
│   │   └── leads/
│   └── utils/
│       ├── validation/
│       ├── formatting/
│       └── helpers/
```

## Testing Guidelines
- Jest for unit tests
- React Testing Library
- Cypress for E2E
- Test file naming: *.test.ts
- Coverage thresholds

# Documentation Structure

## Documentation Layout
```text
docs/
├── getting-started/
│   ├── installation.md
│   ├── configuration.md
│   └── development.md
├── architecture/
│   ├── overview.md
│   ├── frontend.md
│   └── backend.md
├── features/
│   ├── auth.md
│   ├── search.md
│   └── leads.md
├── api/
│   ├── auth.md
│   ├── search.md
│   └── leads.md
└── deployment/
    ├── staging.md
    ├── production.md
    └── monitoring.md
```

## Documentation Guidelines
- Markdown format
- Clear hierarchy
- Code examples
- API documentation
- Diagrams with Mermaid

# Project Root Structure

```text
/
├── src/
│   ├── components/
│   ├── api/
│   ├── store/
│   ├── utils/
│   └── __tests__/
├── public/
│   ├── assets/
│   └── static/
├── docs/
│   ├── getting-started/
│   └── api/
├── scripts/
│   ├── build.js
│   └── deploy.js
├── config/
│   ├── webpack.config.js
│   └── jest.config.js
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

# Development Guidelines

## File Naming
- Components: PascalCase.tsx
- Utilities: camelCase.ts
- Tests: *.test.ts
- Types: *.types.ts
- Constants: UPPERCASE.ts

## Import Organization
1. External libraries
2. Internal modules
3. Components
4. Styles
5. Types
6. Constants

## Code Organization
- Feature-first structure
- Colocated tests
- Shared utilities
- Clear separation of concerns
- Consistent naming conventions

## Version Control
- Feature branches
- Semantic commits
- Pull request templates
- Code review guidelines
- Branch protection rules

# Build and Deploy Structure

## Build Output
```text
dist/
├── static/
│   ├── js/
│   ├── css/
│   └── media/
├── assets/
│   ├── images/
│   └── fonts/
└── index.html
```

## Deployment Configuration
```text
deploy/
├── staging/
│   ├── docker-compose.yml
│   └── nginx.conf
├── production/
│   ├── docker-compose.yml
│   └── nginx.conf
└── scripts/
    ├── deploy-staging.sh
    └── deploy-prod.sh
```

# Environment Configuration

## Environment Files
```text
/
├── .env.example
├── .env.local
├── .env.development
├── .env.test
└── .env.production
```

## Configuration Guidelines
- Use environment variables
- Secure sensitive data
- Environment-specific configs
- Documentation of variables
- Validation on startup