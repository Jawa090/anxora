import React, { useEffect, useState } from 'react';
import { Phone, Video, X, Mic, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';

const IncomingCallOverlay = () => {
  const [callData, setCallData] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const dataStr = params.get('data');
    if (dataStr) {
      try {
        setCallData(JSON.parse(decodeURIComponent(dataStr)));
      } catch (e) {
        console.error('Failed to parse call data', e);
      }
    }

    // Play ringtone
    const ringtone = new Audio('/skype_ring.mp3');
    ringtone.loop = true;
    ringtone.play().catch(console.error);

    return () => {
      ringtone.pause();
    };
  }, []);

  const handleAccept = () => {
    // @ts-ignore
    window.electronAPI?.acceptIncomingCall();
  };

  const handleReject = () => {
    // @ts-ignore
    window.electronAPI?.closeIncomingCall();
  };

  if (!callData) return null;

  const isVideo = callData.callType === 'video';

  return (
    <div className="w-full h-screen bg-[#0c111d] text-white flex flex-col items-center justify-between py-12 px-6 overflow-hidden rounded-3xl border border-white/10 shadow-2xl select-none">
      {/* App Header */}
      <div className="flex items-center gap-2 self-start absolute top-6 left-6 opacity-80">
        <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center p-1">
          <Phone className="w-full h-full text-white" />
        </div>
        <span className="text-xs font-semibold tracking-wider">RUSH CALL</span>
      </div>

      {/* Caller Info */}
      <div className="flex flex-col items-center mt-8 space-y-4">
        <div className="relative">
          <Avatar className="w-24 h-24 border-2 border-white/20 shadow-xl">
            <AvatarImage src={getAvatarUrl(callData.callerAvatar)} />
            <AvatarFallback className="bg-zinc-800 text-3xl font-bold">
              {callData.callerName?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-[#0c111d] flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">{callData.callerName}</h2>
          <p className="text-zinc-400 text-sm mt-1 flex items-center justify-center gap-1.5 uppercase tracking-widest font-semibold">
            {isVideo ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full flex items-center justify-around pb-4">
        {/* Reject Button */}
        <div className="flex flex-col items-center gap-3 group">
          <button
            onClick={handleReject}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90"
          >
            <PhoneOff className="w-7 h-7 text-white fill-current" />
          </button>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Decline</span>
        </div>

        {/* Accept Button */}
        <div className="flex flex-col items-center gap-3 group">
          <button
            onClick={handleAccept}
            className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 animate-bounce-slow"
          >
            <Phone className="w-7 h-7 text-white fill-current" />
          </button>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Accept</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite ease-in-out;
        }
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: transparent !important;
        }
      `}} />
    </div>
  );
};

export default IncomingCallOverlay;
