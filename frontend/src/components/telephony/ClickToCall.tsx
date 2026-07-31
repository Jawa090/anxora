import { Phone } from 'lucide-react';
import { useSoftphone } from '@/contexts/SoftphoneContext';
import { useTelephony } from '@/hooks/useTelephony';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClickToCallProps {
  phoneNumber: string;
  entityType?: 'lead' | 'deal' | 'contact' | 'company';
  entityId?: string;
  className?: string;
  showText?: boolean;
  showIcon?: boolean;
  variant?: 'link' | 'ghost' | 'outline';
  customTrigger?: React.ReactNode;
}

export function ClickToCall({ 
  phoneNumber, 
  entityType, 
  entityId, 
  className = '', 
  showText = true, 
  showIcon = true,
  variant = 'link',
  customTrigger
}: ClickToCallProps) {
  // Use optional chaining or defaults in case hooks are not fully initialized
  const telephony = useTelephony() || { canUseTelephony: false, hasProviders: false };
  const softphone = useSoftphone() || { dialNumber: () => {}, activeProvider: null, openSoftphone: () => {}, iframeRef: { current: null } };

  const { canUseTelephony, hasProviders } = telephony;
  const { dialNumber, activeProvider, openSoftphone, iframeRef } = softphone;

  if (!phoneNumber) return null;

  const sendNumberToRingCentral = (number: string) => {
    const cleanNumber = number.replace(/[^\d+]/g, '');
    
    // Send number directly to RingCentral widget dialpad
    if (iframeRef?.current?.contentWindow) {
      // Method 1: Send to dialpad input field
      iframeRef.current.contentWindow.postMessage({
        type: 'rc-adapter-new-call',
        phoneNumber: cleanNumber,
      }, '*');
      
      // Method 2: Alternative approach - set dialpad number
      setTimeout(() => {
        if (iframeRef?.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-adapter-control-call',
            action: 'setDialpadNumber',
            number: cleanNumber,
          }, '*');
        }
      }, 100);
      
      // Method 3: Direct dialpad manipulation
      setTimeout(() => {
        if (iframeRef?.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'rc-post-message-request',
            requestId: `dial-${Date.now()}`,
            path: '/dialpad',
            body: {
              phoneNumber: cleanNumber,
              action: 'setNumber'
            }
          }, '*');
        }
      }, 200);
      
      // toast.success(`Number sent to RingCentral: ${cleanNumber}`, {
      //   description: 'Check your RingCentral dialpad'
      // });
    } else {
      toast.error('RingCentral widget not available', {
        description: 'Please open the softphone first'
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[ClickToCall] Clicked:', { phoneNumber, activeProvider, hasProviders, canUseTelephony });

    if (activeProvider === 'ringcentral') {
      // Open softphone and send number to dialpad
      openSoftphone();
      
      // Wait a moment for softphone to open, then send the number
      setTimeout(() => {
        sendNumberToRingCentral(phoneNumber);
      }, 500);
      
      // Also trigger the dial function for entity context
      if (entityType && entityId) {
        dialNumber(phoneNumber, { entityType, entityId });
      }
    } else if (openSoftphone) {
      console.log('[ClickToCall] No active provider, opening softphone...');
      openSoftphone();
      toast.info('Please connect RingCentral to auto-dial numbers');
    } else {
      console.log('[ClickToCall] Softphone not available, falling back to tel:');
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  // If custom trigger is provided, use it
  if (customTrigger) {
    return (
      <div
        onClick={handleClick}
        className={cn("cursor-pointer", className)}
        title={`Auto-dial ${phoneNumber} in RingCentral`}
      >
        {customTrigger}
      </div>
    );
  }

  if (variant === 'ghost' || variant === 'outline') {
    return (
      <Button
        variant={variant}
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={handleClick}
        title={`Auto-dial ${phoneNumber} in RingCentral`}
      >
        <Phone className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 cursor-pointer group transition-colors",
        "hover:text-primary",
        className
      )}
      onClick={handleClick}
      title={`Auto-dial ${phoneNumber} in RingCentral`}
    >
      {showIcon && <Phone className="h-3.5 w-3.5 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />}
      {showText && (
        <span className="group-hover:underline transition-color font-medium">
          {phoneNumber}
        </span>
      )}
    </span>
  );
}

// Add a default export to prevent import errors in different parts of the app
export default ClickToCall;
