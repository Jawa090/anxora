import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MapPin, Phone, MessageSquare, Clock } from "lucide-react";
import rushLogo from "@/assets/rush-logo.svg";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-3 group">
            <img src={rushLogo} alt="XCLATIX" className="h-7 w-auto transition-transform group-hover:scale-105" />
            <span className="font-bold text-xl tracking-tight text-white group-hover:text-slate-200 transition-colors">
              XCLATIX
            </span>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/60">
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 relative z-10">
        {/* Banner Card */}
        <div className="mb-10 p-8 sm:p-10 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <MessageSquare className="w-48 h-48 text-indigo-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Mail className="w-3.5 h-3.5" /> Support & Contact
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Contact Us
          </h1>
          <p className="text-sm text-slate-400">
            Have questions about XCLATIX or need assistance? Reach out to our team.
          </p>
        </div>

        {/* Contact Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Email Us</h3>
            <p className="text-slate-400 text-sm">For general inquiries, support, or feedback:</p>
            <a href="mailto:support@xclatix.com" className="text-indigo-400 font-semibold hover:underline block pt-1">
              support@xclatix.com
            </a>
            <a href="mailto:privacy@rushcorporation.com" className="text-indigo-400 font-semibold hover:underline block">
              privacy@rushcorporation.com
            </a>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Support Hours</h3>
            <p className="text-slate-400 text-sm">Our support team is available:</p>
            <p className="text-slate-200 text-sm font-medium">Monday – Friday: 9:00 AM – 6:00 PM EST</p>
            <p className="text-slate-400 text-xs pt-1">Response time: Within 24 hours</p>
          </div>
        </div>

        {/* Additional Detail Card */}
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm text-slate-300 leading-relaxed shadow-xl space-y-4">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-2">
            Administrator Account Requests
          </h2>
          <p className="text-slate-300">
            If you need access to an organization workspace on XCLATIX, please contact your organization administrator or IT department directly to issue an invite link.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} XCLATIX. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/home" className="hover:text-slate-300 transition-colors">Home</Link>
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link to="/contact" className="text-slate-300 font-medium hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
