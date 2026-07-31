import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  Info,
  Trash2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmVariant = "danger" | "warning" | "info" | "default";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const variantConfig: Record<ConfirmVariant, {
  icon: React.ReactNode;
  confirmClass: string;
  iconColor: string;
}> = {
  danger: {
    icon: <Trash2 className="h-5 w-5" />,
    confirmClass: "bg-red-600 hover:bg-red-500 text-white",
    iconColor: "text-red-500",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    confirmClass: "bg-amber-600 hover:bg-amber-500 text-white",
    iconColor: "text-amber-500",
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    confirmClass: "bg-blue-600 hover:bg-blue-500 text-white",
    iconColor: "text-blue-500",
  },
  default: {
    icon: <ShieldAlert className="h-5 w-5" />,
    confirmClass: "bg-slate-700 hover:bg-slate-600 text-white",
    iconColor: "text-slate-400",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
  icon,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-slate-800/70 bg-[#131B2E] backdrop-blur-xl sm:rounded-2xl shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3 text-slate-100">
            <span className={cn("shrink-0", config.iconColor)}>
              {icon ?? config.icon}
            </span>
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm text-slate-400 leading-relaxed pt-1">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            disabled={isLoading}
            className="rounded-xl border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 font-bold text-xs h-9 px-4"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className={cn("rounded-xl font-bold text-xs h-9 px-4 border-0", config.confirmClass)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                {confirmText}...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
