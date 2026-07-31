import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./Header";
import { TelephonyOverlay } from "@/components/telephony/TelephonyProvider";
import { SoftphoneProvider } from "@/contexts/SoftphoneContext";
import { useRealtime } from "@/hooks/useRealtime";

export function MainLayout() {
  // Keep app-level socket alive on all protected pages.
  useRealtime();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    
    // Handle global navigation events (e.g. from notifications)
    const handleGlobalNavigate = (e: any) => {
      const url = e.detail;
      if (url) {
        console.log('[MainLayout] Received navigate event:', url);
        navigate(url);
      }
    };
    window.addEventListener('navigate', handleGlobalNavigate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('navigate', handleGlobalNavigate);
    };
  }, [navigate]);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved, 10) : 256;
  });

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
    localStorage.setItem('sidebar-width', width.toString());
  };

  return (
    <SoftphoneProvider>
      <div className="min-h-screen bg-background overflow-x-hidden">
        {/* Overlay for mobile sidebar */}
        {isMobile && isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <AppSidebar
          width={isMobile ? 280 : sidebarWidth}
          onWidthChange={handleSidebarWidthChange}
          isMobile={isMobile}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div
          className="flex flex-col transition-all duration-300"
          style={{
            paddingLeft: isMobile ? '0' : `${sidebarWidth}px`,
            width: '100%'
          }}
        >
          <TopBar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isMobile={isMobile} />
          <main className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <TelephonyOverlay />
      </div>
    </SoftphoneProvider>
  );
}
