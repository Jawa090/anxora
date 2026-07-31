import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { FileBarChart, Download, TrendingUp, TrendingDown, RefreshCw, CalendarDays, Users, ShieldAlert, Award, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import jsPDF from "jspdf";

const FinancialReports = () => {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("balance-sheet");
  const [loading, setLoading] = useState(false);

  // Filters State
  const [fiscalYear, setFiscalYear] = useState(`FY${new Date().getFullYear()}`);
  const [departmentId, setDepartmentId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [vendorId, setVendorId] = useState("all");

  // Lookups lists
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Report Data States
  const [balanceSheet, setBalanceSheet] = useState<any>({ assets: [], liabilities: [], equity: [] });
  const [incomeStatement, setIncomeStatement] = useState<any>({ revenues: [], expenses: [] });
  const [cashFlow, setCashFlow] = useState<any>({ operatingActivities: [], investingActivities: [], financingActivities: [], netChange: 0 });
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [generalLedger, setGeneralLedger] = useState<any[]>([]);
  const [customerAging, setCustomerAging] = useState<any[]>([]);
  const [vendorAging, setVendorAging] = useState<any[]>([]);
  const [expensesReport, setExpensesReport] = useState<any[]>([]);
  const [budgetsReport, setBudgetsReport] = useState<any[]>([]);

  const loadLookups = async () => {
    try {
      const [deptRes, projRes, custRes, vendRes] = await Promise.all([
        api.get<any[]>('/finance/setup/lookups/departments').catch(() => []),
        api.get<any[]>('/projects').catch(() => []),
        api.get<any[]>('/customers').catch(() => []),
        api.get<any[]>('/vendors').catch(() => [])
      ]);
      setDepartments(deptRes || []);
      setProjects((projRes as any)?.data || (projRes as any)?.projects || projRes || []);
      setCustomers((custRes as any)?.data || custRes || []);
      setVendors((vendRes as any)?.data || vendRes || []);
    } catch (err) {
      console.log("Error loading lookups", err);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (fiscalYear !== 'all') queryParams.append('fiscal_year', fiscalYear);
    if (departmentId !== 'all') queryParams.append('department_id', departmentId);
    if (projectId !== 'all') queryParams.append('project_id', projectId);
    if (customerId !== 'all') queryParams.append('customer_id', customerId);
    if (vendorId !== 'all') queryParams.append('vendor_id', vendorId);

    const queryStr = `?${queryParams.toString()}`;

    try {
      if (activeTab === "balance-sheet") {
        const res = await api.get<any>(`/finance/reports/balance-sheet${queryStr}`);
        setBalanceSheet(res || { assets: [], liabilities: [], equity: [] });
      } else if (activeTab === "income-statement") {
        const res = await api.get<any>(`/finance/reports/income-statement${queryStr}`);
        setIncomeStatement(res || { revenues: [], expenses: [] });
      } else if (activeTab === "cash-flow") {
        const res = await api.get<any>(`/finance/reports/cash-flow${queryStr}`);
        setCashFlow(res || { operatingActivities: [], investingActivities: [], financingActivities: [], netChange: 0 });
      } else if (activeTab === "trial-balance") {
        const res = await api.get<any[]>(`/finance/reports/trial-balance${queryStr}`);
        setTrialBalance(res || []);
      } else if (activeTab === "general-ledger") {
        const res = await api.get<any[]>(`/finance/reports/general-ledger${queryStr}`);
        setGeneralLedger(res || []);
      } else if (activeTab === "customer-aging") {
        const res = await api.get<any[]>(`/finance/reports/customer-aging${queryStr}`);
        setCustomerAging(res || []);
      } else if (activeTab === "vendor-aging") {
        const res = await api.get<any[]>(`/finance/reports/vendor-aging${queryStr}`);
        setVendorAging(res || []);
      } else if (activeTab === "expense-report") {
        const res = await api.get<any[]>(`/finance/reports/expenses${queryStr}`);
        setExpensesReport(res || []);
      } else if (activeTab === "budget-report") {
        const res = await api.get<any[]>(`/finance/reports/budgets${queryStr}`);
        setBudgetsReport(res || []);
      }
    } catch (err: any) {
      toast({ title: "Failed to generate report", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, fiscalYear, departmentId, projectId, customerId, vendorId]);

  const handleExportPDF = async () => {
    try {
      toast({ title: "Exporting PDF...", description: "Generating comprehensive financial report..." });

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (fiscalYear !== 'all') queryParams.append('fiscal_year', fiscalYear);
      if (departmentId !== 'all') queryParams.append('department_id', departmentId);
      if (projectId !== 'all') queryParams.append('project_id', projectId);
      if (customerId !== 'all') queryParams.append('customer_id', customerId);
      if (vendorId !== 'all') queryParams.append('vendor_id', vendorId);
      const queryStr = `?${queryParams.toString()}`;

      // Fetch all report data in parallel
      const [
        balanceSheetRes,
        incomeStatementRes,
        cashFlowRes,
        trialBalanceRes,
        generalLedgerRes,
        customerAgingRes,
        vendorAgingRes,
        expensesRes,
        budgetsRes
      ] = await Promise.all([
        api.get<any>(`/finance/reports/balance-sheet${queryStr}`).catch(() => null),
        api.get<any>(`/finance/reports/income-statement${queryStr}`).catch(() => null),
        api.get<any>(`/finance/reports/cash-flow${queryStr}`).catch(() => null),
        api.get<any[]>(`/finance/reports/trial-balance${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/general-ledger${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/customer-aging${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/vendor-aging${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/expenses${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/budgets${queryStr}`).catch(() => [])
      ]);

      // Create HTML content for PDF with all tabs
      let htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
              .page { page-break-after: always; margin-bottom: 30px; }
              .header { background: #f0f0f0; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
              .title { font-size: 20px; font-weight: bold; color: #1a1a1a; margin-bottom: 5px; }
              .subtitle { font-size: 12px; color: #666; margin-bottom: 10px; }
              .section-title { font-size: 16px; font-weight: bold; color: #2c3e50; margin-top: 15px; margin-bottom: 10px; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              th { background: #ecf0f1; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #bdc3c7; }
              td { padding: 8px; border: 1px solid #ecf0f1; }
              tr:nth-child(even) { background: #f9f9f9; }
              .amount { text-align: right; font-weight: bold; }
              .total-row { background: #ecf0f1; font-weight: bold; }
              .meta { font-size: 10px; color: #999; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ecf0f1; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="header">
                <div class="title">Financial Report - All Tabs</div>
                <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
                <div class="subtitle">Fiscal Year: ${fiscalYear}</div>
              </div>
      `;

      // Balance Sheet
      if (balanceSheetRes && (balanceSheetRes.assets || balanceSheetRes.liabilities || balanceSheetRes.equity)) {
        htmlContent += `
          <div class="section-title">Balance Sheet</div>
          <h4>Assets</h4>
          <table>
            <tr><th>Account</th><th class="amount">Amount</th></tr>
        `;
        if (balanceSheetRes.assets && Array.isArray(balanceSheetRes.assets)) {
          balanceSheetRes.assets.forEach((asset: any) => {
            htmlContent += `<tr><td>${asset.account || asset.name || ''}</td><td class="amount">$${parseFloat(asset.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;

        htmlContent += `
          <h4>Liabilities & Equity</h4>
          <table>
            <tr><th>Account</th><th class="amount">Amount</th></tr>
        `;
        if (balanceSheetRes.liabilities && Array.isArray(balanceSheetRes.liabilities)) {
          balanceSheetRes.liabilities.forEach((liability: any) => {
            htmlContent += `<tr><td>${liability.account || liability.name || ''}</td><td class="amount">$${parseFloat(liability.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        if (balanceSheetRes.equity && Array.isArray(balanceSheetRes.equity)) {
          balanceSheetRes.equity.forEach((eq: any) => {
            htmlContent += `<tr><td>${eq.account || eq.name || ''}</td><td class="amount">$${parseFloat(eq.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;
      }

      // Income Statement
      if (incomeStatementRes && (incomeStatementRes.revenues || incomeStatementRes.expenses)) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Income Statement</div>`;
        htmlContent += `
          <h4>Revenues</h4>
          <table>
            <tr><th>Account</th><th class="amount">Amount</th></tr>
        `;
        if (incomeStatementRes.revenues && Array.isArray(incomeStatementRes.revenues)) {
          incomeStatementRes.revenues.forEach((rev: any) => {
            htmlContent += `<tr><td>${rev.account || rev.name || ''}</td><td class="amount">$${parseFloat(rev.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;

        htmlContent += `
          <h4>Expenses</h4>
          <table>
            <tr><th>Account</th><th class="amount">Amount</th></tr>
        `;
        if (incomeStatementRes.expenses && Array.isArray(incomeStatementRes.expenses)) {
          incomeStatementRes.expenses.forEach((exp: any) => {
            htmlContent += `<tr><td>${exp.account || exp.name || ''}</td><td class="amount">$${parseFloat(exp.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;
      }

      // Cash Flow Statement
      if (cashFlowRes && (cashFlowRes.operatingActivities || cashFlowRes.investingActivities || cashFlowRes.financingActivities)) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Cash Flow Statement</div>`;
        htmlContent += `
          <h4>Operating Activities</h4>
          <table>
            <tr><th>Description</th><th class="amount">Amount</th></tr>
        `;
        if (cashFlowRes.operatingActivities && Array.isArray(cashFlowRes.operatingActivities)) {
          cashFlowRes.operatingActivities.forEach((item: any) => {
            htmlContent += `<tr><td>${item.description || ''}</td><td class="amount">$${parseFloat(item.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;

        htmlContent += `
          <h4>Investing Activities</h4>
          <table>
            <tr><th>Description</th><th class="amount">Amount</th></tr>
        `;
        if (cashFlowRes.investingActivities && Array.isArray(cashFlowRes.investingActivities)) {
          cashFlowRes.investingActivities.forEach((item: any) => {
            htmlContent += `<tr><td>${item.description || ''}</td><td class="amount">$${parseFloat(item.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;

        htmlContent += `
          <h4>Financing Activities</h4>
          <table>
            <tr><th>Description</th><th class="amount">Amount</th></tr>
        `;
        if (cashFlowRes.financingActivities && Array.isArray(cashFlowRes.financingActivities)) {
          cashFlowRes.financingActivities.forEach((item: any) => {
            htmlContent += `<tr><td>${item.description || ''}</td><td class="amount">$${parseFloat(item.amount || 0).toLocaleString()}</td></tr>`;
          });
        }
        htmlContent += `</table>`;
        htmlContent += `<div class="total-row" style="padding: 10px; margin: 10px 0;">Net Cash Change: $${parseFloat(cashFlowRes.netChange || 0).toLocaleString()}</div>`;
      }

      // Trial Balance
      if (trialBalanceRes && Array.isArray(trialBalanceRes) && trialBalanceRes.length > 0) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Trial Balance</div>`;
        htmlContent += `
          <table>
            <tr><th>Account</th><th class="amount">Debit</th><th class="amount">Credit</th></tr>
        `;
        trialBalanceRes.forEach((row: any) => {
          htmlContent += `
            <tr>
              <td>${row.account || row.name || ''}</td>
              <td class="amount">$${parseFloat(row.debit || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.credit || 0).toLocaleString()}</td>
            </tr>
          `;
        });
        htmlContent += `</table>`;
      }

      // General Ledger
      if (generalLedgerRes && Array.isArray(generalLedgerRes) && generalLedgerRes.length > 0) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">General Ledger</div>`;
        htmlContent += `
          <table style="font-size: 12px;">
            <tr><th>Account</th><th>Date</th><th>Description</th><th class="amount">Debit</th><th class="amount">Credit</th><th class="amount">Balance</th></tr>
        `;
        generalLedgerRes.forEach((row: any) => {
          htmlContent += `
            <tr>
              <td>${row.account || row.name || ''}</td>
              <td>${row.date || ''}</td>
              <td>${row.description || ''}</td>
              <td class="amount">$${parseFloat(row.debit || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.credit || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.balance || 0).toLocaleString()}</td>
            </tr>
          `;
        });
        htmlContent += `</table>`;
      }

      // Customer Aging
      if (customerAgingRes && Array.isArray(customerAgingRes) && customerAgingRes.length > 0) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Customer Aging Report</div>`;
        htmlContent += `
          <table>
            <tr><th>Customer</th><th class="amount">Current</th><th class="amount">30 Days</th><th class="amount">60 Days</th><th class="amount">90+ Days</th><th class="amount">Total</th></tr>
        `;
        customerAgingRes.forEach((row: any) => {
          htmlContent += `
            <tr>
              <td>${row.customer || row.name || ''}</td>
              <td class="amount">$${parseFloat(row.current || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.days30 || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.days60 || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.days90 || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.total || 0).toLocaleString()}</td>
            </tr>
          `;
        });
        htmlContent += `</table>`;
      }

      // Vendor Aging
      if (vendorAgingRes && Array.isArray(vendorAgingRes) && vendorAgingRes.length > 0) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Vendor Aging Report</div>`;
        htmlContent += `
          <table>
            <tr><th>Vendor</th><th class="amount">Current</th><th class="amount">30 Days</th><th class="amount">60 Days</th><th class="amount">90+ Days</th><th class="amount">Total</th></tr>
        `;
        vendorAgingRes.forEach((row: any) => {
          htmlContent += `
            <tr>
              <td>${row.vendor || row.name || ''}</td>
              <td class="amount">$${parseFloat(row.current || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.days30 || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.days60 || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.days90 || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.total || 0).toLocaleString()}</td>
            </tr>
          `;
        });
        htmlContent += `</table>`;
      }

      // Expenses Report
      if (expensesRes && Array.isArray(expensesRes) && expensesRes.length > 0) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Expenses Report</div>`;
        htmlContent += `
          <table>
            <tr><th>Category</th><th>Department</th><th class="amount">Amount</th></tr>
        `;
        expensesRes.forEach((row: any) => {
          htmlContent += `
            <tr>
              <td>${row.category || row.name || ''}</td>
              <td>${row.department || ''}</td>
              <td class="amount">$${parseFloat(row.amount || 0).toLocaleString()}</td>
            </tr>
          `;
        });
        htmlContent += `</table>`;
      }

      // Budget Report
      if (budgetsRes && Array.isArray(budgetsRes) && budgetsRes.length > 0) {
        htmlContent += `<div style="page-break-before: always;"></div><div class="section-title">Budget Report</div>`;
        htmlContent += `
          <table>
            <tr><th>Department</th><th class="amount">Budget</th><th class="amount">Actual</th><th class="amount">Variance</th></tr>
        `;
        budgetsRes.forEach((row: any) => {
          const variance = parseFloat(row.budget || 0) - parseFloat(row.actual || 0);
          htmlContent += `
            <tr>
              <td>${row.department || row.name || ''}</td>
              <td class="amount">$${parseFloat(row.budget || 0).toLocaleString()}</td>
              <td class="amount">$${parseFloat(row.actual || 0).toLocaleString()}</td>
              <td class="amount">$${variance.toLocaleString()}</td>
            </tr>
          `;
        });
        htmlContent += `</table>`;
      }

      htmlContent += `
            <div class="meta">
              <strong>End of Report</strong><br>
              This report contains financial data from all report tabs.<br>
              For questions or clarifications, please contact Finance Department.
            </div>
          </body>
        </html>
      `;

      // Generate PDF using jsPDF native methods
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;

      // Helper function to draw a simple table
      const drawTable = (headers: string[], rows: string[][], startY: number) => {
        const colWidths: number[] = [];
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - 2 * margin;

        // Calculate column widths (equal distribution)
        const colWidth = contentWidth / headers.length;
        for (let i = 0; i < headers.length; i++) {
          colWidths.push(colWidth);
        }

        let currentY = startY;
        const rowHeight = 7;
        const headerHeight = 8;

        // Draw header with white text
        pdf.setFillColor(80, 80, 80);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(8);

        let currentX = margin;
        headers.forEach((header, idx) => {
          pdf.rect(currentX, currentY, colWidths[idx], headerHeight, 'F');
          pdf.text(header, currentX + 1, currentY + 5, { maxWidth: colWidths[idx] - 2 });
          currentX += colWidths[idx];
        });
        currentY += headerHeight;

        // Draw rows with black text on light background
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        rows.forEach((row, rowIdx) => {
          // Check if we need a new page
          if (currentY > 260) {
            pdf.addPage();
            currentY = 20;
          }

          // Draw row cells
          currentX = margin;
          row.forEach((cell, colIdx) => {
            // Alternate row colors - light colors only
            if (rowIdx % 2 === 0) {
              pdf.setFillColor(240, 240, 240);
            } else {
              pdf.setFillColor(255, 255, 255);
            }
            pdf.rect(currentX, currentY, colWidths[colIdx], rowHeight, 'F');

            // Draw cell border
            pdf.setDrawColor(180, 180, 180);
            pdf.rect(currentX, currentY, colWidths[colIdx], rowHeight);

            // Draw cell text (right align for amounts, left align for others)
            pdf.setTextColor(0, 0, 0);
            const isAmount = cell.startsWith('$');
            pdf.text(cell, isAmount ? currentX + colWidths[colIdx] - 2 : currentX + 1, currentY + 5, {
              maxWidth: colWidths[colIdx] - 2,
              align: isAmount ? 'right' : 'left'
            });

            currentX += colWidths[colIdx];
          });
          currentY += rowHeight;
        });

        return currentY + 5;
      };

      // Helper function to add a title
      const addTitle = (title: string) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(title, 15, yPosition);
        yPosition += 10;
      };

      // Add title page info
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Financial Report - All Tabs', 15, yPosition);
      yPosition += 10;
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, yPosition);
      yPosition += 6;
      pdf.text(`Fiscal Year: ${fiscalYear}`, 15, yPosition);
      yPosition += 15;

      // Balance Sheet - extract section names from keys
      if (balanceSheetRes && Object.keys(balanceSheetRes).length > 0) {
        addTitle('Balance Sheet');

        Object.entries(balanceSheetRes).forEach(([sectionKey, sectionData]: [string, any]) => {
          if (Array.isArray(sectionData) && sectionData.length > 0) {
            const sectionRows = sectionData.map((item: any) => [
              item.code || item.account_code || '',
              item.name || item.account_name || '',
              `$${parseFloat(item.balance || item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]);
            yPosition = drawTable(['Code', 'Account Name', 'Amount'], sectionRows, yPosition);
            yPosition += 5;
          }
        });
      }

      // Income Statement - extract section names from keys
      if (incomeStatementRes && Object.keys(incomeStatementRes).length > 0) {
        addTitle('Income Statement');

        Object.entries(incomeStatementRes).forEach(([sectionKey, sectionData]: [string, any]) => {
          if (Array.isArray(sectionData) && sectionData.length > 0) {
            const sectionRows = sectionData.map((item: any) => [
              item.code || item.account_code || '',
              item.name || item.account_name || '',
              `$${parseFloat(item.balance || item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]);
            yPosition = drawTable(['Code', 'Account Name', 'Amount'], sectionRows, yPosition);
            yPosition += 5;
          }
        });
      }

      // Cash Flow Statement - extract section names from keys
      if (cashFlowRes && Object.keys(cashFlowRes).length > 0) {
        addTitle('Cash Flow Statement');

        Object.entries(cashFlowRes).forEach(([sectionKey, sectionData]: [string, any]) => {
          // Skip netChange as it's not an array
          if (Array.isArray(sectionData) && sectionData.length > 0) {
            const sectionRows = sectionData.map((item: any) => [
              item.code || item.activity_code || '',
              item.name || item.description || '',
              `$${parseFloat(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]);
            yPosition = drawTable(['Code', 'Description', 'Amount'], sectionRows, yPosition);
            yPosition += 5;
          } else if (sectionKey === 'netChange' && typeof sectionData === 'number') {
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Net Change: $${sectionData.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 15, yPosition);
            yPosition += 8;
          }
        });
      }

      // Trial Balance
      if (trialBalanceRes && Array.isArray(trialBalanceRes) && trialBalanceRes.length > 0) {
        addTitle('Trial Balance');
        const trialData = trialBalanceRes.map((row: any) => [
          row.account_code || row.code || '',
          row.account_name || row.name || '',
          row.account_type || row.type || '',
          `$${parseFloat(row.total_debit || row.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.total_credit || row.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ]);
        yPosition = drawTable(['Code', 'Account Name', 'Type', 'Debit', 'Credit'], trialData, yPosition);
      }

      // General Ledger
      if (generalLedgerRes && Array.isArray(generalLedgerRes) && generalLedgerRes.length > 0) {
        addTitle('General Ledger');
        const ledgerData = generalLedgerRes.map((row: any) => [
          new Date(row.entry_date || row.date).toLocaleDateString(),
          row.entry_number || row.je_number || '',
          row.account_name || row.account || '',
          row.description || '',
          `$${parseFloat(row.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ]);
        yPosition = drawTable(['Date', 'JE #', 'Account', 'Description', 'Debit', 'Credit'], ledgerData, yPosition);
      }

      // Customer Aging
      if (customerAgingRes && Array.isArray(customerAgingRes) && customerAgingRes.length > 0) {
        addTitle('Customer Aging Report');
        const customerData = customerAgingRes.map((row: any) => [
          row.customerName || row.customer || row.name || '',
          row.invoiceNumber || '',
          `$${parseFloat(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.days30to60 || row.days30 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.days61to90 || row.days60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.over90 || row.days90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ]);
        yPosition = drawTable(['Customer', 'Invoice', 'Total', '0-30', '31-60', '61-90', '90+'], customerData, yPosition);
      }

      // Vendor Aging
      if (vendorAgingRes && Array.isArray(vendorAgingRes) && vendorAgingRes.length > 0) {
        addTitle('Vendor Aging Report');
        const vendorData = vendorAgingRes.map((row: any) => [
          row.vendorName || row.vendor || row.name || '',
          row.invoiceNumber || '',
          `$${parseFloat(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.days30to60 || row.days30 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.days61to90 || row.days60 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `$${parseFloat(row.over90 || row.days90 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ]);
        yPosition = drawTable(['Vendor', 'Bill #', 'Total', '0-30', '31-60', '61-90', '90+'], vendorData, yPosition);
      }

      // Expenses Report
      if (expensesRes && Array.isArray(expensesRes) && expensesRes.length > 0) {
        addTitle('Expenses Report');
        const expensesData = expensesRes.map((row: any) => [
          row.claim_id || row.id || '',
          row.claimant || row.employee || row.name || '',
          row.category || row.expense_category || '',
          row.department || '',
          `$${parseFloat(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          row.status || ''
        ]);
        yPosition = drawTable(['ID', 'Claimant', 'Category', 'Department', 'Amount', 'Status'], expensesData, yPosition);
      }

      // Budget Report
      if (budgetsRes && Array.isArray(budgetsRes) && budgetsRes.length > 0) {
        addTitle('Budget Report');
        const budgetData = budgetsRes.map((row: any) => {
          const budgetAmt = parseFloat(row.budget || 0);
          const actualAmt = parseFloat(row.actual || 0);
          const variance = budgetAmt - actualAmt;
          return [
            row.project || row.project_name || '',
            row.department || row.department_name || '',
            `$${budgetAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `$${actualAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `$${variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          ];
        });
        yPosition = drawTable(['Project', 'Department', 'Budget', 'Actual', 'Variance'], budgetData, yPosition);
      }

      // Save PDF
      pdf.save(`Financial_Report_AllTabs_${new Date().toISOString().split('T')[0]}.pdf`);

      toast({ title: "PDF Export successful", description: "Comprehensive financial report generated and downloaded." });
    } catch (err: any) {
      toast({ title: "PDF Export failed", description: err.message, variant: "destructive" });
    }
  };

  const handleExportAllDataCSV = async () => {
    try {
      toast({ title: "Exporting...", description: "Fetching all report data..." });

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (fiscalYear !== 'all') queryParams.append('fiscal_year', fiscalYear);
      if (departmentId !== 'all') queryParams.append('department_id', departmentId);
      if (projectId !== 'all') queryParams.append('project_id', projectId);
      if (customerId !== 'all') queryParams.append('customer_id', customerId);
      if (vendorId !== 'all') queryParams.append('vendor_id', vendorId);
      const queryStr = `?${queryParams.toString()}`;

      // Fetch all report data in parallel
      const [
        balanceSheetRes,
        incomeStatementRes,
        cashFlowRes,
        trialBalanceRes,
        generalLedgerRes,
        customerAgingRes,
        vendorAgingRes,
        expensesRes,
        budgetsRes
      ] = await Promise.all([
        api.get<any>(`/finance/reports/balance-sheet${queryStr}`).catch(() => null),
        api.get<any>(`/finance/reports/income-statement${queryStr}`).catch(() => null),
        api.get<any>(`/finance/reports/cash-flow${queryStr}`).catch(() => null),
        api.get<any[]>(`/finance/reports/trial-balance${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/general-ledger${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/customer-aging${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/vendor-aging${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/expenses${queryStr}`).catch(() => []),
        api.get<any[]>(`/finance/reports/budgets${queryStr}`).catch(() => [])
      ]);

      let csvContent = "Financial Report - All Tabs Export\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `Fiscal Year: ${fiscalYear}\n\n`;

      // Balance Sheet
      if (balanceSheetRes && (balanceSheetRes.assets || balanceSheetRes.liabilities || balanceSheetRes.equity)) {
        csvContent += "BALANCE SHEET\n";
        csvContent += "ASSETS\n";
        csvContent += "Account,Amount\n";
        if (balanceSheetRes.assets && Array.isArray(balanceSheetRes.assets)) {
          balanceSheetRes.assets.forEach((asset: any) => {
            csvContent += `"${asset.account || asset.name || ''}","${parseFloat(asset.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += "\nLIABILITIES & EQUITY\n";
        csvContent += "Account,Amount\n";
        if (balanceSheetRes.liabilities && Array.isArray(balanceSheetRes.liabilities)) {
          balanceSheetRes.liabilities.forEach((liability: any) => {
            csvContent += `"${liability.account || liability.name || ''}","${parseFloat(liability.amount || 0).toLocaleString()}"\n`;
          });
        }
        if (balanceSheetRes.equity && Array.isArray(balanceSheetRes.equity)) {
          balanceSheetRes.equity.forEach((eq: any) => {
            csvContent += `"${eq.account || eq.name || ''}","${parseFloat(eq.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += "\n\n";
      }

      // Income Statement
      if (incomeStatementRes && (incomeStatementRes.revenues || incomeStatementRes.expenses)) {
        csvContent += "INCOME STATEMENT\n";
        csvContent += "REVENUES\n";
        csvContent += "Account,Amount\n";
        if (incomeStatementRes.revenues && Array.isArray(incomeStatementRes.revenues)) {
          incomeStatementRes.revenues.forEach((rev: any) => {
            csvContent += `"${rev.account || rev.name || ''}","${parseFloat(rev.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += "\nEXPENSES\n";
        csvContent += "Account,Amount\n";
        if (incomeStatementRes.expenses && Array.isArray(incomeStatementRes.expenses)) {
          incomeStatementRes.expenses.forEach((exp: any) => {
            csvContent += `"${exp.account || exp.name || ''}","${parseFloat(exp.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += "\n\n";
      }

      // Cash Flow
      if (cashFlowRes && (cashFlowRes.operatingActivities || cashFlowRes.investingActivities || cashFlowRes.financingActivities)) {
        csvContent += "CASH FLOW STATEMENT\n";
        csvContent += "Operating Activities\n";
        if (cashFlowRes.operatingActivities && Array.isArray(cashFlowRes.operatingActivities)) {
          cashFlowRes.operatingActivities.forEach((item: any) => {
            csvContent += `"${item.description || ''}","${parseFloat(item.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += "Investing Activities\n";
        if (cashFlowRes.investingActivities && Array.isArray(cashFlowRes.investingActivities)) {
          cashFlowRes.investingActivities.forEach((item: any) => {
            csvContent += `"${item.description || ''}","${parseFloat(item.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += "Financing Activities\n";
        if (cashFlowRes.financingActivities && Array.isArray(cashFlowRes.financingActivities)) {
          cashFlowRes.financingActivities.forEach((item: any) => {
            csvContent += `"${item.description || ''}","${parseFloat(item.amount || 0).toLocaleString()}"\n`;
          });
        }
        csvContent += `\nNet Cash Change,"${parseFloat(cashFlowRes.netChange || 0).toLocaleString()}"\n\n`;
      }

      // Trial Balance
      if (trialBalanceRes && Array.isArray(trialBalanceRes) && trialBalanceRes.length > 0) {
        csvContent += "TRIAL BALANCE\n";
        csvContent += "Account,Debit,Credit\n";
        trialBalanceRes.forEach((row: any) => {
          csvContent += `"${row.account || row.name || ''}","${parseFloat(row.debit || 0).toLocaleString()}","${parseFloat(row.credit || 0).toLocaleString()}"\n`;
        });
        csvContent += "\n\n";
      }

      // General Ledger
      if (generalLedgerRes && Array.isArray(generalLedgerRes) && generalLedgerRes.length > 0) {
        csvContent += "GENERAL LEDGER\n";
        csvContent += "Account,Date,Description,Debit,Credit,Balance\n";
        generalLedgerRes.forEach((row: any) => {
          csvContent += `"${row.account || row.name || ''}","${row.date || ''}","${row.description || ''}","${parseFloat(row.debit || 0).toLocaleString()}","${parseFloat(row.credit || 0).toLocaleString()}","${parseFloat(row.balance || 0).toLocaleString()}"\n`;
        });
        csvContent += "\n\n";
      }

      // Customer Aging
      if (customerAgingRes && Array.isArray(customerAgingRes) && customerAgingRes.length > 0) {
        csvContent += "CUSTOMER AGING REPORT\n";
        csvContent += "Customer,Current,30 Days,60 Days,90+ Days,Total\n";
        customerAgingRes.forEach((row: any) => {
          csvContent += `"${row.customer || row.name || ''}","${parseFloat(row.current || 0).toLocaleString()}","${parseFloat(row.days30 || 0).toLocaleString()}","${parseFloat(row.days60 || 0).toLocaleString()}","${parseFloat(row.days90 || 0).toLocaleString()}","${parseFloat(row.total || 0).toLocaleString()}"\n`;
        });
        csvContent += "\n\n";
      }

      // Vendor Aging
      if (vendorAgingRes && Array.isArray(vendorAgingRes) && vendorAgingRes.length > 0) {
        csvContent += "VENDOR AGING REPORT\n";
        csvContent += "Vendor,Current,30 Days,60 Days,90+ Days,Total\n";
        vendorAgingRes.forEach((row: any) => {
          csvContent += `"${row.vendor || row.name || ''}","${parseFloat(row.current || 0).toLocaleString()}","${parseFloat(row.days30 || 0).toLocaleString()}","${parseFloat(row.days60 || 0).toLocaleString()}","${parseFloat(row.days90 || 0).toLocaleString()}","${parseFloat(row.total || 0).toLocaleString()}"\n`;
        });
        csvContent += "\n\n";
      }

      // Expenses Report
      if (expensesRes && Array.isArray(expensesRes) && expensesRes.length > 0) {
        csvContent += "EXPENSES REPORT\n";
        csvContent += "Category,Amount,Department\n";
        expensesRes.forEach((row: any) => {
          csvContent += `"${row.category || row.name || ''}","${parseFloat(row.amount || 0).toLocaleString()}","${row.department || ''}"\n`;
        });
        csvContent += "\n\n";
      }

      // Budget Report
      if (budgetsRes && Array.isArray(budgetsRes) && budgetsRes.length > 0) {
        csvContent += "BUDGET REPORT\n";
        csvContent += "Department,Budget,Actual,Variance\n";
        budgetsRes.forEach((row: any) => {
          const variance = (parseFloat(row.budget || 0) - parseFloat(row.actual || 0)).toLocaleString();
          csvContent += `"${row.department || row.name || ''}","${parseFloat(row.budget || 0).toLocaleString()}","${parseFloat(row.actual || 0).toLocaleString()}","${variance}"\n`;
        });
      }

      // Create and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Financial_Report_AllTabs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: "Export successful", description: "All financial report data exported to CSV." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card/30 backdrop-blur-md p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Financial Audit & Statements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Read-only financial auditing ledgers, balance sheets, and performance matrices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportPDF} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportAllDataCSV} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="border-border hover:bg-muted/50 rounded-xl text-xs font-semibold">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-5 shadow-sm">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-emerald-500" /> Filter Criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="space-y-1">
            <Label className="font-bold text-[10px]">Fiscal Year</Label>
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]"><SelectValue placeholder="Select FY" /></SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Fiscal Years</SelectItem>
                <SelectItem value="FY2025">FY2025</SelectItem>
                <SelectItem value="FY2026">FY2026</SelectItem>
                <SelectItem value="FY2027">FY2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-bold text-[10px]">Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-bold text-[10px]">Project Scope</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-bold text-[10px]">Client / Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]"><SelectValue placeholder="All Customers" /></SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name || c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-bold text-[10px]">Supplier / Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="rounded-xl h-8 text-[11px]"><SelectValue placeholder="All Vendors" /></SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        {/* Active Filters Badges */}
        {(fiscalYear !== 'all' || departmentId !== 'all' || projectId !== 'all' || customerId !== 'all' || vendorId !== 'all') && (
          <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-border/80 text-[10px]">
            <span className="font-bold text-muted-foreground mr-1 uppercase tracking-wider">Active Filters:</span>

            {fiscalYear !== 'all' && (
              <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                Fiscal Year: {fiscalYear}
                <button onClick={() => setFiscalYear('all')} className="hover:text-emerald-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {departmentId !== 'all' && (
              <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">
                Department: {departments.find(d => d.id === departmentId)?.name || departmentId}
                <button onClick={() => setDepartmentId('all')} className="hover:text-blue-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {projectId !== 'all' && (
              <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold">
                Project: {projects.find(p => p.id === projectId)?.name || projectId}
                <button onClick={() => setProjectId('all')} className="hover:text-purple-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {customerId !== 'all' && (
              <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                Customer: {customers.find(c => c.id === customerId)?.name || customers.find(c => c.id === customerId)?.full_name || customerId}
                <button onClick={() => setCustomerId('all')} className="hover:text-amber-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            {vendorId !== 'all' && (
              <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                Vendor: {vendors.find(v => v.id === vendorId)?.name || vendorId}
                <button onClick={() => setVendorId('all')} className="hover:text-red-300 font-extrabold ml-0.5">×</button>
              </span>
            )}

            <button
              onClick={() => {
                setFiscalYear('all');
                setDepartmentId('all');
                setProjectId('all');
                setCustomerId('all');
                setVendorId('all');
                toast({ title: "Filters reset", description: "All active criteria cleared successfully." });
              }}
              className="text-muted-foreground hover:text-foreground font-bold underline ml-2 cursor-pointer transition-colors"
            >
              Reset All
            </button>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap w-full bg-muted/30 border border-border p-1 rounded-xl gap-1">
          <TabsTrigger value="balance-sheet" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Balance Sheet</TabsTrigger>
          <TabsTrigger value="income-statement" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Income Statement</TabsTrigger>
          <TabsTrigger value="cash-flow" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Cash Flow</TabsTrigger>
          <TabsTrigger value="trial-balance" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Trial Balance</TabsTrigger>
          <TabsTrigger value="general-ledger" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">General Ledger</TabsTrigger>
          <TabsTrigger value="customer-aging" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Customer Aging</TabsTrigger>
          <TabsTrigger value="vendor-aging" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Vendor Aging</TabsTrigger>
          <TabsTrigger value="expense-report" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Expense Report</TabsTrigger>
          <TabsTrigger value="budget-report" className="rounded-lg text-[10px] font-bold py-1.5 flex-1 min-w-[100px]">Budget Report</TabsTrigger>
        </TabsList>

        <div ref={reportRef} className="space-y-4">
          {/* Balance Sheet */}
          <TabsContent value="balance-sheet">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6 border-b border-border/80 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileBarChart className="h-5 w-5 text-emerald-500" /> Balance Sheet Statement
                </CardTitle>
                <CardDescription className="text-xs">Summary of organizational assets, liabilities, and equity balances.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-6 text-xs">
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-500 border-b border-border/50 pb-1 mb-2">ASSETS</h3>
                  <Table>
                    <TableBody>
                      {balanceSheet.assets.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="pl-4 font-semibold">{item.name} ({item.code})</TableCell>
                          <TableCell className="text-right font-bold font-mono text-emerald-500">${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold border-t-2 border-border">
                        <TableCell>Total Assets</TableCell>
                        <TableCell className="text-right font-mono text-emerald-500">${balanceSheet.assets.reduce((sum: number, i: any) => sum + i.balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-amber-500 border-b border-border/50 pb-1 mb-2">LIABILITIES & EQUITY</h3>
                  <Table>
                    <TableBody>
                      {balanceSheet.liabilities.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="pl-4 font-semibold">{item.name} ({item.code})</TableCell>
                          <TableCell className="text-right font-bold font-mono text-amber-500">${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                      {balanceSheet.equity.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="pl-4 font-semibold">{item.name} ({item.code})</TableCell>
                          <TableCell className="text-right font-bold font-mono text-blue-500">${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold border-t-2 border-border">
                        <TableCell>Total Liabilities & Equity</TableCell>
                        <TableCell className="text-right font-mono text-amber-500">
                          ${(
                            balanceSheet.liabilities.reduce((sum: number, i: any) => sum + i.balance, 0) +
                            balanceSheet.equity.reduce((sum: number, i: any) => sum + i.balance, 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Income Statement */}
          <TabsContent value="income-statement">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6 border-b border-border/80 pb-4">
                <CardTitle className="text-lg font-bold">Income Statement (Profit & Loss)</CardTitle>
                <CardDescription className="text-xs">Summary of business revenues, operational expenses, and final net profit margin.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-6 text-xs">
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-500 border-b border-border/50 pb-1 mb-2">REVENUE</h3>
                  <Table>
                    <TableBody>
                      {incomeStatement.revenues.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="pl-4 font-semibold">{item.name} ({item.code})</TableCell>
                          <TableCell className="text-right font-bold font-mono text-emerald-500">${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell>Total Revenue</TableCell>
                        <TableCell className="text-right font-mono text-emerald-500">${incomeStatement.revenues.reduce((sum: number, i: any) => sum + i.balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-red-500 border-b border-border/50 pb-1 mb-2">EXPENSES</h3>
                  <Table>
                    <TableBody>
                      {incomeStatement.expenses.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="pl-4 font-semibold">{item.name} ({item.code})</TableCell>
                          <TableCell className="text-right font-bold font-mono text-red-500">${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell>Total Expenses</TableCell>
                        <TableCell className="text-right font-mono text-red-500">${incomeStatement.expenses.reduce((sum: number, i: any) => sum + i.balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="pt-4 border-t-2 border-border flex justify-between items-center text-sm font-extrabold">
                  <span>NET PROFIT / LOSS</span>
                  <span className={
                    (incomeStatement.revenues.reduce((sum: number, i: any) => sum + i.balance, 0) -
                      incomeStatement.expenses.reduce((sum: number, i: any) => sum + i.balance, 0)) >= 0
                      ? "text-emerald-500" : "text-red-500"
                  }>
                    ${(
                      incomeStatement.revenues.reduce((sum: number, i: any) => sum + i.balance, 0) -
                      incomeStatement.expenses.reduce((sum: number, i: any) => sum + i.balance, 0)
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cash-flow">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6 border-b border-border/80 pb-4">
                <CardTitle className="text-lg font-bold">Cash Flow Statement</CardTitle>
                <CardDescription className="text-xs">Identifies net liquidity inflows and outflows across operating, investing, and financing sectors.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-xs text-muted-foreground mb-2">Operating Activities</h4>
                  <Table>
                    <TableBody>
                      {cashFlow.operatingActivities.map((act: any, i: number) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="pl-4">{act.name}</TableCell>
                          <TableCell className={`text-right font-bold font-mono ${act.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${act.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-muted-foreground mb-2">Investing Activities</h4>
                  <Table>
                    <TableBody>
                      {cashFlow.investingActivities.map((act: any, i: number) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="pl-4">{act.name}</TableCell>
                          <TableCell className={`text-right font-bold font-mono ${act.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${act.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-muted-foreground mb-2">Financing Activities</h4>
                  <Table>
                    <TableBody>
                      {cashFlow.financingActivities.map((act: any, i: number) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="pl-4">{act.name}</TableCell>
                          <TableCell className={`text-right font-bold font-mono ${act.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${act.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="pt-4 border-t-2 border-border flex justify-between items-center text-sm font-extrabold">
                  <span>NET LIQUIDITY CHANGE</span>
                  <span className={cashFlow.netChange >= 0 ? "text-emerald-500" : "text-red-500"}>
                    ${cashFlow.netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trial Balance */}
          <TabsContent value="trial-balance">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">Trial Balance Worksheet</CardTitle>
                <CardDescription className="text-xs">Lists closing ledger accounts to prove total debits equate to total credits.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Account Code</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Account Name</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Account Type</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Debit</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.map((item, idx) => (
                        <TableRow key={idx} className="border-border hover:bg-muted/5 text-xs">
                          <TableCell className="font-mono font-bold">{item.account_code}</TableCell>
                          <TableCell className="font-semibold">{item.account_name}</TableCell>
                          <TableCell className="uppercase text-[10px] font-bold text-muted-foreground">{item.account_type}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-500">${parseFloat(item.total_debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-amber-500">${parseFloat(item.total_credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* General Ledger */}
          <TabsContent value="general-ledger">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">General Ledger Records</CardTitle>
                <CardDescription className="text-xs">Detailed historical breakdown of every journal entry voucher line.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Date</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">JE Number</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Account</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Description</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Debit</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generalLedger.map((item, idx) => (
                        <TableRow key={idx} className="border-border hover:bg-muted/5 text-xs">
                          <TableCell className="font-medium">{new Date(item.entry_date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono font-bold text-teal-500">{item.entry_number}</TableCell>
                          <TableCell className="font-semibold">{item.account_name} ({item.account_code})</TableCell>
                          <TableCell className="text-muted-foreground">{item.description}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">${parseFloat(item.debit || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-amber-500">${parseFloat(item.credit || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Aging */}
          <TabsContent value="customer-aging">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">Customer Accounts Receivable Aging</CardTitle>
                <CardDescription className="text-xs">Grouped aging analysis of pending receivables due from clients.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Invoice</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Total Owed</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">0 - 30 Days</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">31 - 60 Days</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">61 - 90 Days</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Over 90 Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerAging.map((item, idx) => (
                        <TableRow key={idx} className="border-border hover:bg-muted/5 text-xs">
                          <TableCell className="font-bold">{item.customerName}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{item.invoiceNumber}</TableCell>
                          <TableCell className="text-right font-bold font-mono">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">${item.current.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-blue-500">${item.days30to60.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-amber-500">${item.days61to90.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-red-500">${item.over90.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendor Aging */}
          <TabsContent value="vendor-aging">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">Vendor Accounts Payable Aging</CardTitle>
                <CardDescription className="text-xs">Grouped aging analysis of pending liabilities due to suppliers.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Vendor</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Bill #</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Total Owed</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">0 - 30 Days</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">31 - 60 Days</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">61 - 90 Days</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Over 90 Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorAging.map((item, idx) => (
                        <TableRow key={idx} className="border-border hover:bg-muted/5 text-xs">
                          <TableCell className="font-bold">{item.vendorName}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{item.invoiceNumber}</TableCell>
                          <TableCell className="text-right font-bold font-mono">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">${item.current.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-blue-500">${item.days30to60.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-amber-500">${item.days61to90.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-red-500">${item.over90.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expense Report */}
          <TabsContent value="expense-report">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">Operational Expense Report</CardTitle>
                <CardDescription className="text-xs">Aggregated summary of employee expense claims filtered by department.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Department</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Expense Type</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Claim Count</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesReport.map((item, idx) => (
                        <TableRow key={idx} className="border-border hover:bg-muted/5 text-xs">
                          <TableCell className="font-bold">{item.department_id}</TableCell>
                          <TableCell className="font-semibold text-muted-foreground">{item.expense_type}</TableCell>
                          <TableCell className="text-right font-semibold">{item.claim_count}</TableCell>
                          <TableCell className="text-right font-bold font-mono text-red-500">${parseFloat(item.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budget Report */}
          <TabsContent value="budget-report">
            <Card className="border-border bg-card/30 backdrop-blur-md rounded-2xl p-6 shadow-md">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">Budget Utilization Report</CardTitle>
                <CardDescription className="text-xs">Compares active fiscal budgets against forecasts and actual spent indicators.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-bold text-muted-foreground">Department / Scope</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">Fiscal Year</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Budget Limit</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Forecast Limit</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Actual Spent</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground text-right">Remaining Budget</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetsReport.map((item, idx) => {
                        const budget = parseFloat(item.budget_amount);
                        const actual = parseFloat(item.actual_spent);
                        const remaining = budget - actual;
                        return (
                          <TableRow key={idx} className="border-border hover:bg-muted/5 text-xs">
                            <TableCell className="font-bold">{item.department_id} - <span className="text-muted-foreground font-normal">{item.project_name || "General"}</span></TableCell>
                            <TableCell className="font-mono text-emerald-500 font-bold">{item.fiscal_year}</TableCell>
                            <TableCell className="text-right font-semibold">${budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right text-muted-foreground">${parseFloat(item.forecast_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-bold text-red-500">${actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className={`text-right font-bold ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default FinancialReports;
