import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, ArrowRight } from "lucide-react";

interface CalendarConnectSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
}

export function CalendarConnectSuccessDialog({
  open,
  onOpenChange,
  provider,
}: CalendarConnectSuccessDialogProps) {
  const providerName = provider === 'google' ? 'Google Calendar' : provider;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md h-[400px] flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-bold">Successfully Connected!</DialogTitle>
          <DialogDescription className="text-base">
            Your {providerName} has been successfully linked to ELINA.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-8">
          <div className="p-3 rounded-xl bg-muted border">
            {provider === 'google' ? (
               <svg viewBox="0 0 24 24" className="w-6 h-6">
                <rect x="3" y="4" width="18" height="18" rx="2" fill="#00D6C1" />
                <rect x="3" y="4" width="18" height="5" fill="#00D6C1" />
                <text x="12" y="17" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">31</text>
              </svg>
            ) : <Calendar className="w-6 h-6" />}
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className="p-3 rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          You can now see and manage your external events directly from your dashboard.
        </p>

        <Button 
          className="w-full bg-primary hover:bg-primary/80 text-white font-semibold py-6 rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          Go to Calendar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
