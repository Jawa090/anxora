import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Lock } from "lucide-react";
import rushLogo from "@/assets/rush-logo.svg";

export default function PrivacyPolicyPage() {
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
            <Shield className="w-48 h-48 text-indigo-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Lock className="w-3.5 h-3.5" /> Security & Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-400">
            Last updated: <span className="text-slate-300 font-medium">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </p>
        </div>

        {/* Policy Body */}
        <div className="p-8 sm:p-10 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm space-y-10 text-slate-300 leading-relaxed shadow-xl">
          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              1. Introduction
            </h2>
            <p className="text-slate-300 leading-relaxed">
              XCLATIX ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our CRM and business management platform, including any associated services, features, or applications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              2. Information We Collect
            </h2>
            <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Account Information:</strong> Name, email address, password, organization name, and profile information.</li>
              <li><strong>Business Data:</strong> CRM data (leads, deals, customers), HR records, inventory data, and other business information you input.</li>
              <li><strong>Communication Data:</strong> Messages, files, and content shared through our platform.</li>
            </ul>

            <h3 className="text-base font-semibold text-slate-200 mt-6 mb-2">2.2 Information from Connected Services</h3>
            <p className="text-slate-300 mb-3">
              When you connect third-party services like Google Drive, Google Calendar, OneDrive, or network drives, we may receive:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Basic profile information (name, email) from your account</li>
              <li>Access tokens to interact with your connected cloud storage and calendar</li>
              <li>File metadata (names, sizes, modification dates) from connected drives</li>
              <li>Calendar event data (titles, times, attendees) from connected calendars</li>
            </ul>

            <h3 className="text-base font-semibold text-slate-200 mt-6 mb-2">2.3 Automatically Collected Information</h3>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Device information (browser type, operating system)</li>
              <li>Usage data (features accessed, time spent, actions taken)</li>
              <li>Log data (IP address, access times, error reports)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Provide, maintain, and improve our CRM and business management services</li>
              <li>Process transactions and manage your account</li>
              <li>Enable integration with connected services (Google Drive, Google Calendar, OneDrive, etc.)</li>
              <li>Send service-related communications and notifications</li>
              <li>Ensure security, multi-tenant isolation, and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              4. Google API Services User Data Policy
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              XCLATIX's use and transfer of information received from Google APIs adheres to the{" "}
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="text-slate-200 font-medium mb-2">Specifically, we:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Only request access to data necessary for providing our CRM services</li>
              <li>Do not use Google user data for advertising purposes</li>
              <li>Do not sell Google user data to third parties</li>
              <li>Do not use Google user data to develop or improve AI/ML models unrelated to our core service</li>
              <li>Allow users to revoke access at any time through their Google Account settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              5. Data Sharing and Disclosure
            </h2>
            <p className="text-slate-300 leading-relaxed mb-3">
              We do not sell your personal information. We may share information only in these circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Within Your Organization:</strong> Data is shared with authorized users in your organization based on role permissions.</li>
              <li><strong>Service Providers:</strong> With trusted third-party providers who assist in operating our platform (hosting, analytics).</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              6. Data Security & Multi-Tenancy
            </h2>
            <p className="text-slate-300 leading-relaxed mb-3">
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Multi-tenant data isolation with Row Level Security (RLS)</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and role-based authentication mechanisms</li>
              <li>Secure token storage for third-party integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              7. Data Retention
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services. Upon account deletion, we will delete or anonymize your data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              8. Your Rights
            </h2>
            <p className="text-slate-300 leading-relaxed mb-3">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data</li>
              <li>Export your data in a portable format</li>
              <li>Object to or restrict processing</li>
              <li>Revoke consent for connected services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 border-b border-slate-800 pb-2">
              9. Contact Us
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-sm">
              <p className="font-semibold text-white">XCLATIX Privacy Team</p>
              <p className="text-slate-400 mt-1">Email: privacy@rushcorporation.com</p>
              <p className="text-slate-400">Website: xclatix.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} XCLATIX. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/home" className="hover:text-slate-300 transition-colors">Home</Link>
            <Link to="/privacy" className="text-slate-300 font-medium hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
