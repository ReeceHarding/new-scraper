# New Scrapin' ��

[![GitHub stars](https://img.shields.io/github/stars/reeceharding/new-scraper?style=social)](https://github.com/reeceharding/new-scraper/stargazers)
[![Build Status](https://github.com/reeceharding/new-scraper/workflows/CI/badge.svg)](https://github.com/reeceharding/new-scraper/actions)
[![Coverage Status](https://coveralls.io/repos/github/reeceharding/new-scraper/badge.svg?branch=main)](https://coveralls.io/github/reeceharding/new-scraper?branch=main)
[![License](https://img.shields.io/github/license/reeceharding/new-scraper)](https://github.com/reeceharding/new-scraper/blob/main/LICENSE)

A powerful web scraping and outreach automation platform built with modern technologies and best practices.

## 🎯 Features

- 🤖 Intelligent web scraping with browser automation
- 📧 Smart email outreach with Gmail integration
- 🧠 AI-powered content generation and personalization
- 📊 Vector-based search and similarity matching
- 🔄 Automated campaign management
- 📈 Comprehensive analytics and tracking
- 🔒 Enterprise-grade security and rate limiting

## 🛠️ Technology Stack

- **Frontend**:
  - [Next.js](https://nextjs.org/) (v14) - React framework for production
  - [Tailwind CSS](https://tailwindcss.com/) (v3.3) - Utility-first CSS framework
  - [React Query](https://tanstack.com/query/latest) - Data synchronization
  - [TypeScript](https://www.typescriptlang.org/) - Type safety and developer experience

- **Backend**:
  - [Supabase](https://supabase.com/) - PostgreSQL database and authentication
  - [Redis](https://redis.io/) - Job queue and caching
  - [OpenAI](https://openai.com/) - AI content generation
  - [Pinecone](https://www.pinecone.io/) - Vector similarity search
  - [Gmail API](https://developers.google.com/gmail/api) - Email automation

- **Infrastructure**:
  - [Docker](https://www.docker.com/) - Containerization
  - [GitHub Actions](https://github.com/features/actions) - CI/CD
  - [Jest](https://jestjs.io/) - Testing framework
  - [Winston](https://github.com/winstonjs/winston) - Logging

## 📋 Prerequisites

- Node.js >= 18.17.0
- Docker >= 24.0.0
- npm >= 9.6.7
- Git >= 2.40.0

### OS Compatibility

- ✅ macOS (Intel/Apple Silicon)
- ✅ Linux (x86_64/ARM64)
- ✅ Windows (via WSL2)

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/reeceharding/new-scraper.git
   cd new-scraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. Start development services:
   ```bash
   docker-compose up -d
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🔧 Configuration

See [.env.example](.env.example) for all available configuration options. Required variables:

- **Supabase**: Database and authentication
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

- **Redis**: Job queue and caching
  - `REDIS_HOST`
  - `REDIS_PORT`

- **OpenAI**: AI features
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL_VERSION`

- **Pinecone**: Vector search
  - `PINECONE_API_KEY`
  - `PINECONE_ENVIRONMENT`
  - `PINECONE_INDEX_NAME`

- **Gmail**: Email automation
  - `NEXT_PUBLIC_GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
  - `NEXT_PUBLIC_GMAIL_REDIRECT_URI`

## 💻 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run db:reset` - Reset database (preserves Gmail tokens)

### Testing

Run the test suite:
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## 🚢 Deployment

### Prerequisites

- Supabase project
- Redis instance
- OpenAI API access
- Pinecone index
- Gmail API credentials

### Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm run start
   ```

### Production Considerations

- Enable rate limiting
- Configure monitoring
- Set up backup strategy
- Enable error tracking
- Monitor resource usage

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

### Branch Naming

- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring
- `test/*` - Test improvements

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier
- Write comprehensive tests
- Add JSDoc comments
- Follow conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI Documentation](https://platform.openai.com/docs)
- [Pinecone Documentation](https://docs.pinecone.io)
- [Gmail API Documentation](https://developers.google.com/gmail/api/guides)
