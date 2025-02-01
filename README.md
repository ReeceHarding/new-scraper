# AI-Powered Lead Generation Platform

[![GitHub stars](https://img.shields.io/github/stars/reeceharding/new-scraper?style=social)](https://github.com/reeceharding/new-scraper/stargazers)
[![Build Status](https://github.com/reeceharding/new-scraper/workflows/CI/badge.svg)](https://github.com/reeceharding/new-scraper/actions)
[![Coverage Status](https://coveralls.io/repos/github/reeceharding/new-scraper/badge.svg?branch=main)](https://coveralls.io/github/reeceharding/new-scraper?branch=main)
[![License](https://img.shields.io/github/license/reeceharding/new-scraper)](https://github.com/reeceharding/new-scraper/blob/main/LICENSE)

An intelligent web scraping and outreach platform that helps businesses discover and connect with potential clients through AI-powered analysis and personalized communication.

## Features

- 🔍 Intelligent web scraping with configurable rules
- 🧠 AI-powered content analysis and lead qualification
- 📧 Automated email outreach with smart templates
- 📊 Advanced analytics and performance monitoring
- 🔄 Vector search for semantic similarity matching
- 🚦 Rate limiting and quota management
- 🔐 Secure authentication and authorization
- 📝 Comprehensive logging and error tracking

## Tech Stack

- **Frontend**: Next.js, React, Chakra UI
- **Backend**: Node.js, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT-4, Vector Embeddings
- **Search**: Brave Search API
- **Email**: Gmail API Integration
- **Queue**: Redis, BullMQ
- **Monitoring**: Custom monitoring system
- **Testing**: Jest, React Testing Library

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Supabase CLI
- Redis

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/reeceharding/new-scraper.git
   cd new-scraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your environment variables in `.env.local`

### Development

1. Start the development environment:
   ```bash
   npm run docker:up    # Start Docker containers
   npm run dev         # Start Next.js development server
   ```

2. Reset the database (if needed):
   ```bash
   npm run db:reset
   ```

### Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Project Structure

```
.
├── src/
│   ├── services/           # Core business logic
│   │   ├── search/        # Search and query generation
│   │   ├── analyzer/      # Website analysis
│   │   ├── browser/       # Browser automation
│   │   ├── email/         # Email templates
│   │   └── monitoring/    # Performance monitoring
│   ├── pages/             # Next.js pages
│   ├── components/        # React components
│   ├── lib/              # Shared utilities
│   ├── types/            # TypeScript definitions
│   └── config/           # Environment configuration
├── tests/                 # Test files
├── migrations/            # Database migrations
├── scripts/              # Utility scripts
└── Documentation/        # Project documentation
```

## Database Schema

The project uses a comprehensive database schema with tables for:

- Organizations and user profiles
- Knowledge management
- Outreach campaigns and contacts
- Email system management
- Vector search capabilities
- System monitoring and logging
- Browser pool management
- Rate limiting and quotas

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers directly.

## Acknowledgments

- OpenAI for GPT-4 API
- Brave Search for their search API
- Supabase for the database infrastructure
- All contributors and supporters of the project
