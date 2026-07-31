import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import rushLogo from "@/assets/rush-logo.svg";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-3 group">
            {/* <img src={rushLogo} alt="ANXORA" className="h-7 w-auto transition-transform group-hover:scale-105" /> */}
            <span className="font-bold text-xl tracking-tight text-white group-hover:text-slate-200 transition-colors">
              ANXORA
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
            <FileText className="w-48 h-48 text-indigo-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" /> Legal Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-400">
            Last updated: <span className="text-slate-300 font-medium">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </p>
        </div>

        {/* Terms Body */}
        <div className="p-8 sm:p-10 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-10 text-slate-300 leading-relaxed shadow-xl">
          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              1. Acceptance of Terms
            </h2>
            <p className="text-slate-300 leading-relaxed">
              By accessing or using ANXORA ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service. These Terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              2. Description of Service
            </h2>
            <p className="text-slate-300 leading-relaxed mb-3">
              ANXORA is a multi-tenant CRM and business management platform that provides:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Customer Relationship Management (CRM) tools</li>
              <li>Human Resource Management System (HRMS)</li>
              <li>Inventory management</li>
              <li>Collaboration tools including calendar, file storage, and communication</li>
              <li>Integration with third-party services (Google Drive, Google Calendar, OneDrive, network drives)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              3. Account Registration & Multi-Tenancy
            </h2>
            <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">3.1 Account Creation</h3>
            <p className="text-slate-300 leading-relaxed mb-3">
              To use certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration and keep your account details updated.
            </p>
            <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">3.2 Account Security</h3>
            <p className="text-slate-300 leading-relaxed mb-3">
              You are responsible for safeguarding your credentials and for all activities that occur under your account. Notify your administrator immediately of any unauthorized access or breach of security.
            </p>
            <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">3.3 Organization Accounts</h3>
            <p className="text-slate-300 leading-relaxed">
              Accounts are tied to organization tenants. Organization administrators have rights to manage user access, permissions, and data within their tenant boundary.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              4. Acceptable Use
            </h2>
            <p className="text-slate-300 leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Use the Service for illegal purposes or in violation of local, state, national, or international laws</li>
              <li>Attempt to gain unauthorized access to other tenants' data or system infrastructure</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Upload malicious code, viruses, or harmful components</li>
              <li>Reverse engineer, decompile, or disassemble any aspect of the Service</li>
              <li>Exceed reasonable API usage limits or attempt to bypass rate limits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              5. Third-Party Integrations
            </h2>
            <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">5.1 Connected Services</h3>
            <p className="text-slate-300 leading-relaxed mb-3">
              The Service allows integration with third-party providers (Google, Microsoft, cloud storage). Your use of third-party services is subject to their respective terms and policies.
            </p>
            <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">5.2 Service Availability</h3>
            <p className="text-slate-300 leading-relaxed">
              We are not responsible for downtime, data loss, or service disruptions caused by third-party providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              6. Intellectual Property
            </h2>
            <p className="text-slate-300 leading-relaxed">
              The Service, including software, design, text, graphics, and underlying source code, is owned by ANXORA and protected by copyright, trademark, and other intellectual property laws. You retain ownership of all business data uploaded to your tenant.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              7. Termination
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We may suspend or terminate access to the Service immediately, without prior notice, for conduct that violates these Terms or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              8. Limitation of Liability
            </h2>
            <p className="text-slate-300 leading-relaxed">
              In no event shall ANXORA, its directors, employees, or partners be liable for indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              9. Contact Information
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-sm">
              <p className="font-semibold text-white">ANXORA Legal Team</p>
              <p className="text-slate-400 mt-1">Email: legal@rushcorporation.com</p>
              <p className="text-slate-400">Website: ANXORA.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ANXORA. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/home" className="hover:text-slate-300 transition-colors">Home</Link>
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-slate-300 font-medium hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
