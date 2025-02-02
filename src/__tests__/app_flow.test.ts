import fs from 'fs';
import path from 'path';

describe('App Flow Documentation', () => {
  const docPath = path.join(process.cwd(), 'Documentation');
  
  test('app flow documentation exists and contains required sections', () => {
    // Check if app_flow.md exists
    const appFlowPath = path.join(docPath, 'app_flow.md');
    expect(fs.existsSync(appFlowPath)).toBe(true);
    
    const content = fs.readFileSync(appFlowPath, 'utf8');
    
    // Check for required sections
    expect(content).toContain('# User Authentication Flow');
    expect(content).toContain('# Business Goal Input Process');
    expect(content).toContain('# Search Results Presentation');
    expect(content).toContain('# Lead Management Interface');
    expect(content).toContain('# Email Template Generation');
    expect(content).toContain('# Analytics Dashboard Layout');
    
    // Check for flow diagrams
    expect(content).toMatch(/```mermaid/);
    expect(content).toMatch(/graph TD/);
    
    // Check for specific flow details
    expect(content).toMatch(/## User States/);
    expect(content).toMatch(/## Input Steps/);
    expect(content).toMatch(/## Results Display/);
    expect(content).toMatch(/## Lead Actions/);
    expect(content).toMatch(/## Template Flow/);
    expect(content).toMatch(/## Dashboard Sections/);
  });
}); 