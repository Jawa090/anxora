import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';
import { SubmittedFormView } from '@/components/recruitment/SubmittedFormView';

export default function InterviewPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [interviewData, setInterviewData] = useState({
    interviewDate: '',
    interviewTime: '',
    interviewType: 'technical',
    interviewer: '',
    technicalSkills: '',
    communication: '',
    problemSolving: '',
    cultureFit: '',
    overallRemarks: '',
    recommendation: 'pending'
  });

  useEffect(() => {
    fetchCandidate();
  }, [candidateId]);

  useEffect(() => {
    // Refresh candidate data when page becomes active
    const interval = setInterval(() => {
      if (candidateId) {
        fetchCandidate();
      }
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [candidateId]);

  const fetchCandidate = async () => {
    try {
      setLoading(true);
      if (candidateId) {
        const data = await recruitmentApi.getCandidateById(candidateId);
        setCandidate(data);
      }
    } catch (error) {
      console.error('Error fetching candidate:', error);
      toast.error('Failed to load candidate details');
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    const fields = [
      interviewData.interviewDate,
      interviewData.interviewTime,
      interviewData.interviewer,
      interviewData.technicalSkills,
      interviewData.communication,
      interviewData.problemSolving,
      interviewData.cultureFit,
      interviewData.overallRemarks,
      interviewData.recommendation !== 'pending'
    ];

    const filledFields = fields.filter(field => {
      if (typeof field === 'boolean') return field;
      return field && field.toString().trim().length > 0;
    }).length;

    return (filledFields / fields.length) * 100;
  };

  const handleBackClick = () => {
    // Check if there's a previous location state with tab info
    const previousTab = location.state?.tab || 'scheduled';
    navigate('/recruitment/interviews', { state: { activeTab: previousTab } });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!candidateId) {
        toast.error('Candidate ID is missing');
        return;
      }

      // Get the interview ID from candidate data
      const interviewId = candidate?.interview_id;
      if (!interviewId) {
        toast.error('No interview found for this candidate');
        return;
      }

      // Prepare feedback data
      const feedbackData = {
        interviewDate: interviewData.interviewDate,
        interviewTime: interviewData.interviewTime,
        interviewType: interviewData.interviewType,
        interviewer: interviewData.interviewer,
        technicalSkills: interviewData.technicalSkills,
        communication: interviewData.communication,
        problemSolving: interviewData.problemSolving,
        cultureFit: interviewData.cultureFit,
        overallRemarks: interviewData.overallRemarks,
        recommendation: interviewData.recommendation
      };

      // Call API to save feedback
      await recruitmentApi.submitFeedback(interviewId, feedbackData);

      toast.success('Interview feedback saved successfully!');
      const previousTab = location.state?.tab || 'scheduled';
      navigate('/recruitment/interviews', { state: { activeTab: previousTab } });
    } catch (error) {
      console.error('Error saving interview feedback:', error);
      toast.error('Failed to save interview feedback');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Loading candidate details...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Button
        variant="ghost"
        onClick={handleBackClick}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Interviews
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Candidate Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{candidate?.full_name || 'Unknown'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Position</p>
                <p className="font-medium">{candidate?.applied_position || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium text-primary">{candidate?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="font-medium">{candidate?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Experience</p>
                <p className="font-medium">{candidate?.total_experience ? `${candidate.total_experience} years` : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Interview & Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="interview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="interview">Interview Feedback</TabsTrigger>
                  <TabsTrigger value="form">Submitted Form</TabsTrigger>
                </TabsList>

                {/* Interview Feedback Tab */}
                <TabsContent value="interview" className="mt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Form Completion</span>
                        <span className="font-semibold text-primary">
                          {Math.round(calculateProgress())}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${calculateProgress()}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Interview Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="interviewDate">Interview Date</Label>
                        <Input
                          id="interviewDate"
                          type="date"
                          value={interviewData.interviewDate}
                          onChange={(e) => setInterviewData({ ...interviewData, interviewDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="interviewTime">Interview Time</Label>
                        <Input
                          id="interviewTime"
                          type="time"
                          value={interviewData.interviewTime}
                          onChange={(e) => setInterviewData({ ...interviewData, interviewTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="interviewType">Interview Type</Label>
                        <Select
                          value={interviewData.interviewType}
                          onValueChange={(value) => setInterviewData({ ...interviewData, interviewType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="technical">Technical</SelectItem>
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="final">Final Round</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="interviewer">Interviewer Name</Label>
                        <Input
                          id="interviewer"
                          value={interviewData.interviewer}
                          onChange={(e) => setInterviewData({ ...interviewData, interviewer: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Evaluation Criteria */}
                    <div className="space-y-4 border-t pt-6">
                      <h3 className="font-semibold text-lg">Evaluation</h3>

                      <div className="space-y-2">
                        <Label htmlFor="technicalSkills">Technical Skills</Label>
                        <Textarea
                          id="technicalSkills"
                          value={interviewData.technicalSkills}
                          onChange={(e) => setInterviewData({ ...interviewData, technicalSkills: e.target.value })}
                          placeholder="Evaluate technical knowledge and skills..."
                          rows={3}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="communication">Communication Skills</Label>
                        <Textarea
                          id="communication"
                          value={interviewData.communication}
                          onChange={(e) => setInterviewData({ ...interviewData, communication: e.target.value })}
                          placeholder="Evaluate communication and presentation skills..."
                          rows={3}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="problemSolving">Problem Solving</Label>
                        <Textarea
                          id="problemSolving"
                          value={interviewData.problemSolving}
                          onChange={(e) => setInterviewData({ ...interviewData, problemSolving: e.target.value })}
                          placeholder="Evaluate problem-solving approach..."
                          rows={3}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cultureFit">Culture Fit</Label>
                        <Textarea
                          id="cultureFit"
                          value={interviewData.cultureFit}
                          onChange={(e) => setInterviewData({ ...interviewData, cultureFit: e.target.value })}
                          placeholder="Evaluate alignment with company culture..."
                          rows={3}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="overallRemarks">Overall Remarks</Label>
                        <Textarea
                          id="overallRemarks"
                          value={interviewData.overallRemarks}
                          onChange={(e) => setInterviewData({ ...interviewData, overallRemarks: e.target.value })}
                          placeholder="Overall assessment and additional comments..."
                          rows={4}
                          required
                        />
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="space-y-2 border-t pt-6">
                      <Label htmlFor="recommendation">Recommendation</Label>
                      <Select
                        value={interviewData.recommendation}
                        onValueChange={(value) => setInterviewData({ ...interviewData, recommendation: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strongly_recommend">Strongly Recommend</SelectItem>
                          <SelectItem value="recommend">Recommend</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                          <SelectItem value="not_recommend">Not Recommend</SelectItem>
                          <SelectItem value="reject">Reject</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                      <Button type="submit" className="flex-1">
                        <Save className="mr-2 h-4 w-4" />
                        Save Feedback
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBackClick}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                {/* Submitted Form Tab */}
                <TabsContent value="form" className="mt-6">
                  <SubmittedFormView candidate={candidate} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
