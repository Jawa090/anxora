import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./Header";
import { TelephonyOverlay } from "@/components/telephony/TelephonyProvider";
import { SoftphoneProvider } from "@/contexts/SoftphoneContext";
import { useRealtime, useUniboxFolderRealtime } from "@/hooks/useRealtime";

export function MainLayout() {
  // Keep app-level socket alive on all protected pages.
  useRealtime();
  useUniboxFolderRealtime();

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

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isChatActive =
    (location.pathname.startsWith("/collaboration/workgroups") && searchParams.has("team")) ||
    (location.pathname.startsWith("/collaboration/team-chats") && searchParams.has("team")) ||
    (location.pathname.startsWith("/collaboration/direct-chats") && searchParams.has("chat")) ||
    (location.pathname.startsWith("/collaboration/broadcast") && searchParams.has("team"));

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
          className="flex flex-col transition-all duration-300 min-w-0"
          style={{
            paddingLeft: isMobile ? '0' : `${sidebarWidth}px`,
            width: '100%',
            maxWidth: '100vw',
            boxSizing: 'border-box',
          }}
        >
          <TopBar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isMobile={isMobile} />
          {isChatActive ? (
            <main className="h-[calc(100vh-4rem)] w-full overflow-hidden p-0 m-0">
              <Outlet />
            </main>
          ) : (
            <main className="px-3.5 py-3 md:px-5 md:py-4 lg:px-6 lg:py-4 w-full min-w-0 max-w-full overflow-x-hidden">
              <div className="w-full max-w-[1600px] mx-auto min-w-0">
                <Outlet />
              </div>
            </main>
          )}
        </div>
        <TelephonyOverlay />
      </div>
    </SoftphoneProvider>
  );
}
