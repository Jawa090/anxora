import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Users, 
  BarChart3, 
  Calendar, 
  FolderOpen, 
  Mail,
  CheckCircle,
  ArrowRight,
  Briefcase,
  Layers,
  Sparkles,
  Lock
} from "lucide-react";
import rushLogo from "@/assets/rush-logo.svg";

const modules = [
  "Customer Relationship Management (CRM)",
  "Human Resource Management (HRMS)",
  "Project Management",
  "Inventory Management",
  "Finance & Accounting",
  "Marketing Automation",
  "Team Collaboration"
];

const googleIntegrations = [
  "Gmail Integration & Unified Inbox",
  "Google Calendar Sync for Scheduling",
  "Google Drive Integration for Cloud Storage",
  "Multi-Tenant SaaS Security & Isolation"
];

const features = [
  {
    icon: Users,
    title: "CRM & Sales",
    description: "Manage leads, deals, contacts, and sales pipelines efficiently."
  },
  {
    icon: Shield,
    title: "HRMS",
    description: "Complete employee management, attendance, and leave tracking."
  },
  {
    icon: Briefcase,
    title: "Project Management",
    description: "Track tasks, milestones, and team deliverables seamlessly."
  },
  {
    icon: Layers,
    title: "Inventory & Finance",
    description: "Monitor inventory levels, invoices, and business financials."
  },
  {
    icon: Calendar,
    title: "Google Calendar Sync",
    description: "Synchronize events, meetings, and schedules in real-time."
  },
  {
    icon: FolderOpen,
    title: "Google Drive Storage",
    description: "Access and share cloud storage files directly within your workspace."
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-3 group">
            <img src={rushLogo} alt="ELINA" className="h-7 w-auto transition-transform group-hover:scale-105" />
            <span className="font-bold text-xl tracking-tight text-white group-hover:text-slate-200 transition-colors">
              ELINA
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">
              Contact
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4">
                Sign In
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Hero */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4" /> AI-Powered Business Platform
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4">
            ELINA
          </h1>
          
          <h2 className="text-2xl sm:text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white to-indigo-200 mb-8">
            AI Powered CRM & ERP Platform
          </h2>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10">
            ELINA is an AI-powered CRM & ERP platform that helps businesses manage:
          </p>

          {/* Module Pill Grid */}
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto mb-12">
            {modules.map((item) => (
              <div 
                key={item}
                className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-sm font-medium flex items-center gap-2 shadow-sm"
              >
                <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Google Integration Highlight Banner */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 text-slate-300 max-w-3xl mx-auto shadow-2xl mb-12 text-left">
            <p className="text-base sm:text-lg font-medium text-slate-200 mb-4">
              Users can securely connect their Google Account to synchronize Gmail, Google Calendar and Google Drive with their ELINA workspace.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              {googleIntegrations.map((text) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 font-semibold px-8 h-12 rounded-xl shadow-lg shadow-indigo-500/20">
                Sign In to Workspace <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800/80">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12">
            Comprehensive Platform Capabilities
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat) => {
              const IconComponent = feat.icon;
              return (
                <div 
                  key={feat.title} 
                  className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-indigo-500/30 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={rushLogo} alt="ELINA" className="h-6 w-auto" />
            <span className="font-bold text-white tracking-wide">ELINA</span>
            <span className="text-xs text-slate-600">| AI Powered CRM & ERP</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link to="/contact" className="hover:text-slate-300 transition-colors">Contact</Link>
            <Link to="/auth" className="hover:text-slate-300 transition-colors">Sign In</Link>
          </div>
          <p>© {new Date().getFullYear()} ELINA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
