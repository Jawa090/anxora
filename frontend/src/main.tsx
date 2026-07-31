import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Store API URL so redirect.html (served same origin) can access it for RC token proxy
localStorage.setItem('rc_api_url', import.meta.env.VITE_API_URL || 'http://localhost:4000/api');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=' + Date.now()).then((registration) => {
      console.log('[app] Service Worker registered successfully');

      // Check for updates every time the page loads
      registration.update().catch(() => { });

      // Send initial visibility state to service worker
      const notifyVisibility = () => {
        if (navigator.serviceWorker.controller) {
          const isVisible = document.visibilityState === 'visible';
          console.log('[app] Notifying SW of visibility:', isVisible);
          navigator.serviceWorker.controller.postMessage({
            type: 'APP_VISIBILITY_CHANGE',
            visible: isVisible
          });
        }
      };

      // Send immediately after SW is ready
      setTimeout(notifyVisibility, 100);

      // Update when visibility changes
      document.addEventListener('visibilitychange', notifyVisibility);

      // Update on focus/blur
      window.addEventListener('focus', () => notifyVisibility());
      window.addEventListener('blur', () => notifyVisibility());
    }).catch((err) => {
      console.error('[app] Service Worker registration failed:', err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
