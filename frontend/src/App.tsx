import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { DialogProvider } from "@/contexts/DialogContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RushNotificationContainer } from "@/components/ui/RushNotification";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import { VideoCallProvider } from "@/contexts/VideoCallContext";
import VideoCallOverlay from "@/components/collaboration/VideoCallOverlay";
// Auth
import AuthPage from "./pages/auth/AuthPage";
import OnboardingPage from "./pages/auth/OnboardingPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AcceptInvitePage from "./pages/auth/AcceptInvitePage";
import GoogleCallbackPage from "./pages/auth/GoogleCallbackPage";
import MicrosoftCallbackPage from "./pages/auth/MicrosoftCallbackPage";
import ForcePasswordChangePage from "./pages/auth/ForcePasswordChangePage";
// Public Pages (for Google OAuth verification)
import HomePage from "./pages/public/HomePage";
import PrivacyPolicyPage from "./pages/public/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/public/TermsOfServicePage";
import ContactPage from "./pages/public/ContactPage";
import PublicApplicationForm from "./pages/public/PublicApplicationForm";
import FormSubmittedSuccess from "./pages/public/FormSubmittedSuccess";
import PublicSharedFormPage from "./pages/public/PublicSharedFormPage";
// Collaboration
import CalendarPage from "./pages/collaboration/CalendarPage";
import DrivePage from "./pages/collaboration/DrivePage";
import MailPage from "./pages/collaboration/MailPage";
import UniboxPage from "./pages/crm/UniboxPage";
import WorkgroupsPage from "./pages/collaboration/WorkgroupsPage";
import BroadcastPage from "./pages/collaboration/BroadcastPage";
import DirectChatPage from "./pages/collaboration/DirectChatPage";
import TeamChatsPage from "./pages/collaboration/TeamChatsPage";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useFcm } from "./hooks/useFcm";
// CRM
import CrmDashboardPage from "./pages/crm/CrmDashboardPage";
import LeadsPage from "./pages/crm/LeadsPage";
import CreateLeadPage from "./pages/crm/CreateLeadPage";
import LeadImportPage from "./pages/leads/LeadImportPage";
import ContactImportPage from "./pages/crm/ContactImportPage";
import ExternalSourcesPage from "./pages/leads/ExternalSourcesPage";
import CreateWorkspacePage from "./pages/workspaces/CreateWorkspacePage";
import DealsPage from "./pages/crm/DealsPage";
import CreateDealPage from "./pages/crm/CreateDealPage";
import CustomersPage from "./pages/crm/CustomersPage";
import ContactsPage from "./pages/crm/ContactsPage";
import CompaniesPage from "./pages/crm/CompaniesPage";
import SigningPartiesContactsPage from "./pages/crm/SigningPartiesContactsPage";
import SignAndManagePage from "./pages/crm/SignAndManagePage";
import MyVaultPage from "./pages/crm/MyVaultPage";
import CreateSigningPartyContactPage from "./pages/crm/CreateSigningPartyContactPage";
import CreateContactPage from "./pages/crm/CreateContactPage";
import CreateCompanyPage from "./pages/crm/CreateCompanyPage";
import SalesPage from "./pages/crm/SalesPage";
import AnalyticsPage from "./pages/crm/AnalyticsPage";
import CommunicationsPage from "./pages/crm/CommunicationsPage";
// HRMS
import HRMSDashboard from "@/pages/hrms/HRMSDashboard";
import AttendancePage from "@/pages/hrms/AttendancePage";
import EmployeesPage from "./pages/hrms/EmployeesPage";
import CreateEmployeePage from "./pages/hrms/CreateEmployeePage";
import EditEmployeePage from "./pages/hrms/EditEmployeePage";
import EmployeeDetailPage from "./pages/hrms/EmployeeDetailPage";
import LeaveManagementPage from "./pages/hrms/LeaveManagementPage";
import PayrollPage from "./pages/hrms/PayrollPage";
import GenerateSalarySlipPage from "./pages/hrms/GenerateSalarySlipPage";
import ViewSalarySlipPage from "./pages/hrms/ViewSalarySlipPage";
import NotificationsPage from "./pages/hrms/NotificationsPage";
// Inventory
import InventoryDashboard from "./pages/inventory/InventoryDashboard";
import ProductsPage from "./pages/inventory/ProductsPage";
import StockPage from "./pages/inventory/StockPage";
import PurchaseOrdersPage from "./pages/inventory/PurchaseOrdersPage";
import VendorsPage from "./pages/inventory/VendorsPage";
import WarehousePage from "./pages/inventory/WarehousePage";
import EmployeeAssignmentsPage from "./pages/inventory/EmployeeAssignmentsPage";
import CarInventoryPage from "./pages/inventory/CarInventoryPage";
import CarFormPage from "./pages/inventory/CarFormPage";
// Admin
import UsersPage from "./pages/admin/UsersPage";
import RolesPage from "./pages/admin/RolesPage";
import PermissionCenter from "./pages/admin/PermissionCenter.tsx";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import JoinRequestsPage from "./pages/admin/JoinRequestsPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
// CRM Detail Pages
import LeadDetailPage from "./pages/crm/LeadDetailPage";
import DealDetailPage from "./pages/crm/DealDetailPage";
import ContactDetailPage from "./pages/crm/ContactDetailPage";
import CompanyDetailPage from "./pages/crm/CompanyDetailPage";
import CustomerDetailPage from "./pages/crm/CustomerDetailPage";
// Tasks & Automation
import TasksPage from "./pages/tasks/IndependentTasksPage";
import IssueDetailPage from "./pages/tasks/IssueDetailPage";
import WorkflowsPage from "./pages/automation/WorkflowsPage";
import IntegrationsPage from "./pages/automation/IntegrationsPage";
import WebhooksPage from "./pages/automation/WebhooksPage";
// Projects
import ProjectsDashboardPage from "./pages/projects/ProjectsDashboardPage";
import ProjectDetailPage from "./pages/projects/ProjectDetailPage";
import ProjectReportPage from "./pages/projects/ProjectReportPage";
// Marketing
import MarketingDashboardPage from "./pages/marketing/MarketingDashboardPage";
import CampaignsPage from "./pages/marketing/CampaignsPage";
import CreateCampaignPage from "./pages/marketing/CreateCampaignPage";
import VisualCampaignBuilder from "./pages/marketing/VisualCampaignBuilder";
import EnhancedListsPage from "./pages/marketing/EnhancedListsPage";
import EnhancedFormsPage from "./pages/marketing/EnhancedFormsPage";
import EnhancedSequencesPage from "./pages/marketing/EnhancedSequencesPage";
import EnhancedAnalyticsPage from "./pages/marketing/EnhancedAnalyticsPage";
// Recruitment
import RecruitmentDashboard from "./pages/recruitment/RecruitmentDashboard";
import RequisitionsListPage from "./pages/recruitment/RequisitionsListPage";
import RequisitionRequestPage from "./pages/recruitment/RequisitionRequestPage";
import RequisitionDetailPage from "./pages/recruitment/RequisitionDetailPage";
import AdvertisementPage from "./pages/recruitment/AdvertisementPage";
import ApprovalWorkflowPage from "./pages/recruitment/ApprovalWorkflowPage";
import CandidatesPage from "./pages/recruitment/CandidatesPage";
import CandidateDetailPage from "./pages/recruitment/CandidateDetailPage";
import ApplicationFormPage from "./pages/recruitment/ApplicationFormPage";
import InterviewPage from "./pages/recruitment/InterviewPage";
import InterviewsPage from "./pages/recruitment/InterviewsPage";
import OffersPage from "./pages/recruitment/OffersPage";
import ScoringPage from "./pages/recruitment/ScoringPage";
import TalentPoolPage from "./pages/recruitment/TalentPoolPage";
import RecruitmentAnalyticsPage from "./pages/recruitment/AnalyticsPage";
// Finance
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import FinancialSetup from "./pages/finance/FinancialSetup";
import GeneralLedger from "./pages/finance/GeneralLedger";
import AccountsReceivable from "./pages/finance/AccountsReceivable";
import AccountsPayable from "./pages/finance/AccountsPayable";
import BankingCash from "./pages/finance/BankingCash";
import FinancialReports from "./pages/finance/FinancialReports";
import ExpenseManagement from "./pages/finance/ExpenseManagement";
import PayrollAccounting from "./pages/finance/PayrollAccounting";
import Budgeting from "./pages/finance/Budgeting";
// Other
import PlaceholderPage from "./pages/PlaceholderPage";
import SettingsPage from "./pages/SettingsPage";
import UnqualifiedPage from "./pages/crm/UnqualifiedPage";
import IncomingCallOverlay from "./pages/electron/IncomingCallOverlay";
import MessageOverlay from "./pages/electron/MessageOverlay";
import DesktopAppPage from "./pages/DesktopAppPage";
import NotFound from "./pages/NotFound";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

