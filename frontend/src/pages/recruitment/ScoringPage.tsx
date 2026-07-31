import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Plus, 
  Search, 
  Star, 
  Trophy, 
  Target, 
  TrendingUp,
  BarChart3,
  Users,
  Award,
  RefreshCw,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';

interface ScoringCriteria {
  id: string;
  criteria_name: string;
  category: string;
  description?: string;
  max_score: number;
  weight_percentage: number;
  is_active: boolean;
}

interface CandidateScore {
  candidateId: string;
  criteriaId: string;
  criteriaName: string;
  category: string;
  rawScore: number;
  weightedScore: number;
  comments?: string;
  scorerName: string;
  scoredAt: string;
}

interface CandidateRanking {
  candidate_id: string;
  full_name: string;
  email: string;
  total_score: number;
  rank_position: number;
  percentile: number;
  technical_score: number;
  behavioral_score: number;
  experience_score: number;
  education_score: number;
}

export default function ScoringPage() {
  const [activeTab, setActiveTab] = useState('interviews');
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [rankings, setRankings] = useState<CandidateRanking[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [candidateScores, setCandidateScores] = useState<CandidateScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [viewScoresDialogOpen, setViewScoresDialogOpen] = useState(false);
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<string>('');
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [newCriteria, setNewCriteria] = useState({
    criteriaName: '',
    category: 'technical',
    description: '',
    maxScore: 10,
    weightPercentage: 25
  });

  const [scoreForm, setScoreForm] = useState<{[key: string]: { score: number; comments: string }}>({});

  const fetchCriteria = async () => {
    try {
      const data = await recruitmentApi.getAllCriteria();
      setCriteria(data);
    } catch (error) {
      console.error('Error fetching criteria:', error);
      toast.error('Failed to load scoring criteria');
    }
  };

  const fetchCompletedInterviews = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getAllInterviews({ status: 'completed' });
      setInterviews(data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequisitions = async () => {
    try {
      const data = await recruitmentApi.getRequisitions({ status: 'approved' });
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
    }
  };

  const fetchRankings = async (requisitionId: string) => {
    try {
      const data = await recruitmentApi.getRequisitionRankings(requisitionId);
      setRankings(data);
    } catch (error) {
      console.error('Error fetching rankings:', error);
      toast.error('Failed to load candidate rankings');
    }
  };

  const fetchCandidateScores = async (candidateId: string) => {
    try {
      const data = await recruitmentApi.getCandidateScores(candidateId);
      setCandidateScores(data);
    } catch (error) {
      console.error('Error fetching candidate scores:', error);
      toast.error('Failed to load candidate scores');
    }
  };

  useEffect(() => {
    fetchCriteria();
    fetchCompletedInterviews();
    fetchRequisitions();
  }, []);

  useEffect(() => {
    if (selectedRequisition) {
      fetchRankings(selectedRequisition);
    }
  }, [selectedRequisition]);

  const handleCreateCriteria = async () => {
    try {
      await recruitmentApi.createCriteria(newCriteria);
      toast.success('Scoring criteria created successfully!');
      setCriteriaDialogOpen(false);
      setNewCriteria({
        criteriaName: '',
        category: 'technical',
        description: '',
        maxScore: 100,
        weightPercentage: 100
      });
      fetchCriteria();
    } catch (error) {
      console.error('Error creating criteria:', error);
      toast.error('Failed to create scoring criteria');
    }
  };

  const handleSubmitScores = async () => {
    if (!selectedInterview) return;

    try {
      setSubmitting(true);
      const scores = Object.entries(scoreForm).map(([criteriaId, data]) => ({
        criteriaId,
        rawScore: data.score,
        comments: data.comments
      }));

      await recruitmentApi.submitBulkScores({
        candidateId: selectedInterview.candidate_id,
        interviewId: selectedInterview.id,
        scores
      });

      toast.success('Interview scores submitted successfully!');
      setScoreDialogOpen(false);
      setScoreForm({});
      setSelectedInterview(null);
      
      // Refresh data
      fetchCompletedInterviews();
      if (selectedRequisition) {
        fetchRankings(selectedRequisition);
      }
    } catch (error) {
      console.error('Error submitting scores:', error);
      toast.error('Failed to submit scores');
    } finally {
      setSubmitting(false);
    }
  };

  const hasBeenScored = (interview: any) => {
    // Check if interview has scores submitted
    return interview.has_scores || false;
  };

  const getInterviewTypeBadge = (type: string) => {
    const colors = {
      technical: 'bg-blue-100 text-blue-800',
      hr: 'bg-green-100 text-green-800',
      final: 'bg-purple-100 text-purple-800'
    };
    return <Badge className={colors[type as keyof typeof colors] || colors.technical}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      technical: 'bg-blue-100 text-blue-800',
      behavioral: 'bg-green-100 text-green-800',
      experience: 'bg-purple-100 text-purple-800',
      education: 'bg-orange-100 text-orange-800'
    };
    return <Badge className={colors[category as keyof typeof colors] || colors.technical}>
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </Badge>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-100 text-yellow-800"><Trophy className="h-3 w-3 mr-1" />1st</Badge>;
    if (rank === 2) return <Badge className="bg-gray-100 text-gray-800"><Award className="h-3 w-3 mr-1" />2nd</Badge>;
    if (rank === 3) return <Badge className="bg-orange-100 text-orange-800"><Award className="h-3 w-3 mr-1" />3rd</Badge>;
    return <Badge variant="outline">{rank}th</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Candidate Scoring & Ranking</h1>
          <p className="text-muted-foreground">Evaluate candidates and track performance rankings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="interviews">Score Interviews</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="criteria">Scoring Criteria</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Score Interviews Tab */}
        <TabsContent value="interviews" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Completed Interviews - Score Candidates</h2>
            <Button variant="outline" onClick={fetchCompletedInterviews}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading interviews...</div>
          ) : interviews.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed interviews found</p>
                <p className="text-sm mt-2">Interviews must be completed before scoring</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {interviews.map((interview) => (
                <Card key={interview.id} className={hasBeenScored(interview) ? 'border-green-200 bg-green-50/30' : ''}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-lg">{interview.candidate_name}</h3>
                          {getInterviewTypeBadge(interview.interview_type)}
                          {hasBeenScored(interview) && (
                            <Badge className="bg-green-100 text-green-800">
                              <Star className="h-3 w-3 mr-1" />
                              Scored
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Position:</span>
                            <p className="text-foreground">{interview.position}</p>
                          </div>
                          <div>
                            <span className="font-medium">Interview Date:</span>
                            <p className="text-foreground">{new Date(interview.interview_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="font-medium">Interviewer:</span>
                            <p className="text-foreground">{interview.interviewer_name}</p>
                          </div>
                        </div>

                        {interview.recommendation && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <span className="font-medium">Recommendation:</span> {interview.recommendation}
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2 ml-4">
                        {hasBeenScored(interview) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              fetchCandidateScores(interview.candidate_id);
                              setSelectedInterview(interview);
                              setViewScoresDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Scores
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedInterview(interview);
                            setScoreDialogOpen(true);
                          }}
                          disabled={hasBeenScored(interview)}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          {hasBeenScored(interview) ? 'Already Scored' : 'Score Interview'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rankings Tab */}
        <TabsContent value="rankings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Candidate Rankings</h2>
            <Select value={selectedRequisition} onValueChange={setSelectedRequisition}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select requisition" />
              </SelectTrigger>
              <SelectContent>
                {requisitions.map((req) => (
                  <SelectItem key={req.id} value={req.id}>
                    {req.position} - {req.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRequisition && (
            <div className="space-y-4">
              {rankings.map((ranking) => (
                <Card key={ranking.candidate_id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          {getRankBadge(ranking.rank_position)}
                          <h3 className="font-semibold">{ranking.full_name}</h3>
                          <Badge variant="outline">{ranking.percentile.toFixed(1)}th percentile</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{ranking.email}</p>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total Score:</span>
                            <span className="ml-2 font-semibold">{ranking.total_score.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Technical:</span>
                            <span className="ml-2 font-semibold">{ranking.technical_score.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Behavioral:</span>
                            <span className="ml-2 font-semibold">{ranking.behavioral_score.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Experience:</span>
                            <span className="ml-2 font-semibold">{ranking.experience_score.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Scoring Analytics</h2>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>Analytics dashboard coming soon...</p>
                <p className="text-sm">Track scoring trends, interviewer consistency, and performance metrics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Criteria Tab */}
        <TabsContent value="criteria" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Scoring Criteria</h2>
            <Button onClick={() => setCriteriaDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Criteria
            </Button>
          </div>

          {criteria.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scoring criteria defined</p>
                <p className="text-sm mt-2">Create criteria to evaluate candidates</p>
                <Button onClick={() => setCriteriaDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Criteria
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {criteria.map((criterion) => (
                <Card key={criterion.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold">{criterion.criteria_name}</h3>
                          {getCategoryBadge(criterion.category)}
                          {!criterion.is_active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        {criterion.description && (
                          <p className="text-sm text-muted-foreground">{criterion.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Max Score: {criterion.max_score}</span>
                          <span>Weight: {criterion.weight_percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Criteria Dialog */}
      <Dialog open={criteriaDialogOpen} onOpenChange={setCriteriaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Scoring Criteria</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Criteria Name</Label>
              <Input
                value={newCriteria.criteriaName}
                onChange={(e) => setNewCriteria({ ...newCriteria, criteriaName: e.target.value })}
                placeholder="e.g., Problem Solving Skills"
              />
            </div>
            
            <div>
              <Label>Category</Label>
              <Select
                value={newCriteria.category}
                onValueChange={(value) => setNewCriteria({ ...newCriteria, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={newCriteria.description}
                onChange={(e) => setNewCriteria({ ...newCriteria, description: e.target.value })}
                placeholder="Describe what this criteria evaluates..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Score</Label>
                <Input
                  type="number"
                  value={newCriteria.maxScore}
                  onChange={(e) => setNewCriteria({ ...newCriteria, maxScore: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Weight (%)</Label>
                <Input
                  type="number"
                  value={newCriteria.weightPercentage}
                  onChange={(e) => setNewCriteria({ ...newCriteria, weightPercentage: parseInt(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCriteriaDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCriteria}>
                Create Criteria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Score Interview Dialog */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Score Interview: {selectedInterview?.candidate_name}
            </DialogTitle>
            <div className="text-sm text-muted-foreground mt-2">
              <p>Position: {selectedInterview?.position}</p>
              <p>Interview Type: {selectedInterview?.interview_type}</p>
              <p>Date: {selectedInterview && new Date(selectedInterview.interview_date).toLocaleDateString()}</p>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {criteria.filter(c => c.is_active).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active scoring criteria found</p>
                <p className="text-sm mt-2">Please create scoring criteria first</p>
              </div>
            ) : (
              criteria.filter(c => c.is_active).map((criterion) => (
                <div key={criterion.id} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">{criterion.criteria_name}</h4>
                        {getCategoryBadge(criterion.category)}
                      </div>
                      {criterion.description && (
                        <p className="text-sm text-muted-foreground">{criterion.description}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Max: {criterion.max_score}</div>
                      <div>Weight: {criterion.weight_percentage}%</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Score: {scoreForm[criterion.id]?.score || 0} / {criterion.max_score}</Label>
                      <span className="text-sm font-medium text-primary">
                        {scoreForm[criterion.id]?.score ? 
                          `${((scoreForm[criterion.id].score / criterion.max_score) * 100).toFixed(0)}%` : 
                          '0%'}
                      </span>
                    </div>
                    <Slider
                      value={[scoreForm[criterion.id]?.score || 0]}
                      onValueChange={(value) => setScoreForm({
                        ...scoreForm,
                        [criterion.id]: { ...scoreForm[criterion.id], score: value[0] }
                      })}
                      max={criterion.max_score}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <Label>Evaluation Comments</Label>
                    <Textarea
                      value={scoreForm[criterion.id]?.comments || ''}
                      onChange={(e) => setScoreForm({
                        ...scoreForm,
                        [criterion.id]: { ...scoreForm[criterion.id], comments: e.target.value }
                      })}
                      placeholder="Add your detailed evaluation and observations..."
                      rows={3}
                    />
                  </div>
                </div>
              ))
            )}
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setScoreDialogOpen(false);
                  setScoreForm({});
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitScores}
                disabled={submitting || criteria.filter(c => c.is_active).length === 0}
              >
                {submitting ? 'Submitting...' : 'Submit Scores'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Scores Dialog */}
      <Dialog open={viewScoresDialogOpen} onOpenChange={setViewScoresDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Interview Scores: {selectedInterview?.candidate_name}
            </DialogTitle>
            <div className="text-sm text-muted-foreground mt-2">
              <p>Position: {selectedInterview?.position}</p>
              <p>Interview Type: {selectedInterview?.interview_type}</p>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {candidateScores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scores found for this interview</p>
              </div>
            ) : (
              candidateScores.map((score) => (
                <Card key={score.criteriaId}>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{score.criteriaName}</h4>
                          {getCategoryBadge(score.category)}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{score.rawScore}</div>
                          <div className="text-sm text-muted-foreground">Weighted: {score.weightedScore.toFixed(1)}</div>
                        </div>
                      </div>
                      {score.comments && (
                        <div className="mt-2 p-3 bg-muted rounded text-sm">
                          <p className="font-medium mb-1">Comments:</p>
                          <p>{score.comments}</p>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Scored by: {score.scorerName} on {new Date(score.scoredAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}