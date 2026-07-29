import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import DashboardLayout from './pages/DashboardLayout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

// CRM Routes
import CRMIndex from './routes/_app.crm.index'
import CRMLeads from './routes/_app.crm.leads'
import CRMDeals from './routes/_app.crm.deals'
import CRMCustomers from './routes/_app.crm.customers'
import CRMPipeline from './routes/_app.crm.pipeline'
import CRMActivities from './routes/_app.crm.activities'
import CRMEmail from './routes/_app.crm.email'
import CRMCalls from './routes/_app.crm.calls'
import CRMInbox from './routes/_app.crm.inbox'
import CRMSettings from './routes/_app.crm.settings'

// Tasks Routes
import TasksIndex from './routes/_app.tasks.index'
import TasksList from './routes/_app.tasks.list'
import TasksKanban from './routes/_app.tasks.kanban'
import TasksCalendar from './routes/_app.tasks.calendar'
import TasksTimeline from './routes/_app.tasks.timeline'

// Projects Routes
import ProjectsIndex from './routes/_app.projects.index'
import ProjectsList from './routes/_app.projects.list'
import ProjectsKanban from './routes/_app.projects.kanban'
import ProjectsGantt from './routes/_app.projects.gantt'
import ProjectsMilestones from './routes/_app.projects.milestones'

// Collaboration Routes
import CollaborationIndex from './routes/_app.collaboration.index'
import CollaborationChannels from './routes/_app.collaboration.channels'
import CollaborationMessages from './routes/_app.collaboration.messages'
import CollaborationMeetings from './routes/_app.collaboration.meetings'
import CollaborationCalls from './routes/_app.collaboration.calls'

// HRMS Routes
import HRMSIndex from './routes/_app.hrms.index'
import HRMSEmployees from './routes/_app.hrms.employees'
import HRMSAttendance from './routes/_app.hrms.attendance'
import HRMSLeave from './routes/_app.hrms.leave'
import HRMSPayroll from './routes/_app.hrms.payroll'
import HRMSDepartments from './routes/_app.hrms.departments'
import HRMSDocuments from './routes/_app.hrms.documents'
import HRMSPerformance from './routes/_app.hrms.performance'
import HRMSReports from './routes/_app.hrms.reports'
import HRMSSettings from './routes/_app.hrms.settings'

// Recruitment Routes
import RecruitmentIndex from './routes/_app.recruitment.index'
import RecruitmentRequisitions from './routes/_app.recruitment.requisitions'
import RecruitmentJobs from './routes/_app.recruitment.jobs'
import RecruitmentCandidates from './routes/_app.recruitment.candidates'
import RecruitmentInterviews from './routes/_app.recruitment.interviews'
import RecruitmentAssessments from './routes/_app.recruitment.assessments'
import RecruitmentOffers from './routes/_app.recruitment.offers'
import RecruitmentOnboarding from './routes/_app.recruitment.onboarding'
import RecruitmentReports from './routes/_app.recruitment.reports'
import RecruitmentSettings from './routes/_app.recruitment.settings'

// Inventory Routes
import InventoryIndex from './routes/_app.inventory.index'
import InventoryWarehouses from './routes/_app.inventory.warehouses'
import InventoryProducts from './routes/_app.inventory.products'
import InventoryCategories from './routes/_app.inventory.categories'
import InventoryVendors from './routes/_app.inventory.vendors'
import InventoryPurchaseOrders from './routes/_app.inventory.purchase-orders'
import InventoryStock from './routes/_app.inventory.stock'
import InventoryAssignments from './routes/_app.inventory.assignments'
import InventoryAssets from './routes/_app.inventory.assets'
import InventoryReports from './routes/_app.inventory.reports'

// Marketing Routes
import MarketingIndex from './routes/_app.marketing.index'
import MarketingCampaigns from './routes/_app.marketing.campaigns'
import MarketingEmail from './routes/_app.marketing.email'
import MarketingSocial from './routes/_app.marketing.social'
import MarketingAutomation from './routes/_app.marketing.automation'
import MarketingAudience from './routes/_app.marketing.audience'
import MarketingFunnels from './routes/_app.marketing.funnels'
import MarketingAnalytics from './routes/_app.marketing.analytics'

// Automation Routes
import AutomationIndex from './routes/_app.automation.index'
import AutomationWorkflows from './routes/_app.automation.workflows'
import AutomationTriggers from './routes/_app.automation.triggers'
import AutomationLogs from './routes/_app.automation.logs'

