import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, LockKeyhole, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackCheck?: (role: string, profile: any) => boolean;
}

export function RoleProtectedRoute({ children, allowedRoles, fallbackCheck }: RoleProtectedRouteProps) {
  const { userRole, profile, loading } = useAuth();
  const navigate = useNavigate();

  const isAuthorized = userRole && (
    allowedRoles.includes(userRole.role) ||
    (fallbackCheck && fallbackCheck(userRole.role, profile))
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="w-full h-full min-h-[80vh] flex flex-col items-center justify-center bg-gradient-to-br from-sky-400 via-blue-400 to-indigo-400 text-white rounded-3xl shadow-2xl relative overflow-hidden p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/20 rounded-full blur-3xl pointer-events-none -translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col items-center max-w-2xl text-center">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 shadow-xl border border-white/30 rotate-12 transition-transform hover:rotate-0 duration-500">
            <LockKeyhole className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>

          <h1 className="text-5xl font-black tracking-tight mb-4 drop-shadow-sm text-white">
            Restricted Area
          </h1>

          <p className="text-white/90 text-lg md:text-xl font-medium mb-10 leading-relaxed shadow-sm">
            We're sorry, your role doesn't allow access to this page
          </p>

          <Button
            onClick={() => navigate("/")}
            variant="secondary"
            size="lg"
            className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 h-14 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
