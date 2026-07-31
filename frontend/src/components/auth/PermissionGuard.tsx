import React, { useEffect } from "react";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PermissionGuardProps {
  module: string;
  action?: string;
  children: React.ReactNode;
}

const RestrictedAccess = ({
  module,
  action,
}: {
  module: string;
  action?: string;
}) => {
  const navigate = useNavigate();

  return (
    <div className="w-[30vw] h-[65vh] flex flex-col items-center justify-center bg-gradient-to-br from-sky-400 via-blue-400 to-indigo-400 text-white rounded-3xl shadow-2xl relative overflow-hidden p-8 mx-auto mt-4 max-w-6xl">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/20 rounded-full blur-3xl pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 flex flex-col items-center max-w-2xl text-center">
        <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 shadow-xl border border-white/30 rotate-12 transition-transform hover:rotate-0 duration-500">
          <ShieldAlert className="w-12 h-12 text-white" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-black tracking-tight mb-4 drop-shadow-sm text-white">
          Access Restricted
        </h1>

        <p className="text-white/90 text-lg md:text-xl font-medium mb-10 leading-relaxed shadow-sm">
          Oops! You don't have permission to view the{" "}
          <span className="font-bold underline decoration-wavy decoration-white/50 px-1 capitalize">
            {module.replace(/_/g, " ")}
          </span>{" "}
          page.
        </p>

        {action && (
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md text-sm font-semibold shadow-inner">
            <Lock className="h-4 w-4" />
            Required Action:{" "}
            <span className="capitalize">{action.replace(/_/g, " ")}</span>
          </div>
        )}

        <Button
          onClick={() => navigate(-1)}
          variant="secondary"
          size="lg"
          className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 h-14 rounded-2xl flex items-center gap-3 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back Safely
        </Button>
      </div>
    </div>
  );
};

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  module,
  action,
  children,
}) => {
  const { hasPermission, loading } = useAuth();

  useEffect(() => {
    if (!loading && !hasPermission(module, action)) {
      const moduleName = module.replace(/_/g, " ");
      toast.error(`You don't have permission to view ${moduleName} page`, {
        duration: 4000,
        position: "bottom-right",
      });
    }
  }, [module, action, hasPermission, loading]);

  if (loading) {
    return null; // Or a loading spinner
  }

  if (!hasPermission(module, action)) {
    return <RestrictedAccess module={module} action={action} />;
  }

  return <>{children}</>;
};
