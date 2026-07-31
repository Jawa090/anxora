import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Calendar, CheckCircle, Clock, XCircle, AlertCircle, TrendingUp, UserCheck, RefreshCw } from 'lucide-react';
import { recruitmentApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function RecruitmentDashboard() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    activeRequisitions: 0,
    pendingApprovals: 0,
    totalCandidates: 0,
    interviewsScheduled: 0,
    shortlisted: 0,
    selected: 0,
    inProgress: 0,
    completed: 0
  });
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [requisitions, candidates, approvals, interviews] = await Promise.all([
        recruitmentApi.getRequisitions(),
        recruitmentApi.getCandidates(),
        recruitmentApi.getPendingApprovals(),
        recruitmentApi.getScheduledInterviews()
      ]);

      // Calculate stats
      const activeReqs = requisitions.filter((r: any) => 
        !['rejected', 'completed'].includes(r.status)
      ).length;
      
      const shortlistedCount = candidates.filter((c: any) => 
        c.status === 'shortlisted'
      ).length;
      
      const selectedCount = candidates.filter((c: any) => 
        c.status === 'selected'
      ).length;

      setStats({
        activeRequisitions: activeReqs,
        pendingApprovals: approvals.length,
        totalCandidates: candidates.length,
        interviewsScheduled: interviews.length,
        shortlisted: shortlistedCount,
        selected: selectedCount,
        inProgress: activeReqs,
        completed: requisitions.filter((r: any) => r.status === 'completed').length
      });

      setPendingApprovals(approvals.slice(0, 2));

      // Build recent activity from all data
      const activities: any[] = [];

      // Add recent requisitions
      requisitions.slice(0, 3).forEach((req: any) => {
        if (req.status === 'approved') {
          activities.push({
            id: `req-${req.id}`,
            type: 'approval',
            icon: CheckCircle,
            iconColor: 'text-green-600',
            message: `Requisition ${req.requisition_id} for ${req.position} approved`,
            time: getTimeAgo(req.updated_at),
            timestamp: new Date(req.updated_at).getTime()
          });
        } else if (req.status.includes('pending')) {
          activities.push({
            id: `req-${req.id}`,
            type: 'pending',
            icon: AlertCircle,
            iconColor: 'text-orange-600',
            message: `Requisition ${req.requisition_id} for ${req.position} awaiting approval`,
            time: getTimeAgo(req.created_at),
            timestamp: new Date(req.created_at).getTime()
          });
        } else {
          activities.push({
            id: `req-${req.id}`,
            type: 'requisition',
            icon: FileText,
            iconColor: 'text-blue-600',
            message: `New requisition for ${req.position}`,
            time: getTimeAgo(req.created_at),
            timestamp: new Date(req.created_at).getTime()
          });
        }
      });

      // Add recent candidates
      candidates.slice(0, 3).forEach((candidate: any) => {
        if (candidate.status === 'shortlisted') {
          activities.push({
            id: `cand-${candidate.id}`,
            type: 'candidate',
            icon: UserCheck,
            iconColor: 'text-cyan-600',
            message: `${candidate.full_name} shortlisted for ${candidate.applied_position}`,
            time: getTimeAgo(candidate.updated_at),
            timestamp: new Date(candidate.updated_at).getTime()
          });
        }
      });

      // Add recent interviews
      interviews.slice(0, 2).forEach((interview: any) => {
        activities.push({
          id: `int-${interview.id}`,
          type: 'interview',
          icon: Calendar,
          iconColor: 'text-purple-600',
          message: `Interview scheduled with ${interview.candidate_name} for ${interview.position}`,
          time: getTimeAgo(interview.created_at || interview.interview_date),
          timestamp: new Date(interview.created_at || interview.interview_date).getTime()
        });
      });

      // Sort by timestamp and take top 5
      activities.sort((a, b) => b.timestamp - a.timestamp);
      setRecentActivity(activities.slice(0, 5));
      
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Recruitment Dashboard</h1>
            <p className="text-muted-foreground">Manage your recruitment process from requisition to hiring</p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      {(() => {
        const isAuthorized = ["super_admin", "admin", "manager"].includes(userRole?.role || "");
        return (
          <div className={cn("grid grid-cols-1 gap-4 mb-6", isAuthorized ? "md:grid-cols-4" : "md:grid-cols-3")}>
            <Button
              onClick={() => navigate('/recruitment/requisitions/new')}
              className="h-auto py-6"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8" />
                <span>New Requisition</span>
              </div>
            </Button>
            <Button
              onClick={() => navigate('/recruitment/approvals')}
              className="h-auto py-6"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="h-8 w-8" />
                <span>Approvals</span>
              </div>
            </Button>
            {isAuthorized && (
              <Button
                onClick={() => navigate('/recruitment/candidates')}
                className="h-auto py-6"
                variant="outline"
              >
                <div className="flex flex-col items-center gap-2">
                  <Users className="h-8 w-8" />
                  <span>View Candidates</span>
                </div>
              </Button>
            )}
            <Button
              onClick={() => navigate('/recruitment/requisitions')}
              className="h-auto py-6"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <Calendar className="h-8 w-8" />
                <span>All Requisitions</span>
              </div>
            </Button>
          </div>
        );
      })()}

      {/* Statistics Cards */}
      {(() => {
        const isAuthorized = ["super_admin", "admin", "manager"].includes(userRole?.role || "");
        return (
          <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 mb-6", isAuthorized ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.pendingApprovals}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Active Requisitions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.activeRequisitions}</div>
                <p className="text-xs text-muted-foreground mt-1">In progress</p>
              </CardContent>
            </Card>

            {isAuthorized && (
              <>
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Total Candidates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">{stats.totalCandidates}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stats.shortlisted} shortlisted</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Selected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{stats.selected}</div>
                    <p className="text-xs text-muted-foreground mt-1">This month</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Pending Approvals
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/recruitment/approvals')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pendingApprovals.length > 0 ? (
                pendingApprovals.map((req) => (
                  <div key={req.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/recruitment/requisitions/${req.id}`)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{req.requisition_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${req.urgency === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {req.urgency}
                        </span>
                      </div>
                      <p className="font-semibold">{req.position}</p>
                      <p className="text-sm text-muted-foreground">{req.department}</p>
                      <p className="text-xs text-orange-600 mt-1">Awaiting: {req.current_step}</p>
                    </div>
                    <Button size="sm" variant="outline">Review</Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">No pending approvals</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading activities...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No recent activity</div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <div className="mt-1">
                      <activity.icon className={`h-5 w-5 ${activity.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
