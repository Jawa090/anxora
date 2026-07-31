import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">XCLATIX</h2>
          <p className="text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    </div>
  );
}
