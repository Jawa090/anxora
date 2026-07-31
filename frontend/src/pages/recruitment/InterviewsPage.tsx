import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  User,
  Play,
  CheckCircle,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { recruitmentApi } from "@/lib/api";

interface Interview {
  id: string;
  candidate_id: string;
  requisition_id: string;
  candidate_name: string;
  position: string;
  interview_type: "hr" | "technical" | "final";
  interview_date: string;
  interview_time: string;
  interviewer_name: string;
  status: "scheduled" | "in_progress" | "completed";
  recommendation?: string;
  technical_skills?: string;
  communication?: string;
  problem_solving?: string;
  culture_fit?: string;
  overall_remarks?: string;
  final_result?: "selected" | "rejected";
  candidate_status?: string;
  form_status?: string;
}

interface InterviewStats {
  scheduled_count: number;
  in_progress_count: number;
  completed_count: number;
  rejected_count: number;
  hr_count: number;
  technical_count: number;
  final_count: number;
}

export default function InterviewsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<InterviewStats>({
    scheduled_count: 0,
    in_progress_count: 0,
    completed_count: 0,
    rejected_count: 0,
    hr_count: 0,
    technical_count: 0,
    final_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    // Check if we're coming from back navigation (from CandidateDetailPage)
    // location.state will exist ONLY if navigated from another page
    // On page refresh, location.state is cleared
    if (location.state?.from === 'interviews' && location.state?.activeTab) {
      return location.state.activeTab;
    }

    // Otherwise, try to get from localStorage (persists across refreshes)
    const savedTab = localStorage.getItem('interviewsActiveTab');
    return savedTab || 'scheduled';
  });
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectRejectDialogOpen, setSelectRejectDialogOpen] = useState(false);
  const [scheduleNextInterviewOpen, setScheduleNextInterviewOpen] =
    useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(
    null,
  );
  const [nextInterviewType, setNextInterviewType] = useState<
    "technical" | "final" | null
  >(null);
  const [nextInterviewData, setNextInterviewData] = useState({
    interviewDate: "",
    interviewTime: "",
    interviewerName: "",
  });
  const [feedbackData, setFeedbackData] = useState({
    technicalSkills: "",
    communication: "",
    problemSolving: "",
    cultureFit: "",
    overallRemarks: "",
    recommendation: "recommend",
  });
  const [generateFormDialogOpen, setGenerateFormDialogOpen] = useState(false);
  const [generatedFormData, setGeneratedFormData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      await fetchInterviews();
      await fetchStats();
    };
    loadData();
  }, [activeTab]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('interviewsActiveTab', activeTab);
  }, [activeTab]);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      let params: any = {};

      // Filter by tab
      if (activeTab === "scheduled") {
        params.status = "scheduled";
      } else if (activeTab === "in_progress") {
        params.status = "in_progress";
      } else if (activeTab === "completed") {
        params.status = "completed";
        // Only show final interviews that were accepted (final_result = 'selected')
        params.finalResult = "selected";
      } else if (activeTab === "rejected") {
        // Show interviews with reject recommendation or final_result = 'rejected'
        params.status = "completed";
        params.isRejected = true;
      } else if (["hr", "technical", "final"].includes(activeTab)) {
        params.interviewType = activeTab;
        // IMPORTANT: Only show COMPLETED interviews for type-based tabs
        params.status = "completed";
      }

      let data = await recruitmentApi.getAllInterviews(params);

      // Extra frontend filtering for type-based tabs to ensure correctness
      if (["hr", "technical", "final"].includes(activeTab)) {
        data = data.filter((interview) => {
          const isCorrectType =
            interview.status === "completed" &&
            interview.interview_type === activeTab;

          // For final tab: only show if final_result is NOT set yet
          if (activeTab === "final") {
            return isCorrectType && !interview.final_result;
          }

          return isCorrectType;
        });

        // CRITICAL: For HR and Technical tabs, only show if this is the candidate's LATEST completed interview type
        if (activeTab === "hr" || activeTab === "technical") {
          // Create a map of candidate_id -> latest_interview_type
          const latestInterviewByCandidate = new Map();

          // Get all interviews (not just completed) for all candidates
          const allInterviews = await recruitmentApi.getAllInterviews({});

          // Determine the latest interview for each candidate (regardless of status)
          for (const interview of allInterviews) {
            const candidateId = interview.candidate_id;
            const priority = {
              final: 3,
              technical: 2,
              hr: 1,
            };

            const current = latestInterviewByCandidate.get(candidateId);
            if (
              !current ||
              priority[interview.interview_type] >
              priority[current.interview_type]
            ) {
              latestInterviewByCandidate.set(candidateId, interview);
            }
          }

          // Filter to only show interviews that are the candidate's latest
          data = data.filter((interview) => {
            const latest = latestInterviewByCandidate.get(
              interview.candidate_id,
            );
            return latest && latest.interview_type === interview.interview_type;
          });
        }
      }

      // For Selected (completed) tab: Only show interviews with final_result = 'selected'
      if (activeTab === "completed") {
        data = data.filter(
          (interview) => interview.final_result === "selected",
        );
      }

      // For Rejected tab: Only show interviews with final_result = 'rejected'
      if (activeTab === "rejected") {
        data = data.filter(
          (interview) => interview.final_result === "rejected",
        );
      }

      setInterviews(data);
    } catch (error) {
      console.error("Error fetching interviews:", error);
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await recruitmentApi.getInterviewStats();

      // Fetch ALL interviews to calculate correct counts
      const allInterviews = await recruitmentApi.getAllInterviews({});

      // Create a map of candidate_id -> OVERALL latest_interview_type (regardless of status)
      const latestInterviewByCandidate = new Map();
      const priority = {
        final: 3,
        technical: 2,
        hr: 1,
      };

      for (const interview of allInterviews) {
        const candidateId = interview.candidate_id;
        const current = latestInterviewByCandidate.get(candidateId);
        if (
          !current ||
          priority[interview.interview_type] > priority[current.interview_type]
        ) {
          latestInterviewByCandidate.set(candidateId, interview);
        }
      }

      // Count only COMPLETED interviews that are the candidate's LATEST interview type
      const completedInterviews = allInterviews.filter(
        (i) => i.status === "completed",
      );

      const hrCount = completedInterviews.filter((i) => {
        const latest = latestInterviewByCandidate.get(i.candidate_id);
        return i.interview_type === "hr" && latest?.interview_type === "hr";
      }).length;

      const technicalCount = completedInterviews.filter((i) => {
        const latest = latestInterviewByCandidate.get(i.candidate_id);
        return (
          i.interview_type === "technical" &&
          latest?.interview_type === "technical"
        );
      }).length;

      const finalCount = completedInterviews.filter((i) => {
        const latest = latestInterviewByCandidate.get(i.candidate_id);
        return (
          i.interview_type === "final" &&
          latest?.interview_type === "final" &&
          !i.final_result
        );
      }).length;

      // Count only SELECTED candidates (final_result = 'selected')
      const selectedCount = allInterviews.filter(
        (i) => i.final_result === "selected",
      ).length;

      // Count rejected candidates
      const rejectedCount = allInterviews.filter(
        (i) =>
          i.final_result === "rejected" ||
          (i.status === "completed" && i.recommendation === "reject"),
      ).length;

      setStats({
        ...data,
        hr_count: hrCount,
        technical_count: technicalCount,
        final_count: finalCount,
        completed_count: selectedCount,
        rejected_count: rejectedCount,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Check if candidate has completed both HR and Technical interviews
  // (Can be used for conditional rendering of Final Interview tab)
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: any; icon: any }
    > = {
      scheduled: { label: "Scheduled", variant: "secondary", icon: Calendar },
      in_progress: { label: "In Progress", variant: "default", icon: Play },
      completed: { label: "Completed", variant: "default", icon: CheckCircle },
    };

    const config = statusConfig[status] || {
      label: status,
      variant: "secondary",
      icon: Calendar,
    };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getInterviewTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; color: string }> = {
      technical: { label: "Technical", color: "bg-blue-100 text-blue-800" },
      hr: { label: "HR", color: "bg-green-100 text-green-800" },
      final: { label: "Final", color: "bg-purple-100 text-purple-800" },
    };

    const config = typeConfig[type] || {
      label: type,
      color: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const getRecommendationColor = (recommendation: string) => {
    const colors: Record<string, string> = {
      strongly_recommend: "bg-green-100 text-green-800",
      recommend: "bg-emerald-100 text-emerald-800",
      maybe: "bg-yellow-100 text-yellow-800",
      not_recommend: "bg-orange-100 text-orange-800",
      reject: "bg-red-100 text-red-800",
    };
    return colors[recommendation] || "bg-gray-100 text-gray-800";
  };

  const getRecommendationLabel = (recommendation: string) => {
    const labels: Record<string, string> = {
      strongly_recommend: "⭐ Strongly Recommend",
      recommend: "✅ Recommend",
      maybe: "🤔 Maybe",
      not_recommend: "❌ Not Recommend",
      reject: "🚫 Reject",
    };
    return labels[recommendation] || recommendation;
  };

  const handleConductInterview = async (interviewId: string) => {
    try {
      await recruitmentApi.conductInterview(interviewId);
      toast.success("Interview started!");
      fetchInterviews();
      fetchStats();
    } catch (error: any) {
      console.error("Error conducting interview:", error);
      toast.error(error.message || "Failed to start interview");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedInterview) return;

    try {
      await recruitmentApi.submitFeedback(selectedInterview.id, feedbackData);
      toast.success("Interview feedback submitted!");
      setFeedbackDialogOpen(false);
      resetFeedbackForm();

      setSelectedInterview(null);
      await fetchInterviews();
      await fetchStats();

      // Auto-navigate to appropriate tab based on interview type
      if (selectedInterview.interview_type === "final") {
        setActiveTab("final");
      } else if (selectedInterview.interview_type === "technical") {
        setActiveTab("technical");
      } else if (selectedInterview.interview_type === "hr") {
        setActiveTab("hr");
      }
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast.error(error.message || "Failed to submit feedback");
    }
  };

  const handleFinalDecision = async (decision: "selected" | "rejected") => {
    if (!selectedInterview) return;

    try {
      // If rejecting at any stage (HR, Technical, or Final)
      if (decision === "rejected") {
        const payload: any = {
          technicalSkills: feedbackData.technicalSkills || "Not evaluated yet",
          communication: feedbackData.communication || "Not evaluated yet",
          problemSolving: feedbackData.problemSolving || "Not evaluated yet",
          cultureFit: feedbackData.cultureFit || "Not evaluated yet",
          overallRemarks: feedbackData.overallRemarks || "Candidate rejected",
          recommendation: "reject",
        };

        if (selectedInterview.interview_type === "final") {
          payload.finalResult = "rejected";
        }

        await recruitmentApi.submitFeedback(selectedInterview.id, payload);
        toast.success("Candidate rejected!");
        setSelectRejectDialogOpen(false);
        resetFeedbackForm();
        setSelectedInterview(null);
        await fetchInterviews();
        await fetchStats();
        setActiveTab("rejected");
      } else if (decision === "selected") {
        // If Final interview - mark as selected
        if (selectedInterview.interview_type === "final") {
          const payload: any = {
            technicalSkills:
              feedbackData.technicalSkills || "Not evaluated yet",
            communication: feedbackData.communication || "Not evaluated yet",
            problemSolving: feedbackData.problemSolving || "Not evaluated yet",
            cultureFit: feedbackData.cultureFit || "Not evaluated yet",
            overallRemarks:
              feedbackData.overallRemarks || "Candidate selected for position",
            recommendation: "strongly_recommend",
            finalResult: "selected",
          };

          await recruitmentApi.submitFeedback(selectedInterview.id, payload);
          toast.success("Candidate selected! 🎉");
          setSelectRejectDialogOpen(false);
          resetFeedbackForm();
          setSelectedInterview(null);
          await fetchInterviews();
          await fetchStats();
          setActiveTab("completed");
        } else {
          // For HR or Technical - prepare to schedule next interview
          setSelectRejectDialogOpen(false);
          const nextType =
            selectedInterview.interview_type === "hr" ? "technical" : "final";
          setNextInterviewType(nextType);
          setScheduleNextInterviewOpen(true);
          return;
        }
      }
    } catch (error: any) {
      console.error("Error making decision:", error);
      toast.error(error.message || "Failed to make decision");
    }
  };

  const handleScheduleNextInterview = async () => {
    if (!selectedInterview || !nextInterviewType) return;

    try {
      // First submit feedback for current interview (with default/empty values if not filled)
      const feedbackPayload: any = {
        technicalSkills: feedbackData.technicalSkills || "Not evaluated yet",
        communication: feedbackData.communication || "Not evaluated yet",
        problemSolving: feedbackData.problemSolving || "Not evaluated yet",
        cultureFit: feedbackData.cultureFit || "Not evaluated yet",
        overallRemarks:
          feedbackData.overallRemarks || "Proceeding to next round",
        recommendation: feedbackData.recommendation || "recommend",
      };

      await recruitmentApi.submitFeedback(
        selectedInterview.id,
        feedbackPayload,
      );

      // Then schedule next interview with correct requisition_id
      await recruitmentApi.scheduleInterview({
        candidateId: selectedInterview.candidate_id,
        requisitionId: selectedInterview.requisition_id,
        interviewType: nextInterviewType,
        interviewDate: nextInterviewData.interviewDate,
        interviewTime: nextInterviewData.interviewTime,
        interviewerName: nextInterviewData.interviewerName,
      });

      toast.success(`${nextInterviewType.toUpperCase()} interview scheduled!`);
      setScheduleNextInterviewOpen(false);
      resetFeedbackForm();
      setNextInterviewData({
        interviewDate: "",
        interviewTime: "",
        interviewerName: "",
      });
      setNextInterviewType(null);
      setSelectedInterview(null);

      // Refresh data and navigate to Scheduled tab
      await fetchInterviews();
      await fetchStats();
      setActiveTab("scheduled");
    } catch (error: any) {
      console.error("Error scheduling next interview:", error);
      toast.error(error.message || "Failed to schedule next interview");
    }
  };

  const resetFeedbackForm = () => {
    setFeedbackData({
      technicalSkills: "",
      communication: "",
      problemSolving: "",
      cultureFit: "",
      overallRemarks: "",
      recommendation: "recommend",
    });
  };

  const handleGenerateForm = async (interview: Interview) => {
    try {
      setSelectedInterview(interview);
      const result = await recruitmentApi.generateApplicationForm(interview.candidate_id);

      setGeneratedFormData({
        ...result,
        candidateName: interview.candidate_name,
        candidatePosition: interview.position,
      });
      setGenerateFormDialogOpen(true);

      // Refresh data to get updated status
      await fetchInterviews();
      await fetchStats();
    } catch (error: any) {
      console.error("Error generating form:", error);
      toast.error(error.message || "Failed to generate form link");
    }
  };

  const copyFormLink = () => {
    if (generatedFormData?.formUrl) {
      navigator.clipboard.writeText(generatedFormData.formUrl);
      toast.success("Form link copied to clipboard!");
    }
  };

  const openFormLink = () => {
    if (generatedFormData?.formUrl) {
      window.open(generatedFormData.formUrl, "_blank");
    }
  };

  const handleGenerateFormDialogClose = async (open: boolean) => {
    setGenerateFormDialogOpen(open);
    if (!open) {
      // Refresh data when dialog closes
      await fetchInterviews();
      await fetchStats();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderInterviewCard = (interview: Interview) => {
    return (
      <Card key={interview.id} className="hover:shadow-md transition-shadow">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Status and Type Badges (Top) */}
            <div className="flex gap-2 flex-wrap items-center">
              {getStatusBadge(interview.status)}
              {getInterviewTypeBadge(interview.interview_type)}
              {interview.final_result && (
                <Badge
                  variant={
                    interview.final_result === "selected"
                      ? "default"
                      : "destructive"
                  }
                >
                  {interview.final_result === "selected"
                    ? "✅ Selected"
                    : "❌ Rejected"}
                </Badge>
              )}

              {/* Form Status Badge - Show in HR tab */}
              {activeTab === "hr" && interview.interview_type === "hr" && (
                <Badge
                  variant={
                    interview.form_status === "submitted"
                      ? "default"
                      : interview.form_status === "generated"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {interview.form_status === "submitted"
                    ? "📋 Form Submitted"
                    : interview.form_status === "generated"
                      ? "📋 Form Generated"
                      : "📋 No Form"}
                </Badge>
              )}
            </div>

            {/* Header with Candidate Name and Status */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {interview.candidate_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {interview.position}
                </p>
              </div>
            </div>

            {/* Interview Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <div>
                  <p className="font-medium text-foreground">
                    {formatDate(interview.interview_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <div>
                  <p className="font-medium text-foreground">
                    {formatTime(interview.interview_time)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <div>
                  <p className="font-medium text-foreground">
                    {interview.interviewer_name}
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback Summary (for completed interviews) */}
            {interview.status === "completed" && interview.recommendation && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Recommendation:</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getRecommendationColor(interview.recommendation)}`}
                  >
                    {getRecommendationLabel(interview.recommendation)}
                  </span>
                </div>
                {interview.overall_remarks && (
                  <p className="text-sm text-muted-foreground">
                    {interview.overall_remarks}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {/* Scheduled -> Start Interview */}
              {interview.status === "scheduled" && (
                <Button
                  size="sm"
                  onClick={() => handleConductInterview(interview.id)}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Interview
                </Button>
              )}

              {/* In Progress -> Submit Feedback */}
              {interview.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedInterview(interview);
                    setFeedbackDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Submit Feedback
                </Button>
              )}

              {/* Completed Final Interview -> Select/Reject Buttons (ONLY in Final tab, not in Completed tab) */}
              {interview.status === "completed" &&
                interview.interview_type === "final" &&
                !interview.final_result &&
                activeTab === "final" && (
                  <>
                    {/* Show Generate Form button for Final tab */}
                    {interview.form_status !== "submitted" && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateForm(interview)}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Generate Form
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedInterview(interview);
                        setSelectRejectDialogOpen(true);
                      }}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Selected for Candidate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedInterview(interview);
                        setSelectRejectDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}

              {/* Completed HR or Technical Interview -> Accept/Reject for next round */}
              {interview.status === "completed" &&
                (interview.interview_type === "hr" ||
                  interview.interview_type === "technical") &&
                (!interview.recommendation ||
                  interview.recommendation !== "reject") && (
                  <>
                    {/* For HR and Technical tabs - show Generate Form button based on form_status */}
                    {(activeTab === "hr" || activeTab === "technical") && interview.form_status !== "submitted" && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateForm(interview)}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Generate Form
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedInterview(interview);
                        setSelectRejectDialogOpen(true);
                      }}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {interview.interview_type === "hr"
                        ? "Select for Technical"
                        : "Select for Final"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedInterview(interview);
                        setSelectRejectDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}

              {/* Completed Final with Result */}
              {interview.final_result && (
                <Badge
                  variant={
                    interview.final_result === "selected"
                      ? "default"
                      : "destructive"
                  }
                >
                  {interview.final_result === "selected"
                    ? "✅ Selected"
                    : "❌ Rejected"}
                </Badge>
              )}

              {/* Show if Rejected */}
              {interview.recommendation === "reject" &&
                !interview.final_result && (
                  <Badge variant="destructive">❌ Rejected</Badge>
                )}

              {/* View Candidate */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/recruitment/candidates/${interview.candidate_id}`, {
                    state: {
                      from: 'interviews',
                      activeTab: activeTab
                    }
                  })
                }
                className="gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                View Candidate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Interviews</h1>
        <Button
          variant="outline"
          onClick={() => {
            fetchInterviews();
            fetchStats();
          }}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Scheduled
                </p>
                <p className="text-2xl font-bold">
                  {stats.scheduled_count || 0}
                </p>
              </div>
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  In Progress
                </p>
                <p className="text-2xl font-bold">
                  {stats.in_progress_count || 0}
                </p>
              </div>
              <Play className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">HR</p>
                <p className="text-2xl font-bold">{stats.hr_count || 0}</p>
              </div>
              <User className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Technical
                </p>
                <p className="text-2xl font-bold">
                  {stats.technical_count || 0}
                </p>
              </div>
              <User className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Final
                </p>
                <p className="text-2xl font-bold">{stats.final_count || 0}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Selected
                </p>
                <p className="text-2xl font-bold">
                  {stats.completed_count || 0}
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Rejected
                </p>
                <p className="text-2xl font-bold">
                  {stats.rejected_count || 0}
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          localStorage.setItem('interviewsActiveTab', tab);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="scheduled" className="text-xs sm:text-sm">
            Scheduled ({stats.scheduled_count || 0})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="text-xs sm:text-sm">
            In Progress ({stats.in_progress_count || 0})
          </TabsTrigger>
          <TabsTrigger value="hr" className="text-xs sm:text-sm">
            HR ({stats.hr_count || 0})
          </TabsTrigger>
          <TabsTrigger value="technical" className="text-xs sm:text-sm">
            Technical ({stats.technical_count || 0})
          </TabsTrigger>
          <TabsTrigger value="final" className="text-xs sm:text-sm">
            Final ({stats.final_count || 0})
          </TabsTrigger>

          <TabsTrigger value="completed" className="text-xs sm:text-sm">
            Selected ({stats.completed_count || 0})
          </TabsTrigger>

          <TabsTrigger value="rejected" className="text-xs sm:text-sm">
            Rejected ({stats.rejected_count || 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        {[
          "scheduled",
          "hr",
          "technical",
          "final",
          "in_progress",
          "completed",
          "rejected",
        ].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading interviews...
              </div>
            ) : interviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No interviews in this category
              </div>
            ) : (
              <div className="space-y-4">
                {interviews.map((interview) => renderInterviewCard(interview))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Interview Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Candidate Info */}
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="font-medium">{selectedInterview?.candidate_name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedInterview?.interview_type.toUpperCase()} Interview •{" "}
                {selectedInterview?.position}
              </p>
            </div>

            {/* Feedback Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="technicalSkills">Technical Skills</Label>
                <Textarea
                  id="technicalSkills"
                  value={feedbackData.technicalSkills}
                  onChange={(e) =>
                    setFeedbackData({
                      ...feedbackData,
                      technicalSkills: e.target.value,
                    })
                  }
                  placeholder="Evaluate technical competency..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="communication">Communication</Label>
                <Textarea
                  id="communication"
                  value={feedbackData.communication}
                  onChange={(e) =>
                    setFeedbackData({
                      ...feedbackData,
                      communication: e.target.value,
                    })
                  }
                  placeholder="Assess communication skills..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="problemSolving">Problem Solving</Label>
                <Textarea
                  id="problemSolving"
                  value={feedbackData.problemSolving}
                  onChange={(e) =>
                    setFeedbackData({
                      ...feedbackData,
                      problemSolving: e.target.value,
                    })
                  }
                  placeholder="Evaluate problem-solving approach..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cultureFit">Culture Fit</Label>
                <Textarea
                  id="cultureFit"
                  value={feedbackData.cultureFit}
                  onChange={(e) =>
                    setFeedbackData({
                      ...feedbackData,
                      cultureFit: e.target.value,
                    })
                  }
                  placeholder="Assess cultural alignment..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overallRemarks">Overall Remarks</Label>
              <Textarea
                id="overallRemarks"
                value={feedbackData.overallRemarks}
                onChange={(e) =>
                  setFeedbackData({
                    ...feedbackData,
                    overallRemarks: e.target.value,
                  })
                }
                placeholder="Overall assessment and key observations..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendation">Recommendation</Label>
              <Select
                value={feedbackData.recommendation}
                onValueChange={(value) =>
                  setFeedbackData({ ...feedbackData, recommendation: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strongly_recommend">
                    ⭐ Strongly Recommend
                  </SelectItem>
                  <SelectItem value="recommend">✅ Recommend</SelectItem>
                  <SelectItem value="maybe">🤔 Maybe</SelectItem>
                  <SelectItem value="not_recommend">
                    ❌ Not Recommend
                  </SelectItem>
                  <SelectItem value="reject">🚫 Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSubmitFeedback} className="w-full">
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Final Decision Dialog (Select/Reject) */}
      <Dialog
        open={selectRejectDialogOpen}
        onOpenChange={setSelectRejectDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedInterview?.interview_type === "final"
                ? "Final Decision"
                : selectedInterview?.interview_type === "hr"
                  ? "HR Interview Decision"
                  : "Technical Interview Decision"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Candidate Info */}
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="font-medium">{selectedInterview?.candidate_name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedInterview?.position}
              </p>
            </div>

            {selectedInterview?.interview_type === "final" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Select whether to move forward with this candidate or reject
                  them.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleFinalDecision("selected")}
                    className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Select
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleFinalDecision("rejected")}
                    className="flex-1 gap-2"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </>
            ) : selectedInterview?.interview_type === "hr" ||
              selectedInterview?.interview_type === "technical" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {selectedInterview?.interview_type === "hr"
                    ? "Select to move candidate to Technical Interview or Reject"
                    : "Select to move candidate to Final Interview or Reject"}
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleFinalDecision("selected")}
                    className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {selectedInterview?.interview_type === "hr"
                      ? "Select for Technical"
                      : "Select for Final"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleFinalDecision("rejected")}
                    className="flex-1 gap-2"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Complete the feedback form below to submit your assessment.
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="dialog-technicalSkills" className="text-xs">
                      Technical Skills
                    </Label>
                    <Textarea
                      id="dialog-technicalSkills"
                      value={feedbackData.technicalSkills}
                      onChange={(e) =>
                        setFeedbackData({
                          ...feedbackData,
                          technicalSkills: e.target.value,
                        })
                      }
                      placeholder="Evaluate technical competency..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dialog-communication" className="text-xs">
                      Communication
                    </Label>
                    <Textarea
                      id="dialog-communication"
                      value={feedbackData.communication}
                      onChange={(e) =>
                        setFeedbackData({
                          ...feedbackData,
                          communication: e.target.value,
                        })
                      }
                      placeholder="Assess communication skills..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dialog-overallRemarks" className="text-xs">
                      Overall Remarks
                    </Label>
                    <Textarea
                      id="dialog-overallRemarks"
                      value={feedbackData.overallRemarks}
                      onChange={(e) =>
                        setFeedbackData({
                          ...feedbackData,
                          overallRemarks: e.target.value,
                        })
                      }
                      placeholder="Overall assessment..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dialog-recommendation" className="text-xs">
                      Recommendation
                    </Label>
                    <Select
                      value={feedbackData.recommendation}
                      onValueChange={(value) =>
                        setFeedbackData({
                          ...feedbackData,
                          recommendation: value,
                        })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strongly_recommend">
                          ⭐ Strongly Recommend
                        </SelectItem>
                        <SelectItem value="recommend">✅ Recommend</SelectItem>
                        <SelectItem value="maybe">🤔 Maybe</SelectItem>
                        <SelectItem value="not_recommend">
                          ❌ Not Recommend
                        </SelectItem>
                        <SelectItem value="reject">🚫 Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSubmitFeedback} className="w-full">
                  Submit Feedback
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Next Interview Dialog */}
      <Dialog
        open={scheduleNextInterviewOpen}
        onOpenChange={setScheduleNextInterviewOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Schedule{" "}
              {nextInterviewType === "technical" ? "Technical" : "Final"}{" "}
              Interview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedInterview?.candidate_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {selectedInterview?.position}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextInterviewDate">Interview Date *</Label>
              <Input
                id="nextInterviewDate"
                type="date"
                value={nextInterviewData.interviewDate}
                onChange={(e) =>
                  setNextInterviewData({
                    ...nextInterviewData,
                    interviewDate: e.target.value,
                  })
                }
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextInterviewTime">Interview Time *</Label>
              <Input
                id="nextInterviewTime"
                type="time"
                value={nextInterviewData.interviewTime}
                onChange={(e) =>
                  setNextInterviewData({
                    ...nextInterviewData,
                    interviewTime: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextInterviewerName">Interviewer Name *</Label>
              <Input
                id="nextInterviewerName"
                type="text"
                value={nextInterviewData.interviewerName}
                onChange={(e) =>
                  setNextInterviewData({
                    ...nextInterviewData,
                    interviewerName: e.target.value,
                  })
                }
                placeholder="Enter interviewer name"
              />
            </div>

            <Button
              onClick={handleScheduleNextInterview}
              className="w-full"
              disabled={
                !nextInterviewData.interviewDate ||
                !nextInterviewData.interviewTime ||
                !nextInterviewData.interviewerName
              }
            >
              Schedule Interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Form Dialog */}
      <Dialog open={generateFormDialogOpen} onOpenChange={handleGenerateFormDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Application Form Generated</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Candidate Info */}
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="font-medium">{generatedFormData?.candidateName}</p>
              <p className="text-sm text-muted-foreground">
                {generatedFormData?.candidatePosition}
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ✓ Form link has been generated and is ready to share with the candidate.
              </p>
            </div>

            {/* Form Link Display */}
            <div className="space-y-2">
              <Label htmlFor="formLink" className="text-sm font-semibold">Form Link</Label>
              <div className="flex gap-2">
                <Input
                  id="formLink"
                  type="text"
                  value={generatedFormData?.formUrl || ""}
                  readOnly
                  className="text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyFormLink}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={openFormLink}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800 space-y-2">
              <p className="font-medium">Next Steps:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Share this link with the candidate</li>
                <li>The candidate can fill and submit the form</li>
                <li>Once submitted, you can proceed to Technical Interview</li>
              </ul>
            </div>

            <Button
              onClick={() => setGenerateFormDialogOpen(false)}
              className="w-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
