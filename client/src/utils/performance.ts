// Performance monitoring utilities
import { config } from './config';

// Measure and log performance metrics
export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const end = performance.now();
      const duration = end - start;
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      
      // Log slow operations
      if (duration > 100) {
        console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    });
  } else {
    const end = performance.now();
    const duration = end - start;
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    
    if (duration > 100) {
      console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

// Debounce function for performance optimization
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for performance optimization
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Intersection Observer for lazy loading
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  });
}

// Resource hints for better performance
export function addResourceHints() {
  if (typeof window === 'undefined') return;
  
  // Preconnect to API server
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = config.backendUrl;
  document.head.appendChild(preconnect);
  
  // DNS prefetch
  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = config.backendUrl;
  document.head.appendChild(dnsPrefetch);
}

// Memory usage monitoring
export function getMemoryUsage(): { used: number; total: number; percentage: number } | null {
  if (typeof window === 'undefined' || !('memory' in performance)) {
    return null;
  }
  
  // Type assertion for performance memory
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  if (!memory) return null;
  
  return {
    used: Math.round(memory.usedJSHeapSize / 1048576), // MB
    total: Math.round(memory.totalJSHeapSize / 1048576), // MB
    percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100),
  };
}

// Monitor long tasks
export function monitorLongTasks() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }
  
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) {
        console.warn(`🚨 Long task detected: ${entry.duration.toFixed(2)}ms`, entry);
      }
    }
  });
  
  observer.observe({ entryTypes: ['longtask'] });
}

// Optimize images
export function optimizeImageLoading() {
  if (typeof window === 'undefined') return;
  
  // Add loading="lazy" to images that don't have it
  const images = document.querySelectorAll('img:not([loading])');
  images.forEach((img) => {
    (img as HTMLImageElement).loading = 'lazy';
  });
}

// Initialize performance monitoring
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return;
  
  // Monitor long tasks
  monitorLongTasks();
  
  // Add resource hints
  addResourceHints();
  
  // Optimize image loading
  optimizeImageLoading();
  
  // Log memory usage periodically in development
  if (config.features.debugLogging) {
    setInterval(() => {
      const memory = getMemoryUsage();
      if (memory && memory.percentage > 80) {
        console.warn(`⚠️ High memory usage: ${memory.percentage}% (${memory.used}MB / ${memory.total}MB)`);
      }
    }, 30000); // Every 30 seconds
  }
} 