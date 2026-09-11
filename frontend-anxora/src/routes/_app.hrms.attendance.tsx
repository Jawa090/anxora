'use client';
// Real-time attendance tracking
import { useEffect, useState, useRef } from 'react';
import { Page, PageHeader, Card, Pill, SectionTitle } from '@/components/page';
import { Clock, LogOut, Coffee, AlertCircle, RefreshCw, Users } from 'lucide-react';
import { api } from '@/lib/api';

interface AttendanceRecord {
  id: string;
  clock_in?: string;
  clock_out?: string;
  break_start?: string;
  break_end?: string;
  status: string;
  employee_name?: string;
  employee_id?: string;
  emp_id?: string;
  user_id?: string;
  date?: string;
}

export default function AppHrmsAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchToday = async () => {
    try {
      const response = await api.get('/api/hrms/attendance/my-today');
      setAttendance(response.data);
    } catch (err: any) {
      console.error('Error fetching today attendance:', err);
    }
  };

  const fetchAllAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/api/hrms/attendance', {
        params: { date: today, limit: 1000 },
      });
      setAllAttendance(response.data.data || []);
    } catch (err: any) {
      console.error('Error fetching all attendance:', err);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const response = await api.get('/api/users/current');
      const user = response.data;
      setIsAdmin(user.role === 'admin' || user.role === 'super_admin');
    } catch (err: any) {
      console.error('Error checking admin status:', err);
    }
  };

  useEffect(() => {
    checkAdminStatus();
    fetchToday();
  }, []);

  // Setup polling for admin - refresh every 1 second for instant updates
  useEffect(() => {
    if (isAdmin) {
      fetchAllAttendance(); // Initial fetch

      // Poll every 1 second for instant updates
      pollIntervalRef.current = setInterval(() => {
        fetchAllAttendance();
      }, 1000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [isAdmin]);

  const handleAction = async (action: 'clock-in' | 'clock-out' | 'break-start' | 'break-end') => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.post(`/api/hrms/attendance/${action}`);
      setAttendance(response.data);
      setMessage({ type: 'success', text: `${action.replace('-', ' ').toUpperCase()} successful!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || `Failed to ${action}. Please try again.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getButtonState = () => {
    if (!attendance) {
      return { canClockIn: true, canClockOut: false, canStartBreak: false, canEndBreak: false };
    }

    const hasClockIn = !!attendance.clock_in;
    const hasClockOut = !!attendance.clock_out;
    const hasBreakStart = !!attendance.break_start;
    const hasBreakEnd = !!attendance.break_end;

    return {
      canClockIn: !hasClockIn,
      canClockOut: hasClockIn && !hasClockOut,
      canStartBreak: hasClockIn && !hasClockOut && !hasBreakStart,
      canEndBreak: hasBreakStart && !hasBreakEnd,
    };
  };

  const buttonState = getButtonState();

  // ADMIN VIEW - Real-time all employee attendance
  if (isAdmin) {
    return (
      <Page>
        <PageHeader
          title="Team Attendance"
          description="Real-time view of all employee attendance"
          badge={<Pill tone="primary"><Users className="h-3 w-3" /> HRMS Admin</Pill>}
          actions={
            <button
              onClick={() => fetchAllAttendance()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          }
        />

        <Card>
          <SectionTitle sub={`Showing ${allAttendance.length} employees checked in today`}>Today's Attendance</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Check In</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Break Start</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Break End</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Check Out</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No attendance records yet
                    </td>
                  </tr>
                ) : (
                  allAttendance.map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{record.employee_name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {record.clock_in && <Clock className="h-4 w-4 text-green-600" />}
                          <span className={record.clock_in ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                            {formatTime(record.clock_in)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {record.break_start && <Coffee className="h-4 w-4 text-blue-600" />}
                          <span className={record.break_start ? 'text-blue-700' : 'text-muted-foreground'}>
                            {formatTime(record.break_start)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={record.break_end ? 'text-amber-700' : 'text-muted-foreground'}>
                          {formatTime(record.break_end)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {record.clock_out && <LogOut className="h-4 w-4 text-red-600" />}
                          <span className={record.clock_out ? 'text-red-700 font-medium' : 'text-muted-foreground'}>
                            {formatTime(record.clock_out)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={
                          record.status === 'present' ? 'success' :
                            record.status === 'half_day' ? 'warning' :
                              record.status === 'on_break' ? 'info' : 'muted'
                        }>
                          {record.status === 'half_day' ? 'Half Day' :
                            record.status === 'on_break' ? 'On Break' :
                              record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Pill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </Page>
    );
  }

  // EMPLOYEE VIEW - Personal attendance with action buttons
  return (
    <Page>
      <PageHeader
        title="Attendance"
        description="Track your daily check-in, check-out, and break times"
        badge={<Pill tone="primary"><Clock className="h-3 w-3" /> HRMS</Pill>}
      />

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 ${message.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
            }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Main Attendance Card */}
      <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 via-surface to-surface">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Today's Attendance</SectionTitle>
            {attendance && (
              <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Clock In</div>
                  <div className="mt-1 text-lg font-semibold">{formatTime(attendance.clock_in)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Break Start</div>
                  <div className="mt-1 text-lg font-semibold">{formatTime(attendance.break_start)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Break End</div>
                  <div className="mt-1 text-lg font-semibold">{formatTime(attendance.break_end)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Clock Out</div>
                  <div className="mt-1 text-lg font-semibold">{formatTime(attendance.clock_out)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <SectionTitle sub="Quick Actions">Time Management</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Check In Button */}
        <button
          onClick={() => handleAction('clock-in')}
          disabled={!buttonState.canClockIn || loading}
          className={`relative overflow-hidden rounded-xl border px-6 py-4 font-medium transition-all ${buttonState.canClockIn
            ? 'border-green-300 bg-linear-to-br from-green-50 to-green-100/50 text-green-700 hover:from-green-100 hover:to-green-200 shadow-sm hover:shadow-md'
            : 'border-border bg-muted text-muted-foreground cursor-not-allowed'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Check In</span>
          </div>
          {!buttonState.canClockIn && <div className="text-xs opacity-70 mt-1">Already checked in</div>}
        </button>

        {/* Start Break Button */}
        <button
          onClick={() => handleAction('break-start')}
          disabled={!buttonState.canStartBreak || loading}
          className={`relative overflow-hidden rounded-xl border px-6 py-4 font-medium transition-all ${buttonState.canStartBreak
            ? 'border-blue-300 bg-linear-to-br from-blue-50 to-blue-100/50 text-blue-700 hover:from-blue-100 hover:to-blue-200 shadow-sm hover:shadow-md'
            : 'border-border bg-muted text-muted-foreground cursor-not-allowed'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Coffee className="h-4 w-4" />
            <span>Start Break</span>
          </div>
          {!buttonState.canStartBreak && <div className="text-xs opacity-70 mt-1">Not available</div>}
        </button>

        {/* End Break Button */}
        <button
          onClick={() => handleAction('break-end')}
          disabled={!buttonState.canEndBreak || loading}
          className={`relative overflow-hidden rounded-xl border px-6 py-4 font-medium transition-all ${buttonState.canEndBreak
            ? 'border-amber-300 bg-linear-to-br from-amber-50 to-amber-100/50 text-amber-700 hover:from-amber-100 hover:to-amber-200 shadow-sm hover:shadow-md'
            : 'border-border bg-muted text-muted-foreground cursor-not-allowed'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Coffee className="h-4 w-4" />
            <span>End Break</span>
          </div>
          {!buttonState.canEndBreak && <div className="text-xs opacity-70 mt-1">Break not started</div>}
        </button>

        {/* Check Out Button */}
        <button
          onClick={() => handleAction('clock-out')}
          disabled={!buttonState.canClockOut || loading}
          className={`relative overflow-hidden rounded-xl border px-6 py-4 font-medium transition-all ${buttonState.canClockOut
            ? 'border-red-300 bg-linear-to-br from-red-50 to-red-100/50 text-red-700 hover:from-red-100 hover:to-red-200 shadow-sm hover:shadow-md'
            : 'border-border bg-muted text-muted-foreground cursor-not-allowed'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <LogOut className="h-4 w-4" />
            <span>Check Out</span>
          </div>
          {!buttonState.canClockOut && <div className="text-xs opacity-70 mt-1">Already checked out</div>}
        </button>
      </div>

      {/* Status Information */}
      <Card>
        <SectionTitle sub="Your attendance status">Current Status</SectionTitle>
        {attendance && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <span className="text-sm font-medium">Today's Status</span>
              <Pill tone={attendance.status === 'present' ? 'success' : attendance.status === 'half_day' ? 'warning' : 'muted'}>
                {attendance.status === 'half_day' ? 'Half Day' : attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)}
              </Pill>
            </div>
            {attendance.clock_in && !attendance.clock_out && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                Currently checked in
              </div>
            )}
            {attendance.break_start && !attendance.break_end && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                Currently on break
              </div>
            )}
            {attendance.clock_out && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                Checked out for the day
              </div>
            )}
          </div>
        )}
      </Card>
    </Page>
  );
}