// Finance Routes
import FinanceIndex from './routes/_app.finance.index'
import FinanceInvoices from './routes/_app.finance.invoices'
import FinanceExpenses from './routes/_app.finance.expenses'
import FinancePayments from './routes/_app.finance.payments'
import FinanceTransactions from './routes/_app.finance.transactions'
import FinanceCashFlow from './routes/_app.finance.cash-flow'
import FinanceRevenue from './routes/_app.finance.revenue'
import FinanceBudgets from './routes/_app.finance.budgets'

// Accounting Routes
import AccountingIndex from './routes/_app.accounting.index'
import AccountingLedger from './routes/_app.accounting.ledger'
import AccountingJournals from './routes/_app.accounting.journals'
import AccountingTax from './routes/_app.accounting.tax'
import AccountingReports from './routes/_app.accounting.reports'

// Reports Routes
import ReportsIndex from './routes/_app.reports.index'
import ReportsAnalytics from './routes/_app.reports.analytics'
import ReportsExports from './routes/_app.reports.exports'

// AI Assistant Routes
import AIAssistantIndex from './routes/_app.ai-assistant.index'
import AIAssistantHistory from './routes/_app.ai-assistant.history'

// Knowledge Base Routes
import KnowledgeBaseIndex from './routes/_app.knowledge-base.index'
import KnowledgeBaseArticles from './routes/_app.knowledge-base.articles'
import KnowledgeBaseCategories from './routes/_app.knowledge-base.categories'

// Settings Routes
import SettingsIndex from './routes/_app.settings.index'
import SettingsTeam from './routes/_app.settings.team'
import SettingsBilling from './routes/_app.settings.billing'
import SettingsIntegrations from './routes/_app.settings.integrations'
import SettingsNotifications from './routes/_app.settings.notifications'

