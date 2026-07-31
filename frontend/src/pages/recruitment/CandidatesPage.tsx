import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Upload,
  Eye,
  FileCheck,
  CheckCircle,
  RefreshCw,
  UserCheck,
  X,
  Copy,
  ExternalLink,
  Trash2,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { recruitmentApi } from "@/lib/api";

export default function CandidatesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [formLinkDialogOpen, setFormLinkDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [generatedFormData, setGeneratedFormData] = useState<any>(null);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(() => {
    // Check if we're coming from back navigation
    if (location.state?.from === 'candidates' && location.state?.activeTab) {
      return location.state.activeTab;
    }

    // Otherwise, try to get from localStorage (persists across refreshes)
    const savedTab = localStorage.getItem('candidatesActiveTab');
    return savedTab || 'all';
  });
  const [uploadData, setUploadData] = useState({
    requisitionId: "",
    source: "cv_upload",
  });
  const [screeningData, setScreeningData] = useState({
    screeningResult: "passed" as "passed" | "failed",
    screeningNotes: "",
  });
  const [interviewData, setInterviewData] = useState({
    interviewType: "hr" as "technical" | "hr" | "final",
    interviewDate: "",
    interviewTime: "",
    interviewerName: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<any>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set(),
  );
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchCandidates();
    fetchRequisitions();
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('candidatesActiveTab', activeTab);
  }, [activeTab]);

  const fetchRequisitions = async () => {
    try {
      const data = await recruitmentApi.getRequisitions({ status: "approved" });
      setRequisitions(data);
    } catch (error) {
      console.error("Error fetching requisitions:", error);
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getCandidates({ search: searchQuery });
      setCandidates(data);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchCandidates();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      cv_received: { label: "CV Received", variant: "secondary" },
      screened_passed: { label: "Screening Passed", variant: "default" },
      screened_failed: { label: "Screening Failed", variant: "destructive" },
      shortlisted: { label: "Shortlisted", variant: "default" },
      interview_scheduled: { label: "Interview Scheduled", variant: "default" },
      interviewed: { label: "Interviewed", variant: "default" },
      final_round: { label: "Final Round", variant: "default" },
      form_generated: { label: "Form Generated", variant: "default" },
      selected: { label: "Selected", variant: "default" },
      rejected: { label: "Rejected", variant: "destructive" },
    };

    const config = statusConfig[status] || {
      label: status,
      variant: "secondary",
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleUploadCV = async () => {
    if (!uploadData.requisitionId) {
      toast.error("Please select a requisition");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a CV file to upload");
      return;
    }

    try {
      console.log("=== Uploading CV ===");
      console.log("Requisition ID:", uploadData.requisitionId);
      console.log(
        "File:",
        selectedFile.name,
        selectedFile.type,
        selectedFile.size,
      );

      const formData = new FormData();
      formData.append("cv", selectedFile);
      formData.append("requisitionId", uploadData.requisitionId);
      formData.append("source", uploadData.source);

      console.log("Calling recruitmentApi.uploadCV...");

      const result = await recruitmentApi.uploadCV(formData);

      toast.success("CV uploaded and parsed successfully!");
      console.log("Upload result:", result);
      console.log("Parsed data:", result.parsedData);

      setUploadDialogOpen(false);
      setUploadData({
        requisitionId: "",
        source: "cv_upload",
      });
      setSelectedFile(null);
      fetchCandidates();
    } catch (error: any) {
      console.error("=== Upload Error ===");
      console.error("Error:", error);
      toast.error(error.message || "Failed to upload CV");
    }
  };

  const handleShortlist = async (candidateId: string) => {
    try {
      await recruitmentApi.shortlistCandidate(candidateId);
      toast.success("Candidate shortlisted!");
      fetchCandidates();
    } catch (error: any) {
      console.error("Error shortlisting candidate:", error);
      toast.error(error.message || "Failed to shortlist candidate");
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedCandidate) return;

    try {
      console.log("Selected candidate:", selectedCandidate);
      console.log("Requisition ID:", selectedCandidate.requisition_id);

      // Ensure requisition_id is a valid UUID string
      const requisitionId =
        selectedCandidate.requisition_id?.toString() ||
        selectedCandidate.requisition_id;

      if (!requisitionId) {
        toast.error("Requisition ID is missing for this candidate");
        return;
      }

      await recruitmentApi.scheduleInterview({
        candidateId: selectedCandidate.id,
        requisitionId: requisitionId,
        interviewType: interviewData.interviewType,
        interviewDate: interviewData.interviewDate,
        interviewTime: interviewData.interviewTime,
        interviewerName: interviewData.interviewerName,
      });

      toast.success("Interview scheduled successfully!");
      setInterviewDialogOpen(false);
      setInterviewData({
        interviewType: "technical",
        interviewDate: "",
        interviewTime: "",
        interviewerName: "",
      });
      setSelectedCandidate(null);
      navigate("/recruitment/interviews", { state: { activeTab: "scheduled" } });
    } catch (error: any) {
      console.error("Error scheduling interview:", error);
      toast.error(error.message || "Failed to schedule interview");
    }
  };

  // New Workflow Functions
  const handleScreening = async () => {
    if (!selectedCandidate) return;

    try {
      await recruitmentApi.screenCandidate(selectedCandidate.id, screeningData);
      toast.success(`Candidate screening ${screeningData.screeningResult}!`);
      setScreeningDialogOpen(false);
      setScreeningData({ screeningResult: "passed", screeningNotes: "" });
      setSelectedCandidate(null);
      fetchCandidates();
    } catch (error: any) {
      console.error("Error screening candidate:", error);
      toast.error(error.message || "Failed to screen candidate");
    }
  };

  const handleGenerateForm = async (candidateId: string) => {
    try {
      console.log("=== Frontend: Generating form for candidate:", candidateId);

      // Use the API client instead of direct fetch
      const result = await recruitmentApi.generateApplicationForm(candidateId);
      console.log("Success result:", result);

      // Find the candidate for display
      const candidate = candidates.find((c) => c.id === candidateId);

      // Set the form data and open modal
      setGeneratedFormData({
        ...result,
        candidateName: candidate?.full_name || "Unknown",
        candidatePosition: candidate?.applied_position || "Unknown",
      });
      setFormLinkDialogOpen(true);

      fetchCandidates();
    } catch (error: any) {
      console.error("=== Frontend Error ===");
      console.error("Error:", error);
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

  const handleDeleteCandidate = async () => {
    if (!candidateToDelete) return;

    try {
      await recruitmentApi.deleteCandidate(candidateToDelete.id);
      toast.success("Candidate deleted successfully");
      setDeleteDialogOpen(false);
      setCandidateToDelete(null);
      fetchCandidates();
    } catch (error: any) {
      console.error("Error deleting candidate:", error);
      toast.error(error.message || "Failed to delete candidate");
    }
  };

  // Multi-select handlers
  const toggleSelectCandidate = (candidateId: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === filteredCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(filteredCandidates.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const candidateIds = Array.from(selectedCandidates);

      // Delete all selected candidates
      await Promise.all(
        candidateIds.map((id) => recruitmentApi.deleteCandidate(id)),
      );

      toast.success(`${candidateIds.length} candidate(s) deleted successfully`);
      setBulkDeleteDialogOpen(false);
      setSelectedCandidates(new Set());
      fetchCandidates();
    } catch (error: any) {
      console.error("Error deleting candidates:", error);
      toast.error(error.message || "Failed to delete candidates");
    }
  };

  const getCandidatesToDelete = () => {
    return filteredCandidates.filter((c) => selectedCandidates.has(c.id));
  };

  // Filter candidates by status for tabs
  const filteredCandidates = useMemo(() => {
    const searched = candidates.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.applied_position?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    if (activeTab === "all") return searched;
    if (activeTab === "cv-received")
      return searched.filter((c) => c.status === "cv_received");
    if (activeTab === "screening-passed")
      return searched.filter((c) => c.status === "screened_passed");
    if (activeTab === "shortlist")
      return searched.filter((c) => c.status === "shortlisted");
    if (activeTab === "screening-failed")
      return searched.filter((c) => c.status === "screened_failed");

    return searched;
  }, [candidates, searchQuery, activeTab]);

  // Calculate counts
  const tabCounts = useMemo(
    () => ({
      all: candidates.length,
      "cv-received": candidates.filter((c) => c.status === "cv_received")
        .length,
      "screening-passed": candidates.filter(
        (c) => c.status === "screened_passed",
      ).length,
      shortlist: candidates.filter((c) => c.status === "shortlisted").length,
      "screening-failed": candidates.filter(
        (c) => c.status === "screened_failed",
      ).length,
    }),
    [candidates],
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Candidates</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchCandidates}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload CV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Candidate CV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    📄 Upload a CV and we'll automatically extract candidate
                    information like name, email, phone, skills, experience, and
                    education!
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requisition">Select Requisition *</Label>
                  <Select
                    value={uploadData.requisitionId}
                    onValueChange={(value) =>
                      setUploadData({ ...uploadData, requisitionId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select requisition" />
                    </SelectTrigger>
                    <SelectContent>
                      {requisitions.map((req) => (
                        <SelectItem key={req.id} value={req.id}>
                          {req.requisition_id} - {req.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cv-file">CV File *</Label>
                  <Input
                    id="cv-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                  />
                  {selectedFile && (
                    <p className="text-sm text-green-600">
                      ✓ Selected: {selectedFile.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported formats: PDF, DOC, DOCX, TXT (Max 10MB)
                  </p>
                </div>

                <Button
                  onClick={handleUploadCV}
                  className="w-full"
                  disabled={!uploadData.requisitionId || !selectedFile}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Parse CV
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedCandidates.size > 0 && (
        <Card className="mb-6 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {selectedCandidates.size} candidate
                {selectedCandidates.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCandidates(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          localStorage.setItem('candidatesActiveTab', tab);
        }}
        className="w-full"
      >
        <div className="flex justify-between items-center mb-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All
              <Badge variant="secondary" className="ml-1">
                {tabCounts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="cv-received"
              className="flex items-center gap-2"
            >
              CV Received
              <Badge variant="secondary" className="ml-1">
                {tabCounts["cv-received"]}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="screening-passed"
              className="flex items-center gap-2"
            >
              Screening Passed
              <Badge variant="secondary" className="ml-1">
                {tabCounts["screening-passed"]}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="shortlist" className="flex items-center gap-2">
              Shortlist
              <Badge variant="secondary" className="ml-1">
                {tabCounts.shortlist}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="screening-failed"
              className="flex items-center gap-2"
            >
              Screening Failed
              <Badge variant="destructive" className="ml-1">
                {tabCounts["screening-failed"]}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Select All Checkbox */}
          {filteredCandidates.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="ml-4"
              title={
                selectedCandidates.size === filteredCandidates.length
                  ? "Deselect all"
                  : "Select all"
              }
            >
              <input
                type="checkbox"
                checked={
                  selectedCandidates.size === filteredCandidates.length &&
                  filteredCandidates.length > 0
                }
                onChange={() => { }}
                className="mr-2 cursor-pointer"
              />
              {selectedCandidates.size === filteredCandidates.length &&
                filteredCandidates.length > 0
                ? "Deselect All"
                : "Select All"}
            </Button>
          )}
        </div>

        {/* Tab Contents */}
        {(
          [
            "all",
            "cv-received",
            "screening-passed",
            "shortlist",
            "screening-failed",
          ] as const
        ).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading candidates...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery
                  ? "No candidates match your search"
                  : "No candidates in this category"}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCandidates.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className={`hover:shadow-md transition-shadow ${selectedCandidates.has(candidate.id) ? "border-blue-500 border-2" : ""}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        {/* Checkbox */}
                        <div className="flex items-start mr-4 mt-1">
                          <input
                            type="checkbox"
                            checked={selectedCandidates.has(candidate.id)}
                            onChange={() => toggleSelectCandidate(candidate.id)}
                            className="cursor-pointer w-4 h-4"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold">
                              {candidate.full_name}
                            </h3>
                            {getStatusBadge(candidate.status)}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-muted-foreground mt-4">
                            <div className="min-w-0">
                              <span className="font-medium">Position:</span>
                              <p className="text-foreground break-words">
                                {candidate.applied_position}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <span className="font-medium">Email:</span>
                              <p className="text-foreground break-all">
                                {candidate.email}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <span className="font-medium">Experience:</span>
                              <p className="text-foreground break-words">
                                {candidate.total_experience || "N/A"}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <span className="font-medium">Applied:</span>
                              <p className="text-foreground">
                                {new Date(
                                  candidate.created_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {/* CV Received Tab - Screen CV Button */}
                          {tab === "cv-received" &&
                            candidate.status === "cv_received" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setScreeningDialogOpen(true);
                                }}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Screen CV
                              </Button>
                            )}

                          {/* Screening Passed Tab - Shortlist Button */}
                          {tab === "screening-passed" &&
                            candidate.status === "screened_passed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShortlist(candidate.id)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Shortlist
                              </Button>
                            )}

                          {/* Shortlist Tab - Schedule Interview Button */}
                          {tab === "shortlist" &&
                            (candidate.status === "shortlisted" ||
                              candidate.status === "interview_scheduled") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setInterviewDialogOpen(true);
                                }}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                Schedule Interview
                              </Button>
                            )}

                          {/* Screening Failed Tab - Show Status */}
                          {tab === "screening-failed" &&
                            candidate.status === "screened_failed" && (
                              <Button variant="outline" size="sm" disabled>
                                <X className="mr-2 h-4 w-4" />
                                Screening Failed
                              </Button>
                            )}

                          {/* Always show View button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/recruitment/candidates/${candidate.id}`,
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setCandidateToDelete(candidate);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Screening Dialog */}
      <Dialog open={screeningDialogOpen} onOpenChange={setScreeningDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Screen Candidate CV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedCandidate?.full_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {selectedCandidate?.applied_position}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="screeningResult">Screening Result *</Label>
              <Select
                value={screeningData.screeningResult}
                onValueChange={(value: "passed" | "failed") =>
                  setScreeningData({ ...screeningData, screeningResult: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">
                    ✅ Passed - Proceed Application
                  </SelectItem>
                  <SelectItem value="failed">
                    ❌ Failed - Reject Application
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="screeningNotes">Screening Notes</Label>
              <Textarea
                id="screeningNotes"
                value={screeningData.screeningNotes}
                onChange={(e) =>
                  setScreeningData({
                    ...screeningData,
                    screeningNotes: e.target.value,
                  })
                }
                placeholder="Add notes about the screening decision..."
                rows={3}
              />
            </div>

            <Button onClick={handleScreening} className="w-full">
              Complete Screening
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interview Scheduling Dialog */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedCandidate?.full_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {selectedCandidate?.applied_position}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewType">Interview Type *</Label>
              <Select
                value={interviewData.interviewType}
                onValueChange={(value: "hr" | "technical" | "final") =>
                  setInterviewData({ ...interviewData, interviewType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr">HR Interview</SelectItem>
                  {/* <SelectItem value="technical">Technical Interview</SelectItem>
                  <SelectItem value="final">Final Interview</SelectItem> */}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewDate">Interview Date *</Label>
              <Input
                id="interviewDate"
                type="date"
                value={interviewData.interviewDate}
                onChange={(e) =>
                  setInterviewData({
                    ...interviewData,
                    interviewDate: e.target.value,
                  })
                }
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewTime">Interview Time *</Label>
              <Input
                id="interviewTime"
                type="time"
                value={interviewData.interviewTime}
                onChange={(e) =>
                  setInterviewData({
                    ...interviewData,
                    interviewTime: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewerName">Interviewer Name *</Label>
              <Input
                id="interviewerName"
                value={interviewData.interviewerName}
                onChange={(e) =>
                  setInterviewData({
                    ...interviewData,
                    interviewerName: e.target.value,
                  })
                }
                placeholder="Enter interviewer name"
              />
            </div>

            <Button
              onClick={handleScheduleInterview}
              className="w-full"
              disabled={
                !interviewData.interviewDate ||
                !interviewData.interviewTime ||
                !interviewData.interviewerName
              }
            >
              Schedule Interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Link Dialog */}
      <Dialog open={formLinkDialogOpen} onOpenChange={setFormLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Form Generated</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800">
                  Form Successfully Generated!
                </span>
              </div>
              <p className="text-sm text-green-700">
                Application form has been created for{" "}
                <strong>{generatedFormData?.candidateName}</strong>
                applying for{" "}
                <strong>{generatedFormData?.candidatePosition}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <Label>Form Link</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedFormData?.formUrl || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" onClick={copyFormLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={openFormLink}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Expires:</strong>{" "}
                {generatedFormData?.expiresAt
                  ? new Date(generatedFormData.expiresAt).toLocaleDateString()
                  : "N/A"}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Share this link with the candidate to complete their application
                form.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={copyFormLink} className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={openFormLink}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Form
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800">
                  Confirm Deletion
                </span>
              </div>
              <p className="text-sm text-red-700">
                Are you sure you want to delete{" "}
                <strong>{candidateToDelete?.full_name}</strong>?
              </p>
              <p className="text-xs text-red-600 mt-2">
                This action cannot be undone. All candidate data will be
                permanently removed.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setCandidateToDelete(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteCandidate}
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Yes Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Multiple Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800">
                  Confirm Bulk Deletion
                </span>
              </div>
              <p className="text-sm text-red-700">
                Are you sure you want to delete{" "}
                <strong>
                  {selectedCandidates.size} candidate
                  {selectedCandidates.size !== 1 ? "s" : ""}
                </strong>
                ?
              </p>
              <p className="text-xs text-red-600 mt-2">
                This action cannot be undone. All selected candidate data will
                be permanently removed.
              </p>
            </div>

            {/* List of candidates to be deleted */}
            <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-50 rounded p-3">
              {getCandidatesToDelete().map((candidate) => (
                <div
                  key={candidate.id}
                  className="text-sm flex justify-between"
                >
                  <span className="font-medium">{candidate.full_name}</span>
                  <span className="text-muted-foreground">
                    {candidate.applied_position}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkDeleteDialogOpen(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
