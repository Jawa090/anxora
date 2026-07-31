import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Calendar, CheckCircle, XCircle, Download, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';
import { ClickToCall } from '@/components/telephony/ClickToCall';
import { SubmittedFormView } from '@/components/recruitment/SubmittedFormView';
import Cookies from 'js-cookie';

export default function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [interviewData, setInterviewData] = useState<{
    interviewType: 'technical' | 'hr' | 'final';
    interviewDate: string;
    interviewTime: string;
    interviewerName: string;
  }>({
    interviewType: 'technical',
    interviewDate: '',
    interviewTime: '',
    interviewerName: ''
  });

  useEffect(() => {
    fetchCandidate();
  }, [id]);

  useEffect(() => {
    // Refresh candidate data when page becomes active
    const interval = setInterval(() => {
      if (id) {
        fetchCandidate();
      }
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [id]);

  const fetchCandidate = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getCandidateById(id!);
      setCandidate(data);
      // Initialize form data
      setFormData(data);
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Failed to load candidate details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Candidate not found</div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      cv_received: { label: 'CV Received', variant: 'secondary' },
      shortlisted: { label: 'Shortlisted', variant: 'default' },
      interview_scheduled: { label: 'Interview Scheduled', variant: 'default' },
      interviewed: { label: 'Interviewed', variant: 'default' },
      final_round: { label: 'Final Round', variant: 'default' },
      selected: { label: 'Selected', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' }
    };

    const config = statusConfig[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleScheduleInterview = () => {
    setInterviewDialogOpen(true);
  };

  const handleSubmitInterview = async () => {
    try {
      await recruitmentApi.scheduleInterview({
        candidateId: candidate.id,
        requisitionId: candidate.requisition_id,
        interviewType: interviewData.interviewType,
        interviewDate: interviewData.interviewDate,
        interviewTime: interviewData.interviewTime,
        interviewerName: interviewData.interviewerName
      });

      toast.success('Interview scheduled successfully!');
      setInterviewDialogOpen(false);

      // Redirect to interviews page
      navigate('/recruitment/interviews');
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      toast.error(error.message || 'Failed to schedule interview');
    }
  };

  const handleGenerateForm = async () => {
    try {
      // Generate a simple application form with candidate data
      const formData = {
        candidateName: candidate.full_name,
        email: candidate.email,
        phone: candidate.phone,
        position: candidate.requisition_position || candidate.applied_position,
        experience: candidate.total_experience,
        education: candidate.highest_qualification,
        currentCompany: candidate.current_company,
        expectedSalary: candidate.expected_salary,
        noticePeriod: candidate.notice_period,
        skills: candidate.skills?.join(', ') || 'N/A',
        appliedDate: new Date(candidate.created_at).toLocaleDateString()
      };

      // Create a printable HTML form
      const formHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Application Form - ${formData.candidateName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px; }
            .section { margin: 30px 0; }
            .field { margin: 15px 0; }
            .label { font-weight: bold; color: #555; display: inline-block; width: 180px; }
            .value { color: #333; }
            .header { text-align: center; margin-bottom: 40px; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Job Application Form</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>

          <div class="section">
            <h2>Personal Information</h2>
            <div class="field"><span class="label">Full Name:</span> <span class="value">${formData.candidateName}</span></div>
            <div class="field"><span class="label">Email:</span> <span class="value">${formData.email}</span></div>
            <div class="field"><span class="label">Phone:</span> <span class="value">${formData.phone}</span></div>
          </div>

          <div class="section">
            <h2>Position Details</h2>
            <div class="field"><span class="label">Applied Position:</span> <span class="value">${formData.position}</span></div>
            <div class="field"><span class="label">Application Date:</span> <span class="value">${formData.appliedDate}</span></div>
          </div>

          <div class="section">
            <h2>Professional Background</h2>
            <div class="field"><span class="label">Total Experience:</span> <span class="value">${formData.experience ? formData.experience + ' years' : 'N/A'}</span></div>
            <div class="field"><span class="label">Current Company:</span> <span class="value">${formData.currentCompany || 'N/A'}</span></div>
            <div class="field"><span class="label">Highest Qualification:</span> <span class="value">${formData.education || 'N/A'}</span></div>
            <div class="field"><span class="label">Skills:</span> <span class="value">${formData.skills}</span></div>
          </div>

          <div class="section">
            <h2>Compensation & Availability</h2>
            <div class="field"><span class="label">Expected Salary:</span> <span class="value">${formData.expectedSalary ? 'PKR ' + formData.expectedSalary : 'N/A'}</span></div>
            <div class="field"><span class="label">Notice Period:</span> <span class="value">${formData.noticePeriod || 'N/A'}</span></div>
          </div>

          <div class="footer">
            <p>This is an auto-generated application form</p>
            <p>For internal use only</p>
          </div>
        </body>
        </html>
      `;

      // Open in new window for printing/saving
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(formHTML);
        printWindow.document.close();
        printWindow.focus();

        // Auto-trigger print dialog after a short delay
        setTimeout(() => {
          printWindow.print();
        }, 500);

        toast.success('Application form generated! You can now print or save as PDF.');
      } else {
        toast.error('Please allow popups to generate the form');
      }
    } catch (error) {
      console.error('Error generating form:', error);
      toast.error('Failed to generate application form');
    }
  };

  const handleSelect = async () => {
    try {
      // Update candidate status to 'final_round'
      await recruitmentApi.updateCandidateStatus(candidate.id, 'final_round');

      // Schedule final interview
      setInterviewData({
        interviewType: 'final',
        interviewDate: '',
        interviewTime: '',
        interviewerName: ''
      });
      setInterviewDialogOpen(true);

      toast.success('Candidate moved to final round!');
      fetchCandidate();
    } catch (error) {
      toast.error('Failed to select candidate');
    }
  };

  const handleReject = async () => {
    try {
      await recruitmentApi.updateCandidateStatus(candidate.id, 'rejected');
      toast.success('Candidate rejected');
      navigate('/recruitment/candidates');
    } catch (error) {
      toast.error('Failed to reject candidate');
    }
  };

  const handleDownloadCV = async () => {
    try {
      const token = Cookies.get('token');
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_BASE_URL}/recruitment/candidates/${candidate.id}/cv`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download CV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.full_name}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Failed to download CV');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => {
          // If coming from interviews page, go back with tab state
          if (location.state?.from === 'interviews' && location.state?.activeTab) {
            navigate('/recruitment/interviews', {
              state: { activeTab: location.state.activeTab }
            });
          } else if (location.state?.from === 'interviews') {
            // If no specific tab, go back to hr tab (default)
            navigate('/recruitment/interviews', {
              state: { activeTab: 'hr' }
            });
          } else {
            // Default: go to candidates list
            navigate('/recruitment/candidates');
          }
        }}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Candidate Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{candidate.full_name}</CardTitle>
                {getStatusBadge(candidate.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Position</p>
                <p className="font-medium">{candidate.requisition_position || candidate.applied_position || 'N/A'}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span
                    className="text-primary hover:underline cursor-pointer"
                    onClick={() => navigate("/collaboration/mail", { state: { composeTo: candidate.email } })}
                  >
                    {candidate.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <ClickToCall
                    phoneNumber={candidate.phone}
                    entityType="contact"
                    entityId={candidate.id}
                    className="text-primary hover:underline"
                  />
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Experience</p>
                  <p className="font-medium">{candidate.total_experience ? `${candidate.total_experience} years` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Designation</p>
                  <p className="font-medium">{candidate.current_designation || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Company</p>
                  <p className="font-medium">{candidate.current_company || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Education</p>
                  <p className="font-medium">{candidate.highest_qualification || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Salary</p>
                  <p className="font-medium">{candidate.current_salary ? `PKR ${candidate.current_salary}` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Salary</p>
                  <p className="font-medium">{candidate.expected_salary ? `PKR ${candidate.expected_salary}` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Notice Period</p>
                  <p className="font-medium">{candidate.notice_period ? `${candidate.notice_period} days` : 'N/A'}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadCV}
                  disabled={!candidate.cv_url}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(candidate.status === 'shortlisted' || candidate.status === 'screened_passed') && (
                <>
                  {/* <Button onClick={handleGenerateForm} className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Application Form
                  </Button> */}
                  {/* <Button onClick={handleScheduleInterview} variant="outline" className="w-full">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Interview
                  </Button> */}
                </>
              )}

              {/* {candidate.status === 'interviewed' && (
                <>
                  <Button onClick={handleSelect} className="w-full">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Select for Final Round
                  </Button>
                  <Button onClick={handleReject} variant="destructive" className="w-full">
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}  */}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="form">Submitted Form</TabsTrigger>
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                  <TabsTrigger value="interviews">Interview History</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="space-y-4 mt-6">
                  <SubmittedFormView candidate={candidate} />
                </TabsContent>

                <TabsContent value="skills" className="space-y-4 mt-6">
                  <div>
                    <h3 className="font-semibold mb-3">Technical Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills && candidate.skills.length > 0 ? (
                        candidate.skills.map((skill: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-sm">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No skills listed</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="interviews" className="space-y-4 mt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No interviews conducted yet</p>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4 mt-6">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="w-0.5 h-full bg-border mt-2"></div>
                      </div>
                      <div className="pb-8">
                        <p className="font-medium">Application Received</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(candidate.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {candidate.status !== 'cv_received' && (
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div className="w-0.5 h-full bg-border mt-2"></div>
                        </div>
                        <div className="pb-8">
                          <p className="font-medium">{candidate.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(candidate.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Pending Next Steps</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Interview Scheduling Dialog */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {candidate.full_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {candidate.requisition_position || 'N/A'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewType">Interview Type *</Label>
              <Select
                value={interviewData.interviewType}
                onValueChange={(value: 'technical' | 'hr' | 'final') =>
                  setInterviewData({ ...interviewData, interviewType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr">HR Interview</SelectItem>
                  <SelectItem value="technical">Technical Interview</SelectItem>
                  <SelectItem value="final">Final Interview</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewDate">Interview Date *</Label>
              <Input
                id="interviewDate"
                type="date"
                value={interviewData.interviewDate}
                onChange={(e) => setInterviewData({ ...interviewData, interviewDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewTime">Interview Time *</Label>
              <Input
                id="interviewTime"
                type="time"
                value={interviewData.interviewTime}
                onChange={(e) => setInterviewData({ ...interviewData, interviewTime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewerName">Interviewer Name *</Label>
              <Input
                id="interviewerName"
                value={interviewData.interviewerName}
                onChange={(e) => setInterviewData({ ...interviewData, interviewerName: e.target.value })}
                placeholder="Enter interviewer name"
              />
            </div>

            <Button
              onClick={handleSubmitInterview}
              className="w-full"
              disabled={!interviewData.interviewDate || !interviewData.interviewTime || !interviewData.interviewerName}
            >
              Schedule Interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}

