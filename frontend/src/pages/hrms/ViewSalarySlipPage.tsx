import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react";
import { payrollApi, api } from "@/lib/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
];

export default function ViewSalarySlipPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const slipRef = useRef<HTMLDivElement>(null);
  const [absentsCount, setAbsentsCount] = useState(0);
  const [lateArrivalsCount, setLateArrivalsCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch org details from API
  const { data: orgData } = useQuery({
    queryKey: ['organization-current'],
    queryFn: () => api.get<any>('/organizations'),
  });
  const companyName = (orgData as any)?.name || localStorage.getItem('company_name') || 'Your Company Name';
  const companyAddress = (orgData as any)?.address || localStorage.getItem('company_address') || '';

  const { data: slipData, isLoading } = useQuery({
    queryKey: ['salary-slip', id],
    queryFn: () => payrollApi.getSalarySlipById(id!),
    enabled: !!id,
  });

  const slip = slipData?.data;

  // Read attendance metrics purely from the finalized payroll snapshot record
  useEffect(() => {
    if (!slip) {
      setAbsentsCount(0);
      setLateArrivalsCount(0);
      return;
    }

    // 1. Direct snapshot columns on salary_slips (saved when HR generates payroll)
    if (slip.absent_days !== undefined && slip.absent_days !== null && slip.absent_days !== '') {
      setAbsentsCount(Number(slip.absent_days));
      setLateArrivalsCount(Number(slip.late_days || 0));
      return;
    }

    // 2. Snapshot metadata in slip.notes
    if (slip.notes) {
      try {
        const meta = typeof slip.notes === 'string' ? JSON.parse(slip.notes) : slip.notes;
        if (meta && (meta.absent_days !== undefined || meta.late_days !== undefined)) {
          setAbsentsCount(Number(meta.absent_days || 0));
          setLateArrivalsCount(Number(meta.late_days || 0));
          return;
        }
      } catch (e) { }
    }

    // 3. Fallback for older legacy slips: extract from Absent Deduction line item
    const deductionsList = slip.items?.filter((i: any) => i.component_type === 'deduction') || [];
    const absentItem = deductionsList.find((d: any) => d.component_name?.toLowerCase().includes('absent'));
    if (absentItem) {
      const match = absentItem.component_name.match(/([\d.]+)\s*days?/i);
      if (match) {
        setAbsentsCount(parseFloat(match[1]));
      } else if (Number(slip.basic_salary) > 0) {
        setAbsentsCount(Math.round((Number(absentItem.amount) / (Number(slip.basic_salary) / 30)) * 2) / 2);
      }
    } else {
      setAbsentsCount(0);
    }
    setLateArrivalsCount(0);
  }, [slip]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-auto">Loading...</div>;
  }

  if (!slip) {
    return <div className="flex items-center justify-center h-auto">Salary slip not found</div>;
  }

  const earnings = slip.items?.filter((i: any) => i.component_type === 'earning') || [];
  const deductions = slip.items?.filter((i: any) => i.component_type === 'deduction') || [];

  let notesCnic = '';
  if (slip.notes) {
    try {
      const meta = typeof slip.notes === 'string' ? JSON.parse(slip.notes) : slip.notes;
      if (meta && meta.cnic) {
        notesCnic = meta.cnic;
      }
    } catch (e) { }
  }
  const displayCnic = slip.cnic || notesCnic;

  const monthLabel = MONTHS.find(m => m.value === slip.month)?.label || '';
  const employeeName = `${slip.first_name || ''} ${slip.last_name || ''}`.trim();
  const empCode = slip.emp_code || slip.employee_id || '—';
  const daysWorked = slip.worked_days ?? ((slip.total_days || 30) - absentsCount);
  const salaryPerDay = Math.round(Number(slip.basic_salary) / (slip.total_days || 30)).toLocaleString();
  const formattedGross = Number(slip.total_earnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const formattedNet = Number(slip.net_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const issuanceDate = slip.generated_at ? new Date(slip.generated_at).toLocaleDateString() : new Date().toLocaleDateString();

  const getSlipInnerHtml = () => {
    const earningsRows = earnings.map((e: any) => `
      <tr>
        <td style="padding: 6px 10px; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${e.component_name}</td>
        <td style="padding: 6px 10px; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">Rs ${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const deductionsRows = deductions.map((d: any) => `
      <tr>
        <td style="padding: 6px 10px; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${d.component_name}</td>
        <td style="padding: 6px 10px; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">Rs ${Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    return `
      <div class="slip-wrapper" style="width: 780px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 24px; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.4; box-sizing: border-box;">
        <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 14px; margin-bottom: 16px;">
          <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800; letter-spacing: 1.5px; color: #059669;">SALARY SLIP</h1>
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 2px 0;">${companyName}</div>
          ${companyAddress ? `<div style="font-size: 10px; color: #64748b; margin: 0;">${companyAddress}</div>` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div>
            <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #059669; margin: 0 0 8px 0; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0;">
              Employee Information
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 11px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; width: 44%; border-right: 1px solid #e2e8f0;">Employee ID:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${empCode}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Employee Name:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${employeeName}</td>
              </tr>
              ${displayCnic ? `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">CNIC:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${displayCnic}</td>
              </tr>` : ''}
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Designation:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a; text-transform: capitalize;">${slip.designation || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Department:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a; text-transform: capitalize;">${slip.department || '—'}</td>
              </tr>
            </table>
          </div>

          <div>
            <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #059669; margin: 0 0 8px 0; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0;">
              Employment Details
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 11px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; width: 44%; border-right: 1px solid #e2e8f0;">Total Working Days:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${slip.total_days || 30}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Days Worked:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${daysWorked}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Absents:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${absentsCount}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Late Arrivals:</td>
                <td style="padding: 5px 8px; font-weight: 500; color: #0f172a;">${lateArrivalsCount}</td>
              </tr>
              <tr>
                <td style="padding: 5px 8px; font-weight: 600; color: #475569; background: #f8fafc; border-right: 1px solid #e2e8f0;">Salary / Day:</td>
                <td style="padding: 5px 8px; font-weight: 700; color: #0f172a;">Rs ${salaryPerDay}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #059669; margin: 0 0 8px 0; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0;">
          Earnings & Deductions
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; font-size: 11px;">
              <thead>
                <tr style="background: #f1f5f9; color: #334155; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                  <th style="padding: 6px 10px; text-align: left;">Earnings</th>
                  <th style="padding: 6px 10px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${earningsRows}
                <tr style="background: #ecfdf5; font-weight: 700; color: #047857; border-top: 1px solid #a7f3d0;">
                  <td style="padding: 7px 10px;">Gross Salary</td>
                  <td style="padding: 7px 10px; text-align: right;">Rs ${formattedGross}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; font-size: 11px;">
              <thead>
                <tr style="background: #f1f5f9; color: #334155; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                  <th style="padding: 6px 10px; text-align: left;">Deductions</th>
                  <th style="padding: 6px 10px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${deductionsRows}
                <tr style="background: #fef2f2; font-weight: 700; color: #dc2626; border-top: 1px solid #fecaca;">
                  <td style="padding: 7px 10px;">Net Paid</td>
                  <td style="padding: 7px 10px; text-align: right;">Rs ${formattedNet}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 10px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Issuance Date</td>
                  <td style="padding: 5px 10px; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${issuanceDate}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 10px; color: #64748b;">Payment Mode</td>
                  <td style="padding: 5px 10px; text-align: right; font-weight: 600;">Bank Transfer</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #f8fafc;">
            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 3px;">HR KPIs Policy</div>
            <p style="font-size: 9.5px; color: #64748b; line-height: 1.35; margin: 0;">HR KPIs Allowance applies for performance factors (Late Arrival, Absenteeism, Missing Attendance, and general adherence to HR Policies).</p>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #f8fafc;">
            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 3px;">NOTE</div>
            <p style="font-size: 9.5px; color: #64748b; line-height: 1.35; margin: 0;">Please verify your salary slip details and report any discrepancies to HR within 3 working days.</p>
          </div>
        </div>

        <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9.5px; color: #94a3b8;">
          <p style="margin: 2px 0;">This is a computer-generated salary slip and does not require a signature.</p>
          <p style="margin: 2px 0;">For any queries, please contact the Human Resource Department.</p>
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    const oldIframe = document.getElementById('salary-slip-print-frame');
    if (oldIframe) {
      oldIframe.remove();
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Salary Slip - ${employeeName} - ${monthLabel} ${slip.year}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 12mm 15mm;
            color: #0f172a;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        ${getSlipInnerHtml()}
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = 'salary-slip-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
        }, 2000);
      }, 300);
    } else {
      window.print();
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '780px';
      container.style.zIndex = '-9999';
      container.style.background = '#ffffff';
      container.style.padding = '0';
      container.innerHTML = getSlipInnerHtml();
      document.body.appendChild(container);

      await new Promise((r) => setTimeout(r, 150));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        x: 0,
        y: 0,
        width: 780,
        windowWidth: 780,
      });
      container.remove();

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      const empName = `${slip.first_name || ''}_${slip.last_name || ''}`.trim() || 'employee';
      pdf.save(`Salary_Slip_${empName}_${monthLabel}_${slip.year || ''}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hrms/payroll')} className="rounded-xl border border-border hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Salary Slip</h1>
            <p className="text-sm text-muted-foreground">
              {slip.first_name} {slip.last_name} - {MONTHS.find(m => m.value === slip.month)?.label} {slip.year}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="rounded-xl border border-border hover:bg-secondary-foreground dark:hover:bg-primary hover:text-white text-xs font-semibold">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading} className="rounded-xl text-xs font-semibold">
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <Card id="salary-slip-print-area" className="border border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-md overflow-hidden print:overflow-visible print:border-none print:shadow-none print:bg-white print:p-0">
        <CardContent className="p-6 sm:p-10">
          <div ref={slipRef} className="text-foreground" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Header */}
            <div className="text-center mb-8 pb-6 border-b border-border/80">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent mb-2">SALARY SLIP</h1>
              <p className="text-sm font-bold text-foreground/80">{companyName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{companyAddress}</p>
            </div>

            {/* Employee Info */}
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-4 pb-1 border-b border-border/40">Employee Information</h3>
              <div className="space-y-3 text-xs sm:text-sm">
                {(slip.emp_code || slip.employee_id) && (
                  <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                    <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Employee ID:</span>
                    <span className="px-3 py-2 flex-1 font-medium">{slip.emp_code || slip.employee_id}</span>
                  </div>
                )}
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Employee Name:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{slip.first_name} {slip.last_name}</span>
                </div>

                {displayCnic && (
                  <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                    <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">CNIC:</span>
                    <span className="px-3 py-2 flex-1 font-medium">{displayCnic}</span>
                  </div>
                )}
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Designation:</span>
                  <span className="px-3 py-2 flex-1 font-medium capitalize">{slip.designation || '—'}</span>
                </div>
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Department:</span>
                  <span className="px-3 py-2 flex-1 font-medium capitalize">{slip.department}</span>
                </div>
              </div>
            </div>

            {/* Employment Details */}
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-4 pb-1 border-b border-border/40">Employment Details</h3>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Total Working Days:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{slip.total_days || 30}</span>
                </div>
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Days Worked:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{slip.worked_days ?? ((slip.total_days || 30) - absentsCount)}</span>
                </div>
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Absents:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{absentsCount}</span>
                </div>
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Late Arrivals:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{lateArrivalsCount}</span>
                </div>
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Salary / Day:</span>
                  <span className="px-3 py-2 flex-1 font-bold">Rs {Math.round(Number(slip.basic_salary) / (slip.total_days || 30)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-4 pb-1 border-b border-border/40">Earning & Deductions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <table className="w-full text-xs sm:text-sm border border-border rounded-xl overflow-hidden shadow-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Earnings</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.map((e: any, i: number) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/5">
                          <td className="px-3 py-2 font-medium">{e.component_name}</td>
                          <td className="text-right px-3 py-2 font-bold">Rs {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-500/10 font-bold border-b border-border">
                        <td className="px-3 py-2 text-emerald-600">Gross Salary</td>
                        <td className="text-right px-3 py-2 text-emerald-600">Rs {Number(slip.total_earnings).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <table className="w-full text-xs sm:text-sm border border-border rounded-xl overflow-hidden shadow-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Deductions</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductions.map((d: any, i: number) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/5">
                          <td className="px-3 py-2 font-medium">{d.component_name}</td>
                          <td className="text-right px-3 py-2 font-bold">Rs {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr className="bg-red-500/10 font-bold border-b border-border text-red-600">
                        <td className="px-3 py-2">Net Paid</td>
                        <td className="text-right px-3 py-2">Rs {Number(slip.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-3 py-2 text-muted-foreground">Issuance Date</td>
                        <td className="text-right px-3 py-2 font-semibold text-xs">{new Date(slip.generated_at).toLocaleDateString()}</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="px-3 py-2 text-muted-foreground">Payment Mode</td>
                        <td className="text-right px-3 py-2 font-semibold">Bank Transfer</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* HR KPIs & Note */}
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <table className="w-full text-xs sm:text-sm border border-border rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">HR KPIs Policy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                      HR KPIs Allowance applies for performance factors (Late Arrival, Absenteeism, Missing Attendance, and general adherence to HR Policies).
                    </td>
                  </tr>
                </tbody>
              </table>
              <table className="w-full text-xs sm:text-sm border border-border rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">NOTE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                      Please verify your salary slip details and report any discrepancies to HR within 3 working days.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-6 border-t border-border/80">
              <p>This is a computer-generated salary slip and does not require a signature.</p>
              <p className="mt-1">For any queries, please contact the Human Resource Department.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
