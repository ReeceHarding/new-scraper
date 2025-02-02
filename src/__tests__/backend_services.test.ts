import fs from 'fs';
import path from 'path';

describe('Backend Services Documentation', () => {
  const docPath = path.join(process.cwd(), 'Documentation');
  
  test('backend services documentation exists and contains required sections', () => {
    // Check if backend_services.md exists
    const servicesPath = path.join(docPath, 'backend_services.md');
    expect(fs.existsSync(servicesPath)).toBe(true);
    
    const content = fs.readFileSync(servicesPath, 'utf8');
    
    // Check for required sections
    expect(content).toContain('# Authentication Service');
    expect(content).toContain('# Natural Language Processing Service');
    expect(content).toContain('# Search Strategy Service');
    expect(content).toContain('# Website Crawler Service');
    expect(content).toContain('# Email Extraction Service');
    expect(content).toContain('# Lead Management Service');
    
    // Check for service details
    expect(content).toMatch(/## Service Architecture/);
    expect(content).toMatch(/## Dependencies/);
    expect(content).toMatch(/## API Contract/);
    expect(content).toMatch(/## Data Flow/);
    expect(content).toMatch(/## Error Handling/);
    expect(content).toMatch(/## Performance Requirements/);
    
    // Check for sequence diagrams
    expect(content).toMatch(/```mermaid/);
    expect(content).toMatch(/sequenceDiagram/);
  });
}); 