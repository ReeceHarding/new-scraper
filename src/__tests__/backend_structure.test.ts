import fs from 'fs';
import path from 'path';

describe('Backend Structure Documentation', () => {
  const docPath = path.join(process.cwd(), 'Documentation');
  
  test('backend structure documentation exists and contains required sections', () => {
    // Check if backend_structure_document.md exists
    const backendPath = path.join(docPath, 'backend_structure_document.md');
    expect(fs.existsSync(backendPath)).toBe(true);
    
    const content = fs.readFileSync(backendPath, 'utf8');
    
    // Check for required sections
    expect(content).toContain('# API Endpoints');
    expect(content).toContain('# Database Schema');
    expect(content).toContain('# External Services');
    expect(content).toContain('# Caching Strategy');
    expect(content).toContain('# Error Handling');
    
    // Check for specific details
    expect(content).toMatch(/## Authentication Endpoints/);
    expect(content).toMatch(/## Search Endpoints/);
    expect(content).toMatch(/## Lead Management Endpoints/);
    expect(content).toMatch(/## Campaign Endpoints/);
    expect(content).toMatch(/## Analytics Endpoints/);
    
    // Check for schema details
    expect(content).toMatch(/## User Tables/);
    expect(content).toMatch(/## Search Tables/);
    expect(content).toMatch(/## Lead Tables/);
    expect(content).toMatch(/## Campaign Tables/);
    expect(content).toMatch(/## Analytics Tables/);
    
    // Check for service integrations
    expect(content).toMatch(/## Brave Search Integration/);
    expect(content).toMatch(/## OpenAI Integration/);
    expect(content).toMatch(/## Email Service Integration/);
    expect(content).toMatch(/## Redis Integration/);
    
    // Check for caching details
    expect(content).toMatch(/## Cache Layers/);
    expect(content).toMatch(/## Cache Invalidation/);
    expect(content).toMatch(/## Cache Monitoring/);
    
    // Check for error handling
    expect(content).toMatch(/## Error Types/);
    expect(content).toMatch(/## Error Responses/);
    expect(content).toMatch(/## Error Logging/);
  });
}); 