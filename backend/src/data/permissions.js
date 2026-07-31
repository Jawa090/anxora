
/**
 * Per-module permission configuration for ANXORA.
 * This is the source of truth for both backend validation and frontend display.
 */
const MODULE_PERMISSIONS = {
  // Admin
  admin_dashboard: ["view", "create", "edit", "delete"],

  //Dashboard
  dashboard: ["view"],

  // Tasks & Projects
  tasks: ["view", "create", "edit", "delete", "assign"],
  projects: ["view", "create", "edit", "delete", "archive"],
  automation_workflows: ["view", "create", "edit", "delete", "run"],

  // Admin
  members: ["view"],
  admin_roles: ["view"],
  admin_settings: ["view"],

  // Collaboration
  calendar: ["view", "create", "edit", "delete"],
  drive: ["view", "upload", "edit", "delete", "share"],
  mail: ["view", "send", "delete"],
  unibox: ["view", "respond", "archive"],
  workgroups: ["view", "create", "edit", "delete", "manage_members"],

  // CRM
  leads: ["view", "create", "edit", "delete", "convert", "import", "export"],
  deals: ["view", "create", "edit", "delete", "export"],
  customers: ["view", "create", "edit", "delete"],
  contacts: ["view", "create", "edit", "delete", "import"],
  companies: ["view", "create", "edit", "delete"],
  signing_parties: ["view", "create", "delete", "approve"],
  sales: ["view", "export"],
  crm_analytics: ["view", "export"],

  // HRMS
  attendance: ["view", "clock_in", "clock_out", "manage_all"],
  employees: ["view", "create", "edit", "delete", "view_details"],
  leave: ["view", "request", "approve", "manage_balances"],
  payroll: ["view", "generate", "approve", "pay", "export"],
  hrms_notifications: ["view", "send", "manage_templates"],

  // Inventory
  products: ["view", "create", "edit", "delete"],
  stock: ["view", "adjust", "transfer", "view_history"],
  purchase_orders: ["view", "create", "edit", "delete", "approve", "receive"],
  vendors: ["view", "create", "edit", "delete"],
  warehouses: ["view", "create", "edit", "delete"],
  inventory_assignments: ["view", "assign", "return"],
  cars: ["view", "create", "edit", "delete"],

  // Marketing
  campaigns: ["view", "create", "edit", "delete", "send"],
  marketing_lists: ["view", "create", "edit", "delete"],
  marketing_forms: ["view", "create", "edit", "delete"],
  marketing_sequences: ["view", "create", "edit", "delete"],
  marketing_analytics: ["view", "export"],

  // Recruitment
  recruitment_requisitions: ["view", "create", "edit", "delete", "approve"],
  recruitment_candidates: ["view", "create", "edit", "delete", "score"],
  recruitment_interviews: ["view", "schedule", "feedback"],
  recruitment_offers: ["view", "create", "approve", "send"],
  recruitment_talent_pool: ["view", "add", "search"],
  recruitment_analytics: ["view", "export"],



};

const DASHBOARD_MODULES = [
  {
    category: "Admin_Dashboard",
    modules: [
      { id: "admin_dashboard", name: "Dashboard" },
    ]
  },
  {
    category: "Dashboard",
    modules: [
      { id: "dashboard", name: "Dashboard" },
    ]
  },
  {
    category: "Management",
    modules: [
      { id: "tasks", name: "Tasks" },
      { id: "projects", name: "Projects" },
      { id: "automation_workflows", name: "Automated Workflows" },
    ]
  },
  {
    category: "Collaboration",
    modules: [
      { id: "calendar", name: "Calendar" },
      { id: "drive", name: "Drive / Storage" },
      { id: "mail", name: "Email" },
      { id: "unibox", name: "Unibox" },
      { id: "workgroups", name: "Workgroups" },
    ]
  },
  {
    category: "CRM",
    modules: [
      { id: "leads", name: "Leads" },
      { id: "deals", name: "Deals" },
      { id: "customers", name: "Customers" },
      { id: "contacts", name: "Contacts" },
      { id: "companies", name: "Companies" },
      { id: "signing_parties", name: "E-Signatures" },
      { id: "sales", name: "Sales" },
      { id: "crm_analytics", name: "CRM Analytics" },
    ]
  },
  {
    category: "HRMS",
    modules: [
      { id: "attendance", name: "Attendance" },
      { id: "employees", name: "Employees" },
      { id: "leave", name: "Leave Management" },
      { id: "payroll", name: "Payroll" },
      { id: "hrms_notifications", name: "HRMS Notifications" },
    ]
  },
  {
    category: "Inventory",
    modules: [
      { id: "products", name: "Products" },
      { id: "stock", name: "Stock Management" },
      { id: "purchase_orders", name: "Purchase Orders" },
      { id: "vendors", name: "Vendors" },
      { id: "warehouses", name: "Warehouses" },
      { id: "inventory_assignments", name: "Assignments" },
      { id: "cars", name: "Car Inventory" },
    ]
  },
  {
    category: "Marketing",
    modules: [
      { id: "campaigns", name: "Campaigns" },
      { id: "marketing_lists", name: "Mailing Lists" },
      { id: "marketing_forms", name: "Forms" },
      { id: "marketing_sequences", name: "Sequences" },
      { id: "marketing_analytics", name: "Marketing Analytics" },
    ]
  },
  {
    category: "Recruitment",
    modules: [
      { id: "recruitment_requisitions", name: "Requisitions" },
      { id: "recruitment_candidates", name: "Candidates" },
      { id: "recruitment_interviews", name: "Interviews" },
      { id: "recruitment_offers", name: "Offers" },
      { id: "recruitment_talent_pool", name: "Talent Pool" },
      { id: "recruitment_analytics", name: "Recruitment Analytics" },
    ]
  },
];

module.exports = {
  MODULE_PERMISSIONS,
  DASHBOARD_MODULES
};
