import React, { useState } from "react";
import { 
  Download, Monitor, Smartphone, Sparkles, CheckCircle2, Cpu, Shield, Zap, 
  ChevronRight, Laptop, AppWindow, ArrowUpRight, HelpCircle, HardDrive, Terminal
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 
export default function DesktopAppPage() {
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile">("desktop");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleDownload = (platform: string) => {
    toast.success(`Redirecting to download for ${platform}...`);
    
    let url = "";
    if (platform === "macOS-Silicon" || platform === "macOS-Intel") {
      url = "https://github.com/Rushgitrepo/Rush-CRM/actions/runs/26046086968/artifacts/7063434127";
    } else if (platform === "Windows") {
      url = "https://github.com/Rushgitrepo/Rush-CRM/releases/download/v1.0.9/Rush-CRM-Setup-1.0.9.exe";
    } else if (platform === "Android") {
      url = "https://drive.usercontent.google.com/download?id=1Gt3G3z1ReD-w-iarphiIbNyBOHWx8Dk6&export=download&authuser=0&confirm=t&uuid=843de15c-bf05-464f-b5f5-7bd113d39bbb&at=ALBwUgl_qH21GqtowrXASF3Rpp0u%3A1779453333026";
    } else if (platform === "Linux") {
      url = "https://github.com/Rushgitrepo/Rush-CRM/actions/runs/26046086968/artifacts/7063391423";
    }

    if (url) {
      window.open(url, "_blank");
    }
  };

  const faqs = [
    {
      q: "How do I bypass the macOS SmartScreen/Gatekeeper warning?",
      a: "Since the package is currently in internal distribution, right-click the downloaded .dmg file, select 'Open' from the context menu, and then click 'Open' in the dialog box to authorize installation."
    },
    {
      q: "Does the Windows app support auto-updates?",
      a: "Yes! Every time you launch the Windows application, it contacts our update servers to perform a light diff update so you're always running the latest version."
    },
    {
      q: "How can I get access to the iOS TestFlight beta?",
      a: "Please contact your system administrator or the IT Helpdesk. Once invited, you will receive an email from Apple TestFlight to install the app directly on your iOS device."
    }
  ];

  return (
    <div className="relative min-h-screen text-foreground overflow-hidden pb-20">
      <div className="max-w-6xl mx-auto px-6 pt-12 relative z-10">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-16">
        
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6 text-foreground">
            XCLATIX
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl leading-relaxed mb-8">
            Experience XCLATIX optimized for your hardware. Enjoy system integration, offline functionality, and responsive speed.
          </p>

          {/* Segment Control / Tabs */}
          <div className="inline-flex p-1 bg-muted/60 backdrop-blur-md rounded-xl border border-border/80">
            <button
              onClick={() => setActiveTab("desktop")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                activeTab === "desktop"
                  ? "bg-background text-foreground shadow-md border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Laptop className="h-4 w-4" />
              Desktop App
            </button>
            <button
              onClick={() => setActiveTab("mobile")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                activeTab === "mobile"
                  ? "bg-background text-foreground shadow-md border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Mobile App
            </button>
          </div>
        </div>

        {/* DEVICE TARGETED CONTENT */}
        <div className="mb-20">
          {activeTab === "desktop" ? (
            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8">
              {/* macOS */}
              <div className="relative flex flex-col justify-between p-8 rounded-3xl border border-border bg-card transition-all duration-300 shadow-lg group">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Cpu className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-muted border border-border text-muted-foreground px-3 py-1 rounded-full">
                      v1.0.0 .dmg
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    macOS Desktop
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Silicon & Intel
                    </span>
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    Runs natively on both Apple Silicon (M1/M2/M3) and older Intel-based Mac models.
                  </p>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Dedicated packages for both architectures
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Requires macOS Monterey 12.0 or later
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Full system dock badge integration
                    </div>
                  </div>
                </div>

                {/* macOS Installation Terminal Command */}
                <div className="p-4 rounded-2xl bg-muted border border-border text-left font-mono mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Installation Terminal Action</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText("sudo xattr -rd com.apple.quarantine /Applications/Rush\\ CRM.app");
                        toast.success("Command copied to clipboard!");
                      }}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 font-sans">
                    If macOS flags the application as untrusted, run the following command in terminal:
                  </p>
                  <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-xs text-emerald-400 overflow-x-auto whitespace-pre font-mono">
                    sudo xattr -rd com.apple.quarantine /Applications/Rush\ CRM.app
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => handleDownload("macOS-Silicon")}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-6 text-sm rounded-xl transition-all shadow-md"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download for Apple Silicon (dmg)
                  </Button>
                  <Button
                    onClick={() => handleDownload("macOS-Intel")}
                    className="w-full bg-secondary hover:bg-muted text-foreground border border-border font-semibold py-6 text-sm rounded-xl transition-all"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download for macOS Intel (dmg)
                  </Button>
                </div>
              </div>

              {/* Windows */}
              <div className="relative flex flex-col justify-between p-8 rounded-3xl border border-border bg-card transition-all duration-300 shadow-xl group">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Monitor className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-muted border border-border text-muted-foreground px-3 py-1 rounded-full">
                      v1.0.9 .exe
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    Windows Desktop
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      x64
                    </span>
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    High-performance client with direct window management. Installs cleanly with offline mode capabilities.
                  </p>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Installs standard shortcuts & system tray controls
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Supports Windows 10 & 11 (64-bit)
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Background sync on system start option
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleDownload("Windows")}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-6 text-base rounded-xl transition-all shadow-md"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download for Windows
                </Button>
              </div>

              {/* Linux */}
              <div className="relative flex flex-col justify-between p-8 rounded-3xl border border-border bg-card transition-all duration-300 shadow-xl group">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Terminal className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-muted border border-border text-muted-foreground px-3 py-1 rounded-full">
                      v1.0.0 .AppImage
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    Linux Desktop
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      x64
                    </span>
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    Universal package built for standard Linux distributions. Runs sandbox isolated via AppImage.
                  </p>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Portable AppImage format ready to execute
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Supports Ubuntu, Debian, Fedora & Arch
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Full terminal launching parameters support
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleDownload("Linux")}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-6 text-base rounded-xl transition-all shadow-md"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download for Linux
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Android */}
              <div className="relative flex flex-col justify-between p-8 rounded-3xl border border-border bg-card transition-all duration-300 shadow-xl group">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-muted border border-border text-muted-foreground px-3 py-1 rounded-full">
                      v1.0.0 .apk
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    Android Native
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      v7.0+
                    </span>
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    Sleek layout for phones and tablets. Direct hardware integrations enable faster CRM operations.
                  </p>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Real-time push notifications via Firebase Cloud Messaging
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Supports mobile biometric face/fingerprint lock
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      Quick camera scanner to ingest lead business cards
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleDownload("Android")}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-6 text-base rounded-xl transition-all shadow-md"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download for Android
                </Button>
              </div>

              {/* iOS - Coming Soon */}
              <div className="relative flex flex-col justify-between p-8 rounded-3xl border border-dashed border-border bg-card/60 backdrop-blur-md opacity-85">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center border border-border text-muted-foreground">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-semibold bg-muted/40 text-muted-foreground px-3 py-1 rounded-full border border-border/20">
                      Apple TestFlight Beta
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2 text-muted-foreground">
                    iOS Native App
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/20">
                      iOS Coming Soon
                    </span>
                  </h3>
                

    
                </div>

                <Button
                  disabled
                  className="w-full bg-muted text-muted-foreground font-semibold py-6 text-base rounded-xl cursor-not-allowed border border-border/25"
                >
                 Coming Soon 
                </Button>
              </div>
            </div>
          )}
        </div>
     
      </div>
    </div>
  );
}
