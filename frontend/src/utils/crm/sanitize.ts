/**
 * Deeply clones an object and removes any non-serializable properties 
 * to prevent circular structure errors during JSON serialization.
 */
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitives
  if (typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item)) as any;
  }
  
  // Handle Dates
  if (obj instanceof Date) {
    return obj.toISOString() as any;
  }
  
  // Handle plain objects
  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      // Skip functions and window/event objects
      if (typeof value === 'function') continue;
      if (value && typeof value === 'object' && ('window' in value || 'nativeEvent' in value || 'target' in value)) {
        console.warn(`Sanitizer: skipping potentially circular or complex object at key "${key}"`);
        continue;
      }
      
      sanitized[key] = sanitizePayload(value);
    }
  }
  
  return sanitized;
}
