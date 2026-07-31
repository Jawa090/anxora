import { useTheme } from "@/components/theme-provider";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-slate-900 group-[.toaster]:text-white group-[.toaster]:border-slate-800 dark:group-[.toaster]:bg-white dark:group-[.toaster]:text-slate-950 dark:group-[.toaster]:border-slate-100 group-[.toaster]:shadow-lg font-sans",
          description: "group-[.toast]:text-slate-400 dark:group-[.toast]:text-slate-500",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-slate-950 group-[.toast]:text-slate-400 group-[.toast]:border-slate-800 dark:group-[.toast]:bg-slate-50 dark:group-[.toast]:text-slate-500 dark:group-[.toast]:border-slate-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
