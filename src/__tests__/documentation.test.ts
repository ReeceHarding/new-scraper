import fs from 'fs';
import path from 'path';

describe('Documentation Requirements', () => {
  const docPath = path.join(process.cwd(), 'Documentation');
  
  test('key features documentation exists and contains required sections', () => {
    // Check if key_features.md exists
    const keyFeaturesPath = path.join(docPath, 'key_features.md');
    expect(fs.existsSync(keyFeaturesPath)).toBe(true);
    
    const content = fs.readFileSync(keyFeaturesPath, 'utf8');
    
    // Check for required sections
    expect(content).toContain('# Single-page Interface');
    expect(content).toContain('# Business Goal Input');
    expect(content).toContain('# Search Strategy Generation');
    expect(content).toContain('# Website Analysis Module');
    expect(content).toContain('# Lead Organization');
    expect(content).toContain('# Outreach Automation');
    expect(content).toContain('# Analytics Dashboard');
    
    // Check for specific requirements under each section
    expect(content).toMatch(/## Interface Requirements/);
    expect(content).toMatch(/## Input Validation/);
    expect(content).toMatch(/## Search Parameters/);
    expect(content).toMatch(/## Crawling Specifications/);
    expect(content).toMatch(/## Data Structure/);
    expect(content).toMatch(/## Automation Rules/);
    expect(content).toMatch(/## Metrics and KPIs/);
  }, 30000);
}); 