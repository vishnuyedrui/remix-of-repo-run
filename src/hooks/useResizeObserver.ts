import { useEffect, useRef, useCallback } from "react";

type ResizeCallback = (entry: ResizeObserverEntry) => void;

// Shared ResizeObserver instance for better performance
let sharedObserver: ResizeObserver | null = null;
const callbacks = new Map<Element, ResizeCallback>();

function getSharedObserver(): ResizeObserver {
  if (!sharedObserver) {
    sharedObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const callback = callbacks.get(entry.target);
        if (callback) {
          callback(entry);
        }
      }
    });
  }
  return sharedObserver;
}

export function useResizeObserver<T extends HTMLElement>(
  callback: ResizeCallback
): React.RefObject<T> {
  const elementRef = useRef<T>(null);
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  callbackRef.current = callback;

  const stableCallback = useCallback((entry: ResizeObserverEntry) => {
    callbackRef.current(entry);
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = getSharedObserver();
    callbacks.set(element, stableCallback);
    observer.observe(element);

    return () => {
      callbacks.delete(element);
      observer.unobserve(element);
      
      // Clean up shared observer if no more elements
      if (callbacks.size === 0 && sharedObserver) {
        sharedObserver.disconnect();
        sharedObserver = null;
      }
    };
  }, [stableCallback]);

  return elementRef;
}
