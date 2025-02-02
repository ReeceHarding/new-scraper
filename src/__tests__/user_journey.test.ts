import fs from 'fs';
import path from 'path';

describe('User Journey Documentation', () => {
  const docPath = path.join(process.cwd(), 'Documentation');
  
  test('user journey documentation exists and contains required sections', () => {
    // Check if user_journeys.md exists
    const journeyPath = path.join(docPath, 'user_journeys.md');
    expect(fs.existsSync(journeyPath)).toBe(true);
    
    const content = fs.readFileSync(journeyPath, 'utf8');
    
    // Check for required sections
    expect(content).toContain('# New User Onboarding');
    expect(content).toContain('# Business Goal Submission');
    expect(content).toContain('# Search Result Review');
    expect(content).toContain('# Lead Management');
    expect(content).toContain('# Outreach Campaign Creation');
    expect(content).toContain('# Performance Tracking');
    
    // Check for journey details
    expect(content).toMatch(/## User Persona/);
    expect(content).toMatch(/## Journey Steps/);
    expect(content).toMatch(/## Success Criteria/);
    expect(content).toMatch(/## Pain Points/);
    expect(content).toMatch(/## Improvement Opportunities/);
    
    // Check for sequence diagrams
    expect(content).toMatch(/```mermaid/);
    expect(content).toMatch(/sequenceDiagram/);
  });
}); 