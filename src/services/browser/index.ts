import { BrowserError } from '@/lib/errors';

export interface BrowserInstance {
  id: string;
  status: 'idle' | 'busy' | 'error';
  lastActive: Date;
  errorCount: number;
  currentMemoryMb: number;
  currentCpuPercent: number;
  metadata: Record<string, any>;
}

export interface BrowserSession {
  id: string;
  instanceId: string;
  url: string;
  status: 'active' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  metadata: Record<string, any>;
}

export interface BrowserService {
  createInstance(): Promise<BrowserInstance>;
  getAvailableInstance(): Promise<BrowserInstance>;
  startSession(url: string): Promise<BrowserSession>;
  endSession(sessionId: string, status: 'completed' | 'error', error?: string): Promise<void>;
  getPageContent(url: string): Promise<{
    html: string;
    text: string;
    title: string;
    description: string;
    emails: string[];
    links: string[];
  }>;
}

export class BrowserServiceError extends BrowserError {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserServiceError';
  }
} 