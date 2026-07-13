import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/topbar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1">
          <div key={typeof window !== "undefined" ? window.location.pathname : ""}
               className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
