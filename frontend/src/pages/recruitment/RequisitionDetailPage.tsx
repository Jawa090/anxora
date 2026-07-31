import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle, XCircle, FileText, Clock, User, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function RequisitionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [approvalComment, setApprovalComment] = useState('');
  const [requisition, setRequisition] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequisition();
    }
  }, [id]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getRequisitionById(id!);
      setRequisition(data);
    } catch (error) {
      console.error('Error fetching requisition:', error);
      toast.error('Failed to load requisition details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
      pending_hr: { label: 'Pending HR Approval', variant: 'secondary', color: 'blue' },
      approved: { label: 'Approved', variant: 'default', color: 'green' },
      rejected: { label: 'Rejected', variant: 'destructive', color: 'red' },
      in_advertisement: { label: 'In Advertisement', variant: 'default', color: 'blue' },
      shortlisting: { label: 'Shortlisting', variant: 'default', color: 'cyan' },
      interviewing: { label: 'Interviewing', variant: 'default', color: 'indigo' },
      completed: { label: 'Completed', variant: 'default', color: 'green' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary', color: 'gray' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig: Record<string, { variant: any }> = {
      low: { variant: 'secondary' },
      medium: { variant: 'default' },
      high: { variant: 'default' },
      urgent: { variant: 'destructive' }
    };
    
    const config = urgencyConfig[urgency] || { variant: 'secondary' };
    return <Badge variant={config.variant}>{urgency.toUpperCase()}</Badge>;
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'pending':
        return <Clock className="h-6 w-6 text-orange-500 animate-pulse" />;
      case 'not_started':
        return <Clock className="h-6 w-6 text-gray-400" />;
      case 'rejected':
        return <XCircle className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-gray-400" />;
    }
  };

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      await recruitmentApi.updateRequisitionStatus(id!, 'approve', approvalComment);
      toast.success('Requisition approved successfully!');
      // Navigate to approvals page which will refresh automatically
      navigate('/recruitment/approvals', { replace: true });
    } catch (error: any) {
      console.error('Error approving requisition:', error);
      toast.error(error.message || 'Failed to approve requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      await recruitmentApi.updateRequisitionStatus(id!, 'reject', approvalComment);
      toast.success('Requisition rejected');
      // Navigate to approvals page which will refresh automatically
      navigate('/recruitment/approvals', { replace: true });
    } catch (error: any) {
      console.error('Error rejecting requisition:', error);
      toast.error(error.message || 'Failed to reject requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvertise = () => {
    navigate(`/recruitment/requisitions/${id}/advertise`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-12 text-muted-foreground">Loading requisition details...</div>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-12 text-muted-foreground">Requisition not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/recruitment/requisitions')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Requisitions
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Requisition Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{requisition.requisition_id}</Badge>
                    {getStatusBadge(requisition.status)}
                    {getUrgencyBadge(requisition.urgency)}
                  </div>
                  <CardTitle className="text-2xl">{requisition.position}</CardTitle>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{new Date(requisition.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="candidates">Candidates</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6 mt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2">Department</h3>
                      <p className="text-muted-foreground">{requisition.department}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Number of Positions</h3>
                      <p className="text-muted-foreground">{requisition.number_of_positions}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Request Type</h3>
                      <p className="text-muted-foreground capitalize">{requisition.request_type}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Requested By</h3>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="text-muted-foreground">{requisition.requested_by_name}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span 
                          className="text-sm text-primary hover:underline cursor-pointer"
                          onClick={() => navigate("/collaboration/mail", { state: { composeTo: requisition.requested_by_email } })}
                        >
                          {requisition.requested_by_email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Job Description</h3>
                    <div className="bg-muted p-4 rounded-md">
                      <p className="whitespace-pre-wrap">{requisition.job_description}</p>
                    </div>
                  </div>

                  {requisition.requirements && (
                    <div>
                      <h3 className="font-semibold mb-2">Requirements</h3>
                      <div className="bg-muted p-4 rounded-md">
                        <p className="whitespace-pre-wrap">{requisition.requirements}</p>
                      </div>
                    </div>
                  )}

                  {/* Approval Actions */}
                  {(((userRole?.role as string) === 'super_admin' || (userRole?.role as string) === 'admin' || (userRole?.role as string) === 'manager' || (userRole?.role as string) === 'hr_manager' || (userRole?.role as string) === 'hr')) && requisition.status.includes('pending') && (
                    <div className="border-t pt-6 space-y-4">
                      <h3 className="font-semibold">Approval Action</h3>
                      <Textarea
                        placeholder="Add comments (optional)..."
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-4">
                        <Button onClick={handleApprove} className="flex-1" disabled={submitting}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {submitting ? 'Processing...' : 'Approve'}
                        </Button>
                        <Button onClick={handleReject} variant="destructive" className="flex-1" disabled={submitting}>
                          <XCircle className="mr-2 h-4 w-4" />
                          {submitting ? 'Processing...' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* HR Advertisement Action */}
                  {requisition.status === 'approved' && ["super_admin", "admin", "manager"].includes((userRole?.role as string) || "") && (
                    <div className="border-t pt-6">
                      <Button onClick={handleAdvertise} className="w-full" size="lg">
                        <FileText className="mr-2 h-4 w-4" />
                        Publish Advertisement
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Create and publish job advertisement on LinkedIn and other platforms
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="candidates" className="mt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No candidates yet. Advertisement needs to be created first.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Approval Workflow */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {requisition.approvalWorkflow && requisition.approvalWorkflow.map((step: any, index: number) => (
                  <div key={step.step_number} className="relative">
                    {/* Connector Line */}
                    {index < requisition.approvalWorkflow.length - 1 && (
                      <div className="absolute left-3 top-12 bottom-0 w-0.5 bg-border"></div>
                    )}
                    
                    <div className="flex gap-4">
                      <div className="relative z-10">
                        {getStepStatusIcon(step.status)}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-sm">{step.role}</h4>
                          <Badge variant={step.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {step.action}
                          </Badge>
                        </div>
                        {step.approver_name && <p className="text-sm text-muted-foreground">{step.approver_name}</p>}
                        {step.approver_email && (
                          <span 
                            className="text-xs text-primary hover:underline cursor-pointer"
                            onClick={() => navigate("/collaboration/mail", { state: { composeTo: step.approver_email } })}
                          >
                            {step.approver_email}
                          </span>
                        )}
                        {step.action_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(step.action_date).toLocaleString()}
                          </p>
                        )}
                        {step.comments && (
                          <div className="mt-2 bg-muted p-2 rounded text-xs">
                            {step.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

