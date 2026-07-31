import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route configuration
const routes = [
  // CRM
  { file: '_app.crm.index', module: 'crm' },
  { file: '_app.crm.leads', module: 'crm', slug: 'leads' },
  { file: '_app.crm.deals', module: 'crm', slug: 'deals' },
  { file: '_app.crm.customers', module: 'crm', slug: 'customers' },
  { file: '_app.crm.pipeline', module: 'crm', slug: 'pipeline' },
  { file: '_app.crm.activities', module: 'crm', slug: 'activities' },
  { file: '_app.crm.email', module: 'crm', slug: 'email' },
  { file: '_app.crm.calls', module: 'crm', slug: 'calls' },
  { file: '_app.crm.inbox', module: 'crm', slug: 'inbox' },
  { file: '_app.crm.settings', module: 'crm', slug: 'settings' },

  // Tasks
  { file: '_app.tasks.index', module: 'tasks' },
  { file: '_app.tasks.list', module: 'tasks', slug: 'list' },
  { file: '_app.tasks.kanban', module: 'tasks', slug: 'kanban' },
  { file: '_app.tasks.calendar', module: 'tasks', slug: 'calendar' },
  { file: '_app.tasks.timeline', module: 'tasks', slug: 'timeline' },

  // Projects
  { file: '_app.projects.index', module: 'projects' },
  { file: '_app.projects.list', module: 'projects', slug: 'list' },
  { file: '_app.projects.kanban', module: 'projects', slug: 'kanban' },
  { file: '_app.projects.gantt', module: 'projects', slug: 'gantt' },
  { file: '_app.projects.milestones', module: 'projects', slug: 'milestones' },

  // Collaboration
  { file: '_app.collaboration.index', module: 'collaboration' },
  { file: '_app.collaboration.channels', module: 'collaboration', slug: 'channels' },
  { file: '_app.collaboration.messages', module: 'collaboration', slug: 'messages' },
  { file: '_app.collaboration.meetings', module: 'collaboration', slug: 'meetings' },
  { file: '_app.collaboration.calls', module: 'collaboration', slug: 'calls' },

  // HRMS
  { file: '_app.hrms.index', module: 'hrms' },
  { file: '_app.hrms.employees', module: 'hrms', slug: 'employees' },
  { file: '_app.hrms.attendance', module: 'hrms', slug: 'attendance' },
  { file: '_app.hrms.leave', module: 'hrms', slug: 'leave' },
  { file: '_app.hrms.payroll', module: 'hrms', slug: 'payroll' },
  { file: '_app.hrms.departments', module: 'hrms', slug: 'departments' },
  { file: '_app.hrms.documents', module: 'hrms', slug: 'documents' },
  { file: '_app.hrms.performance', module: 'hrms', slug: 'performance' },
  { file: '_app.hrms.reports', module: 'hrms', slug: 'reports' },
  { file: '_app.hrms.settings', module: 'hrms', slug: 'settings' },

  // Recruitment
  { file: '_app.recruitment.index', module: 'recruitment' },
  { file: '_app.recruitment.requisitions', module: 'recruitment', slug: 'requisitions' },
  { file: '_app.recruitment.jobs', module: 'recruitment', slug: 'jobs' },
  { file: '_app.recruitment.candidates', module: 'recruitment', slug: 'candidates' },
  { file: '_app.recruitment.interviews', module: 'recruitment', slug: 'interviews' },
  { file: '_app.recruitment.assessments', module: 'recruitment', slug: 'assessments' },
  { file: '_app.recruitment.offers', module: 'recruitment', slug: 'offers' },
  { file: '_app.recruitment.onboarding', module: 'recruitment', slug: 'onboarding' },
  { file: '_app.recruitment.reports', module: 'recruitment', slug: 'reports' },
  { file: '_app.recruitment.settings', module: 'recruitment', slug: 'settings' },

  // Inventory
  { file: '_app.inventory.index', module: 'inventory' },
  { file: '_app.inventory.warehouses', module: 'inventory', slug: 'warehouses' },
  { file: '_app.inventory.products', module: 'inventory', slug: 'products' },
  { file: '_app.inventory.categories', module: 'inventory', slug: 'categories' },
  { file: '_app.inventory.vendors', module: 'inventory', slug: 'vendors' },
  { file: '_app.inventory.purchase-orders', module: 'inventory', slug: 'purchase-orders' },
  { file: '_app.inventory.stock', module: 'inventory', slug: 'stock' },
  { file: '_app.inventory.assignments', module: 'inventory', slug: 'assignments' },
  { file: '_app.inventory.assets', module: 'inventory', slug: 'assets' },
  { file: '_app.inventory.reports', module: 'inventory', slug: 'reports' },

  // Marketing
  { file: '_app.marketing.index', module: 'marketing' },
  { file: '_app.marketing.campaigns', module: 'marketing', slug: 'campaigns' },
  { file: '_app.marketing.email', module: 'marketing', slug: 'email' },
  { file: '_app.marketing.social', module: 'marketing', slug: 'social' },
  { file: '_app.marketing.automation', module: 'marketing', slug: 'automation' },
  { file: '_app.marketing.audience', module: 'marketing', slug: 'audience' },
  { file: '_app.marketing.funnels', module: 'marketing', slug: 'funnels' },
  { file: '_app.marketing.analytics', module: 'marketing', slug: 'analytics' },

  // Automation
  { file: '_app.automation.index', module: 'automation' },
  { file: '_app.automation.workflows', module: 'automation', slug: 'workflows' },
  { file: '_app.automation.triggers', module: 'automation', slug: 'triggers' },
  { file: '_app.automation.logs', module: 'automation', slug: 'logs' },

  // Finance
  { file: '_app.finance.index', module: 'finance' },
  { file: '_app.finance.invoices', module: 'finance', slug: 'invoices' },
  { file: '_app.finance.expenses', module: 'finance', slug: 'expenses' },
  { file: '_app.finance.payments', module: 'finance', slug: 'payments' },
  { file: '_app.finance.transactions', module: 'finance', slug: 'transactions' },
  { file: '_app.finance.cash-flow', module: 'finance', slug: 'cash-flow' },
  { file: '_app.finance.revenue', module: 'finance', slug: 'revenue' },
  { file: '_app.finance.budgets', module: 'finance', slug: 'budgets' },

  // Accounting
  { file: '_app.accounting.index', module: 'accounting' },
  { file: '_app.accounting.ledger', module: 'accounting', slug: 'ledger' },
  { file: '_app.accounting.journals', module: 'accounting', slug: 'journals' },
  { file: '_app.accounting.tax', module: 'accounting', slug: 'tax' },
  { file: '_app.accounting.reports', module: 'accounting', slug: 'reports' },

  // Reports
  { file: '_app.reports.index', module: 'reports' },
  { file: '_app.reports.analytics', module: 'reports', slug: 'analytics' },
  { file: '_app.reports.exports', module: 'reports', slug: 'exports' },

  // AI Assistant
  { file: '_app.ai-assistant.index', module: 'ai-assistant' },
  { file: '_app.ai-assistant.history', module: 'ai-assistant', slug: 'history' },

  // Knowledge Base
  { file: '_app.knowledge-base.index', module: 'knowledge-base' },
  { file: '_app.knowledge-base.articles', module: 'knowledge-base', slug: 'articles' },
  { file: '_app.knowledge-base.categories', module: 'knowledge-base', slug: 'categories' },

  // Settings
  { file: '_app.settings.index', module: 'settings' },
  { file: '_app.settings.team', module: 'settings', slug: 'team' },
  { file: '_app.settings.billing', module: 'settings', slug: 'billing' },
  { file: '_app.settings.integrations', module: 'settings', slug: 'integrations' },
  { file: '_app.settings.notifications', module: 'settings', slug: 'notifications' },
];

const routesDir = path.join(__dirname, 'src', 'routes');

// Generate route files
routes.forEach(route => {
  const slug = route.slug || '';
  const content = `import { ModulePlaceholder } from '@/components/module-placeholder'

export default function ${toPascalCase(route.file)}() {
  return <ModulePlaceholder moduleKey="${route.module}" subSlug="${slug}" />
}
`;

  const filePath = path.join(routesDir, `${route.file}.tsx`);
  fs.writeFileSync(filePath, content);
  console.log(`✓ Created ${route.file}.tsx`);
});

function toPascalCase(str) {
  return str
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

console.log(`\n✅ Generated ${routes.length} route files!`);
