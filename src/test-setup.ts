/**
 * Test setup file for Caddy Dashboard
 * This file is imported by Angular during test execution
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Import zone.js/dist/zone-testing for Angular testing support
import 'zone.js/dist/zone-testing';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting
} from '@angular/platform-browser/testing';

// Initialize the Angular testing environment
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting()
);

// Configure global test settings
beforeEach(() => {
  // Reset any global state before each test
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
});

// Global test utilities
(window as any).testUtils = {
  // Helper for creating mock observables
  mockObservable: (value: any) => {
    return {
      subscribe: (callback: (value: any) => void) => {
        setTimeout(() => callback(value), 0);
        return { unsubscribe: () => {} };
      }
    };
  },

  // Helper for simulating delays
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper for creating DOM events
  createEvent: (type: string, options: any = {}) => {
    const event = new Event(type, { bubbles: true, cancelable: true, ...options });
    Object.assign(event, options);
    return event;
  }
};

// Configure console to reduce noise during tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = (...args: any[]) => {
  // Filter out known harmless warnings
  const message = args[0]?.toString() || '';
  
  if (
    message.includes('Angular is running in development mode') ||
    message.includes('Monaco Editor') ||
    message.includes('DaisyUI')
  ) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  // Filter out known harmless errors
  const message = args[0]?.toString() || '';
  
  if (
    message.includes('Monaco Editor failed to load') ||
    message.includes('ResizeObserver loop limit exceeded')
  ) {
    return;
  }
  
  originalConsoleError.apply(console, args);
};

// Global test cleanup
afterEach(() => {
  // Clean up any lingering DOM elements
  document.body.innerHTML = '';
  
  // Clear any timeouts/intervals
  const highestId = setTimeout(() => {}, 0);
  for (let i = 0; i < highestId; i++) {
    clearTimeout(i);
    clearInterval(i);
  }
});

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  })
});

// Mock IntersectionObserver
(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() { return null; }
  disconnect() { return null; }
  unobserve() { return null; }
};

// Mock ResizeObserver
(globalThis as any).ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {}
  observe(target: Element): void {}
  unobserve(target: Element): void {}
  disconnect(): void {}
};

// Mock performance.memory for performance tests
if (!(performance as any).memory) {
  (performance as any).memory = {
    usedJSHeapSize: 16777216, // 16MB
    totalJSHeapSize: 33554432, // 32MB
    jsHeapSizeLimit: 2147483648 // 2GB
  };
}

// Enhanced error handling for tests
window.addEventListener('error', (event) => {
  console.error('Unhandled error in test:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in test:', event.reason);
});

// Export test utilities for use in test files
export const testUtils = (window as any).testUtils;