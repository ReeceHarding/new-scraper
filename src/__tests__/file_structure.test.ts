import fs from 'fs';
import path from 'path';

describe('File Structure Documentation', () => {
  const docPath = path.join(process.cwd(), 'Documentation');
  
  test('file structure documentation exists and contains required sections', () => {
    // Check if file_structure_document.md exists
    const structurePath = path.join(docPath, 'file_structure_document.md');
    expect(fs.existsSync(structurePath)).toBe(true);
    
    const content = fs.readFileSync(structurePath, 'utf8');
    
    // Check for required sections
    expect(content).toContain('# Frontend Structure');
    expect(content).toContain('# API Integration');
    expect(content).toContain('# State Management');
    expect(content).toContain('# Testing Organization');
    expect(content).toContain('# Documentation Structure');
    
    // Check for specific details
    expect(content).toMatch(/## Component Organization/);
    expect(content).toMatch(/## API Client Structure/);
    expect(content).toMatch(/## State Architecture/);
    expect(content).toMatch(/## Test File Layout/);
    expect(content).toMatch(/## Documentation Layout/);
    
    // Check for directory trees
    expect(content).toMatch(/```text/);
    expect(content).toMatch(/src\//);
    expect(content).toMatch(/components\//);
    expect(content).toMatch(/api\//);
    expect(content).toMatch(/store\//);
    expect(content).toMatch(/__tests__\//);
    expect(content).toMatch(/docs\//);
  });
}); 