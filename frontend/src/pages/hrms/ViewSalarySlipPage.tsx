import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Printer } from "lucide-react";
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

  useEffect(() => {
    if (!slip?.employee_id || !slip?.month || !slip?.year) return;

    const fetchStats = async () => {
      try {
        const lastDay = new Date(slip.year, slip.month, 0).getDate();
        const startDateStr = `${slip.year}-${String(slip.month).padStart(2, '0')}-01`;
        const endDateStr = `${slip.year}-${String(slip.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Fetch approved leaves
        const leavesRes = await api.get<{ data: any[] }>('/leave', { 
          employeeId: slip.employee_id, 
          status: 'approved' 
        });
        const leaves = leavesRes?.data || [];

        // Count overlapping unpaid leaves
        let unpaidDays = 0;
        const monthStart = new Date(slip.year, slip.month - 1, 1);
        const monthEnd = new Date(slip.year, slip.month, 0);

        leaves.forEach((leave: any) => {
          if (leave.paid_status?.toLowerCase() !== 'unpaid') return;

          const leaveStart = new Date(leave.start_date);
          const leaveEnd = new Date(leave.end_date);

          const overlapStart = new Date(Math.max(leaveStart.getTime(), monthStart.getTime()));
          const overlapEnd = new Date(Math.min(leaveEnd.getTime(), monthEnd.getTime()));

          if (overlapStart <= overlapEnd) {
            const diffTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            unpaidDays += diffDays;
          }
        });

        // Fetch attendance for late arrivals
        const attendanceRes = await api.get<{ data: any[] }>('/attendance', {
          employee_id: slip.employee_id,
          from: startDateStr,
          to: endDateStr,
          limit: 'all'
        });
        const attendanceRecords = attendanceRes?.data || [];
        const lateCount = attendanceRecords.filter((rec: any) => rec.status === 'late').length;

        setAbsentsCount(unpaidDays);
        setLateArrivalsCount(lateCount);
      } catch (err) {
        console.error('Error fetching employee stats in view:', err);
      }
    };

    fetchStats();
  }, [slip?.employee_id, slip?.month, slip?.year]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!slipRef.current) return;
    const canvas = await html2canvas(slipRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f172a', // dark bg to match screen
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const empName = slip ? `${slip.first_name}_${slip.last_name}` : 'employee';
    const monthLabel = MONTHS.find(m => m.value === slip?.month)?.label || '';
    pdf.save(`Salary_Slip_${empName}_${monthLabel}_${slip?.year || ''}.pdf`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-auto">Loading...</div>;
  }

  if (!slip) {
    return <div className="flex items-center justify-center h-auto">Salary slip not found</div>;
  }

  const earnings = slip.items?.filter((i: any) => i.component_type === 'earning') || [];
  const deductions = slip.items?.filter((i: any) => i.component_type === 'deduction') || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hrms/payroll')} className="rounded-xl border border-border hover:bg-muted/50">
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
          <Button variant="outline" onClick={handlePrint} className="rounded-xl border border-border hover:bg-muted/50 text-xs font-semibold">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold">
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
        </div>
      </div>

      <Card id="salary-slip-print-area" className="border border-border bg-card/30 backdrop-blur-md rounded-2xl shadow-md overflow-hidden">
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
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Employee Name:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{slip.first_name} {slip.last_name}</span>
                </div>
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
                  <span className="px-3 py-2 flex-1 font-medium">30</span>
                </div>
                <div className="flex border border-border rounded-xl overflow-hidden bg-background">
                  <span className="font-semibold text-muted-foreground bg-muted/40 px-3 py-2 border-r border-border w-44 flex items-center">Days Worked:</span>
                  <span className="px-3 py-2 flex-1 font-medium">{30 - absentsCount}</span>
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
                  <span className="px-3 py-2 flex-1 font-bold">${Math.round(Number(slip.basic_salary) / 30).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Leaves Quota */}
            {/* <div className="mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-4 pb-1 border-b border-border/40">Leaves Quota</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <table className="w-full text-xs sm:text-sm border border-border rounded-xl overflow-hidden shadow-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Leaves Taken</th>
                        <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border"><td className="px-3 py-2">Sick:</td><td className="text-center px-3 py-2 font-medium">0</td></tr>
                      <tr className="border-b border-border"><td className="px-3 py-2">Casual:</td><td className="text-center px-3 py-2 font-medium">0</td></tr>
                      <tr className="border-b border-border"><td className="px-3 py-2">Annual:</td><td className="text-center px-3 py-2 font-medium">0</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <table className="w-full text-xs sm:text-sm border border-border rounded-xl overflow-hidden shadow-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Balance Leaves</th>
                        <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border"><td className="px-3 py-2">Sick:</td><td className="text-center px-3 py-2 font-medium">0</td></tr>
                      <tr className="border-b border-border"><td className="px-3 py-2">Casual:</td><td className="text-center px-3 py-2 font-medium">0</td></tr>
                      <tr className="border-b border-border"><td className="px-3 py-2">Annual:</td><td className="text-center px-3 py-2 font-medium">0</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div> */}

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
                          <td className="text-right px-3 py-2 font-bold">${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-500/10 font-bold border-b border-border">
                        <td className="px-3 py-2 text-emerald-600">Gross Salary</td>
                        <td className="text-right px-3 py-2 text-emerald-600">${Number(slip.total_earnings).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
                          <td className="text-right px-3 py-2 font-bold">${Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr className="bg-red-500/10 font-bold border-b border-border text-red-600">
                        <td className="px-3 py-2">Net Paid</td>
                        <td className="text-right px-3 py-2">${Number(slip.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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