// Short-URL redirect component used by push notification click URLs
// /dc?chat=UUID  → /collaboration/direct-chats?chat=UUID
// /wg?team=UUID  → /collaboration/workgroups?team=UUID
// /bc?team=UUID  → /collaboration/broadcast?team=UUID
const ShortUrlRedirect = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    navigate(to + location.search, { replace: true });
  }, []);
  return null;
};


import { queryClient } from "@/lib/queryClient";

// Mounts inside AuthProvider so useAuth() is available
const PushNotificationsSetup = () => {
  usePushNotifications();
  useFcm();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="rush-crm-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RushNotificationContainer />
        <AuthProvider>
          <BrowserRouter>
            <PushNotificationsSetup />
            <NotificationsProvider>
              <OrganizationProvider>
                <DialogProvider>
                  <VideoCallProvider>
                    <VideoCallOverlay />
                    <Routes>
                      {/* Public Pages (for Google OAuth verification) */}
                      <Route path="/home" element={<HomePage />} />
                      <Route path="/privacy" element={<PrivacyPolicyPage />} />
                      <Route path="/terms" element={<TermsOfServicePage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/project-report/:token" element={<ProjectReportPage />} />
                      <Route path="/public/application-form/:token" element={<PublicApplicationForm />} />
                      <Route path="/form-submitted" element={<FormSubmittedSuccess />} />

                      {/* Public Auth Routes */}
                      <Route path="/auth" element={<AuthPage />} />
                      <Route path="/onboarding" element={<OnboardingPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/accept-invite" element={<AcceptInvitePage />} />
                      <Route path="/force-password-change" element={<ForcePasswordChangePage />} />
                      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                      <Route path="/auth/microsoft/callback" element={<MicrosoftCallbackPage />} />
                      <Route path="/electron/incoming-call" element={<IncomingCallOverlay />} />
                      <Route path="/electron/message-overlay" element={<MessageOverlay />} />

                      {/* Protected Routes */}
                      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                        <Route path="/" element={<Dashboard />} />
                        {/* Collaboration Routes */}
                        <Route path="/collaboration/calendar" element={<CalendarPage />} />
                        <Route path="/collaboration/drive" element={<DrivePage />} />
                        <Route path="/collaboration/drive/personal/:driveId" element={<DrivePage />} />
                        <Route path="/collaboration/mail" element={<MailPage />} />
                        <Route path="/crm/dashboard" element={<CrmDashboardPage />} />
                        <Route path="/crm/unibox" element={<UniboxPage />} />
                        <Route path="/collaboration/workgroups" element={<WorkgroupsPage />} />
                        <Route path="/collaboration/team-chats" element={<TeamChatsPage />} />
                        <Route path="/collaboration/broadcast" element={<BroadcastPage />} />
                        <Route path="/collaboration/direct-chats" element={<DirectChatPage />} />
                        {/* CRM Routes */}
                        <Route path="/crm/leads" element={<LeadsPage />} />
                        <Route path="/crm/leads/create" element={<CreateLeadPage />} />
                        <Route path="/crm/leads/import" element={<LeadImportPage />} />
                        <Route path="/crm/leads/external-sources" element={<ExternalSourcesPage />} />
                        <Route path="/crm/leads/:id" element={<LeadDetailPage />} />
                        <Route path="/crm/leads/:id/edit" element={<LeadDetailPage />} />
                        <Route path="/crm/unqualified" element={<UnqualifiedPage />} />
                        <Route path="/workspaces/create" element={<CreateWorkspacePage />} />
                        <Route path="/crm/deals" element={<DealsPage />} />
                        <Route path="/crm/deals/create" element={<CreateDealPage />} />
                        <Route path="/crm/deals/:id" element={<DealDetailPage />} />
                        <Route path="/crm/deals/:id/edit" element={<DealDetailPage />} />
                        <Route path="/crm/customers" element={<CustomersPage />} />
                        <Route path="/crm/customers/:id" element={<CustomerDetailPage />} />
                        <Route path="/crm/customers/contacts" element={<ContactsPage />} />
                        <Route path="/crm/customers/contacts/import" element={<ContactImportPage />} />
                        <Route path="/crm/customers/contacts/create" element={<CreateContactPage />} />
                        <Route path="/crm/customers/contacts/:id" element={<ContactDetailPage />} />
                        <Route path="/crm/customers/companies" element={<CompaniesPage />} />
                        <Route path="/crm/customers/companies/create" element={<CreateCompanyPage />} />
                        <Route path="/crm/customers/companies/:id" element={<CompanyDetailPage />} />
                        <Route path="/crm/customers/signing-parties" element={<SignAndManagePage />} />
                        <Route path="/crm/customers/signing-parties/vault" element={<MyVaultPage />} />
                        <Route path="/crm/customers/signing-parties/contacts" element={<SigningPartiesContactsPage />} />
                        <Route path="/crm/customers/signing-parties/contacts/create" element={<CreateSigningPartyContactPage />} />
                        <Route path="/crm/sales" element={<SalesPage />} />
                        <Route path="/crm/analytics" element={<AnalyticsPage />} />
                        <Route path="/crm/communications" element={<CommunicationsPage />} />
                        {/* HRMS Routes */}
                        <Route path="/hrms" element={<HRMSDashboard />} />
                        <Route path="/hrms/dashboard" element={<HRMSDashboard />} />
                        <Route path="/hrms/attendance" element={<AttendancePage />} />
                        <Route path="/hrms/employees" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><EmployeesPage /></RoleProtectedRoute>} />
                        <Route path="/hrms/employees/create" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><CreateEmployeePage /></RoleProtectedRoute>} />
                        <Route path="/hrms/employees/:id/edit" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><EditEmployeePage /></RoleProtectedRoute>} />
                        <Route path="/hrms/employees/:id" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><EmployeeDetailPage /></RoleProtectedRoute>} />
                        <Route path="/hrms/leave" element={<LeaveManagementPage />} />
                        <Route path="/hrms/payroll" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><PayrollPage /></RoleProtectedRoute>} />
                        <Route path="/hrms/payroll/generate" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><GenerateSalarySlipPage /></RoleProtectedRoute>} />
                        <Route path="/hrms/payroll/view/:id" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager"]}><ViewSalarySlipPage /></RoleProtectedRoute>} />
                        <Route path="/hrms/notifications" element={<NotificationsPage />} />
                        {/* Inventory Routes */}
                        <Route path="/inventory" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><InventoryDashboard /></RoleProtectedRoute>} />
                        <Route path="/inventory/products" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><ProductsPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/stock" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><StockPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/purchase-orders" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><PurchaseOrdersPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/vendors" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><VendorsPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/warehouse" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><WarehousePage /></RoleProtectedRoute>} />
                        <Route path="/inventory/warehouses" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><WarehousePage /></RoleProtectedRoute>} />
                        <Route path="/inventory/assignments" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><EmployeeAssignmentsPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/cars" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><CarInventoryPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/cars/new" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><CarFormPage /></RoleProtectedRoute>} />
                        <Route path="/inventory/cars/:id/edit" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><CarFormPage /></RoleProtectedRoute>} />
                        {/* Admin Routes - restricted to admin users */}
                        <Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                        <Route path="/admin/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
                        <Route path="/admin/permissions" element={<AdminRoute><PermissionCenter /></AdminRoute>} />
                        <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
                        <Route path="/admin/join-requests" element={<AdminRoute><JoinRequestsPage /></AdminRoute>} />
                        <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                        {/* Projects & Workspaces */}
                        <Route path="/tasks" element={<TasksPage />} />
                        <Route path="/projects" element={<ProjectsDashboardPage />} />
                        <Route path="/projects/:id" element={<ProjectDetailPage />} />
                        <Route path="/marketing/automation" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><WorkflowsPage /></RoleProtectedRoute>} />
                        {/* Marketing */}
                        <Route path="/marketing" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><MarketingDashboardPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/campaigns" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><CampaignsPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/templates" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><CampaignsPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/campaigns/create" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><CreateCampaignPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/campaigns/builder" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><VisualCampaignBuilder /></RoleProtectedRoute>} />
                        <Route path="/marketing/lists" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><EnhancedListsPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/forms" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><EnhancedFormsPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/sequences" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><EnhancedSequencesPage /></RoleProtectedRoute>} />
                        <Route path="/marketing/analytics" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]} fallbackCheck={(role, profile) => profile?.department?.toLowerCase() === "marketing"}><EnhancedAnalyticsPage /></RoleProtectedRoute>} />
                        {/* Recruitment */}
                        <Route path="/recruitment" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><RecruitmentDashboard /></RoleProtectedRoute>} />
                        <Route path="/recruitment/requisitions" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><RequisitionsListPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/requisitions/new" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><RequisitionRequestPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/requisitions/:id" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><RequisitionDetailPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/requisitions/:id/advertise" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><AdvertisementPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/approvals" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><ApprovalWorkflowPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/candidates" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><CandidatesPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/candidates/:id" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><CandidateDetailPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/candidates/:id/application-form" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><ApplicationFormPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/interviews" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><InterviewsPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/candidates/:candidateId/interview" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><InterviewPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/offers" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><OffersPage /></RoleProtectedRoute>} />
                        <Route path="/recruitment/scoring" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><ScoringPage /></RoleProtectedRoute>} />
                        {/* <Route path="/recruitment/talent-pool" element={<TalentPoolPage />} /> */}
                        <Route path="/recruitment/analytics" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin", "manager", "team_lead"]}><RecruitmentAnalyticsPage /></RoleProtectedRoute>} />
                        {/* Finance Routes */}
                        <Route path="/finance" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><FinanceDashboard /></RoleProtectedRoute>} />
                        <Route path="/finance/dashboard" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><FinanceDashboard /></RoleProtectedRoute>} />
                        <Route path="/finance/setup" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><FinancialSetup /></RoleProtectedRoute>} />
                        <Route path="/finance/general-ledger" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><GeneralLedger /></RoleProtectedRoute>} />
                        <Route path="/finance/accounts-receivable" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><AccountsReceivable /></RoleProtectedRoute>} />
                        <Route path="/finance/accounts-payable" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><AccountsPayable /></RoleProtectedRoute>} />
                        <Route path="/finance/banking-cash" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><BankingCash /></RoleProtectedRoute>} />
                        <Route path="/finance/reports" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><FinancialReports /></RoleProtectedRoute>} />
                        <Route path="/finance/expenses" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><ExpenseManagement /></RoleProtectedRoute>} />
                        <Route path="/finance/payroll" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><PayrollAccounting /></RoleProtectedRoute>} />
                        <Route path="/finance/budgeting" element={<RoleProtectedRoute allowedRoles={["super_admin", "admin"]}><Budgeting /></RoleProtectedRoute>} />
                        {/* Other Routes */}
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/desktop-app" element={<DesktopAppPage />} />
                      </Route>
                      {/* Short URL aliases for push notifications */}
                      <Route path="/dc" element={<ShortUrlRedirect to="/collaboration/direct-chats" />} />
                      <Route path="/wg" element={<ShortUrlRedirect to="/collaboration/workgroups" />} />
                      <Route path="/bc" element={<ShortUrlRedirect to="/collaboration/broadcast" />} />
                      <Route path="/public/forms/:id" element={<PublicSharedFormPage />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </VideoCallProvider>
                </DialogProvider>
              </OrganizationProvider>
            </NotificationsProvider>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider >
);

export default App;