function App() {
    return (
        <Router>
            <Routes>
                <Route element={<DashboardLayout />}>
                    <Route index element={<Home />} />

                    {/* CRM Routes */}
                    <Route path="/crm" element={<CRMIndex />} />
                    <Route path="/crm/leads" element={<CRMLeads />} />
                    <Route path="/crm/deals" element={<CRMDeals />} />
                    <Route path="/crm/customers" element={<CRMCustomers />} />
                    <Route path="/crm/pipeline" element={<CRMPipeline />} />
                    <Route path="/crm/activities" element={<CRMActivities />} />
                    <Route path="/crm/email" element={<CRMEmail />} />
                    <Route path="/crm/calls" element={<CRMCalls />} />
                    <Route path="/crm/inbox" element={<CRMInbox />} />
                    <Route path="/crm/settings" element={<CRMSettings />} />

                    {/* Tasks Routes */}
                    <Route path="/tasks" element={<TasksIndex />} />
                    <Route path="/tasks/list" element={<TasksList />} />
                    <Route path="/tasks/kanban" element={<TasksKanban />} />
                    <Route path="/tasks/calendar" element={<TasksCalendar />} />
                    <Route path="/tasks/timeline" element={<TasksTimeline />} />

                    {/* Projects Routes */}
                    <Route path="/projects" element={<ProjectsIndex />} />
                    <Route path="/projects/list" element={<ProjectsList />} />
                    <Route path="/projects/kanban" element={<ProjectsKanban />} />
                    <Route path="/projects/gantt" element={<ProjectsGantt />} />
                    <Route path="/projects/milestones" element={<ProjectsMilestones />} />

                    {/* Collaboration Routes */}
                    <Route path="/collaboration" element={<CollaborationIndex />} />
                    <Route path="/collaboration/channels" element={<CollaborationChannels />} />
                    <Route path="/collaboration/messages" element={<CollaborationMessages />} />
                    <Route path="/collaboration/meetings" element={<CollaborationMeetings />} />
                    <Route path="/collaboration/calls" element={<CollaborationCalls />} />

                    {/* HRMS Routes */}
                    <Route path="/hrms" element={<HRMSIndex />} />
                    <Route path="/hrms/employees" element={<HRMSEmployees />} />
                    <Route path="/hrms/attendance" element={<HRMSAttendance />} />
                    <Route path="/hrms/leave" element={<HRMSLeave />} />
                    <Route path="/hrms/payroll" element={<HRMSPayroll />} />
                    <Route path="/hrms/departments" element={<HRMSDepartments />} />
                    <Route path="/hrms/documents" element={<HRMSDocuments />} />
                    <Route path="/hrms/performance" element={<HRMSPerformance />} />
                    <Route path="/hrms/reports" element={<HRMSReports />} />
                    <Route path="/hrms/settings" element={<HRMSSettings />} />

                    {/* Recruitment Routes */}
                    <Route path="/recruitment" element={<RecruitmentIndex />} />
                    <Route path="/recruitment/requisitions" element={<RecruitmentRequisitions />} />
                    <Route path="/recruitment/jobs" element={<RecruitmentJobs />} />
                    <Route path="/recruitment/candidates" element={<RecruitmentCandidates />} />
                    <Route path="/recruitment/interviews" element={<RecruitmentInterviews />} />
                    <Route path="/recruitment/assessments" element={<RecruitmentAssessments />} />
                    <Route path="/recruitment/offers" element={<RecruitmentOffers />} />
                    <Route path="/recruitment/onboarding" element={<RecruitmentOnboarding />} />
                    <Route path="/recruitment/reports" element={<RecruitmentReports />} />
                    <Route path="/recruitment/settings" element={<RecruitmentSettings />} />

                    {/* Inventory Routes */}
                    <Route path="/inventory" element={<InventoryIndex />} />
                    <Route path="/inventory/warehouses" element={<InventoryWarehouses />} />
                    <Route path="/inventory/products" element={<InventoryProducts />} />
                    <Route path="/inventory/categories" element={<InventoryCategories />} />
                    <Route path="/inventory/vendors" element={<InventoryVendors />} />
                    <Route path="/inventory/purchase-orders" element={<InventoryPurchaseOrders />} />
                    <Route path="/inventory/stock" element={<InventoryStock />} />
                    <Route path="/inventory/assignments" element={<InventoryAssignments />} />
                    <Route path="/inventory/assets" element={<InventoryAssets />} />
                    <Route path="/inventory/reports" element={<InventoryReports />} />

                    {/* Marketing Routes */}
                    <Route path="/marketing" element={<MarketingIndex />} />
                    <Route path="/marketing/campaigns" element={<MarketingCampaigns />} />
                    <Route path="/marketing/email" element={<MarketingEmail />} />
                    <Route path="/marketing/social" element={<MarketingSocial />} />
                    <Route path="/marketing/automation" element={<MarketingAutomation />} />
                    <Route path="/marketing/audience" element={<MarketingAudience />} />
                    <Route path="/marketing/funnels" element={<MarketingFunnels />} />
                    <Route path="/marketing/analytics" element={<MarketingAnalytics />} />

                    {/* Automation Routes */}
                    <Route path="/automation" element={<AutomationIndex />} />
                    <Route path="/automation/workflows" element={<AutomationWorkflows />} />
                    <Route path="/automation/triggers" element={<AutomationTriggers />} />
                    <Route path="/automation/logs" element={<AutomationLogs />} />

                    {/* Finance Routes */}
                    <Route path="/finance" element={<FinanceIndex />} />
                    <Route path="/finance/invoices" element={<FinanceInvoices />} />
                    <Route path="/finance/expenses" element={<FinanceExpenses />} />
                    <Route path="/finance/payments" element={<FinancePayments />} />
                    <Route path="/finance/transactions" element={<FinanceTransactions />} />
                    <Route path="/finance/cash-flow" element={<FinanceCashFlow />} />
                    <Route path="/finance/revenue" element={<FinanceRevenue />} />
                    <Route path="/finance/budgets" element={<FinanceBudgets />} />

                    {/* Accounting Routes */}
                    <Route path="/accounting" element={<AccountingIndex />} />
                    <Route path="/accounting/ledger" element={<AccountingLedger />} />
                    <Route path="/accounting/journals" element={<AccountingJournals />} />
                    <Route path="/accounting/tax" element={<AccountingTax />} />
                    <Route path="/accounting/reports" element={<AccountingReports />} />

                    {/* Reports Routes */}
                    <Route path="/reports" element={<ReportsIndex />} />
                    <Route path="/reports/analytics" element={<ReportsAnalytics />} />
                    <Route path="/reports/exports" element={<ReportsExports />} />

                    {/* AI Assistant Routes */}
                    <Route path="/ai-assistant" element={<AIAssistantIndex />} />
                    <Route path="/ai-assistant/history" element={<AIAssistantHistory />} />

                    {/* Knowledge Base Routes */}
                    <Route path="/knowledge-base" element={<KnowledgeBaseIndex />} />
                    <Route path="/knowledge-base/articles" element={<KnowledgeBaseArticles />} />
                    <Route path="/knowledge-base/categories" element={<KnowledgeBaseCategories />} />

                    {/* Settings Routes */}
                    <Route path="/settings" element={<SettingsIndex />} />
                    <Route path="/settings/team" element={<SettingsTeam />} />
                    <Route path="/settings/billing" element={<SettingsBilling />} />
                    <Route path="/settings/integrations" element={<SettingsIntegrations />} />
                    <Route path="/settings/notifications" element={<SettingsNotifications />} />
                </Route>

                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    )
}

export default App
