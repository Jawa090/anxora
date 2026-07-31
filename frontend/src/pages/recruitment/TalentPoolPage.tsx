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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Search, 
  Users, 
  Star, 
  Filter, 
  UserPlus,
  UserMinus,
  Eye,
  RefreshCw,
  Database,
  TrendingUp,
  Award,
  Clock,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';

interface TalentPool {
  id: string;
  pool_name: string;
  description?: string;
  pool_type: string;
  target_skills?: string[];
  target_departments?: string[];
  target_experience_min?: number;
  target_experience_max?: number;
  target_education_level?: string;
  member_count: number;
  active_members: number;
  created_by_name: string;
  managed_by_name: string;
  created_at: string;
  is_active: boolean;
}

interface TalentPoolMember {
  id: string;
  candidate_id: string;
  full_name: string;
  email: string;
  phone: string;
  current_designation: string;
  total_experience: number;
  skills: string[];
  status: string;
  availability_status: string;
  pool_score?: number;
  total_score?: number;
  rank_position?: number;
  added_date: string;
  notes?: string;
}

interface TalentPoolAnalytics {
  total_pools: number;
  total_members: number;
  active_members: number;
  hired_members: number;
  available_members: number;
  avg_pool_score: number;
  skill_based_pools: number;
  department_based_pools: number;
  topSkills: Array<{ skill: string; candidate_count: number }>;
}

export default function TalentPoolPage() {
  const [activeTab, setActiveTab] = useState('pools');
  const [talentPools, setTalentPools] = useState<TalentPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<TalentPool | null>(null);
  const [poolMembers, setPoolMembers] = useState<TalentPoolMember[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<TalentPoolAnalytics | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
  const [viewPoolDialogOpen, setViewPoolDialogOpen] = useState(false);
  const [addMembersDialogOpen, setAddMembersDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  // Form states
  const [newPool, setNewPool] = useState({
    poolName: '',
    description: '',
    poolType: 'skill_based',
    targetSkills: [] as string[],
    targetDepartments: [] as string[],
    targetExperienceMin: 0,
    targetExperienceMax: 10,
    targetEducationLevel: ''
  });

  const [searchFilters, setSearchFilters] = useState({
    skills: '',
    experience: '',
    department: '',
    education: '',
    availability: '',
    minScore: ''
  });

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  const fetchTalentPools = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getAllTalentPools();
      setTalentPools(data);
    } catch (error) {
      console.error('Error fetching talent pools:', error);
      toast.error('Failed to load talent pools');
    } finally {
      setLoading(false);
    }
  };

  const fetchPoolDetails = async (poolId: string) => {
    try {
      const data = await recruitmentApi.getTalentPoolById(poolId);
      setSelectedPool(data);
      setPoolMembers(data.members || []);
    } catch (error) {
      console.error('Error fetching pool details:', error);
      toast.error('Failed to load pool details');
    }
  };

  const fetchCandidates = async () => {
    try {
      const data = await recruitmentApi.getCandidates();
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await recruitmentApi.getTalentPoolAnalytics();
      // Backend returns { overview: {...}, topSkills: [...] }
      // Flatten it for easier access
      setAnalytics({
        ...data.overview,
        topSkills: data.topSkills || []
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  useEffect(() => {
    fetchTalentPools();
    fetchCandidates();
    fetchAnalytics();
  }, []);

  const handleCreatePool = async () => {
    try {
      await recruitmentApi.createTalentPool(newPool);
      toast.success('Talent pool created successfully!');
      setCreatePoolDialogOpen(false);
      setNewPool({
        poolName: '',
        description: '',
        poolType: 'skill_based',
        targetSkills: [],
        targetDepartments: [],
        targetExperienceMin: 0,
        targetExperienceMax: 10,
        targetEducationLevel: ''
      });
      fetchTalentPools();
    } catch (error) {
      console.error('Error creating talent pool:', error);
      toast.error('Failed to create talent pool');
    }
  };

  const handleAddMembers = async () => {
    if (!selectedPool || selectedCandidates.length === 0) return;

    try {
      await recruitmentApi.addCandidatesToPool(selectedPool.id, {
        candidateIds: selectedCandidates,
        notes: 'Added via talent pool management',
        contactFrequency: 'monthly'
      });
      toast.success(`${selectedCandidates.length} candidates added to talent pool!`);
      setAddMembersDialogOpen(false);
      setSelectedCandidates([]);
      fetchPoolDetails(selectedPool.id);
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error('Failed to add candidates to pool');
    }
  };

  const handleSearchTalentPool = async () => {
    try {
      console.log('Search filters:', searchFilters);
      
      const params: any = {};
      if (searchFilters.skills) params.skills = searchFilters.skills;
      if (searchFilters.experience) params.experience = parseInt(searchFilters.experience);
      if (searchFilters.department) params.department = searchFilters.department;
      if (searchFilters.education) params.education = searchFilters.education;
      if (searchFilters.availability) params.availability = searchFilters.availability;
      if (searchFilters.minScore) params.minScore = parseInt(searchFilters.minScore);

      console.log('Search params:', params);
      
      const data = await recruitmentApi.searchTalentPool(params);
      console.log('Search results:', data);
      
      setSearchResults(data);
      
      if (data.length === 0) {
        toast.info('No candidates found matching your criteria');
      } else {
        toast.success(`Found ${data.length} candidates`);
      }
    } catch (error: any) {
      console.error('Error searching talent pool:', error);
      toast.error(error.message || 'Failed to search talent pool');
    }
  };

  const handleUpdateMemberStatus = async (memberId: string, status: string) => {
    if (!selectedPool) return;

    try {
      await recruitmentApi.updateMemberStatus(selectedPool.id, memberId, { status });
      toast.success('Member status updated successfully!');
      fetchPoolDetails(selectedPool.id);
    } catch (error) {
      console.error('Error updating member status:', error);
      toast.error('Failed to update member status');
    }
  };

  const getPoolTypeBadge = (type: string) => {
    const colors = {
      skill_based: 'bg-blue-100 text-blue-800',
      department_based: 'bg-green-100 text-green-800',
      level_based: 'bg-purple-100 text-purple-800',
      custom: 'bg-orange-100 text-orange-800'
    };
    return <Badge className={colors[type as keyof typeof colors] || colors.custom}>
      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      hired_elsewhere: 'bg-blue-100 text-blue-800',
      not_interested: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[status as keyof typeof colors] || colors.active}>
      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </Badge>;
  };

  const getAvailabilityBadge = (status: string) => {
    const colors = {
      available: 'bg-green-100 text-green-800',
      not_available: 'bg-red-100 text-red-800',
      considering_offers: 'bg-yellow-100 text-yellow-800'
    };
    return <Badge className={colors[status as keyof typeof colors] || colors.available}>
      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Talent Pool Management</h1>
          <p className="text-muted-foreground">Build and manage talent pools for future opportunities</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setSearchDialogOpen(true)}>
            <Search className="h-4 w-4 mr-2" />
            Search Talent
          </Button>
          <Button onClick={() => setCreatePoolDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Pool
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pools">Talent Pools</TabsTrigger>
          <TabsTrigger value="search">Search & Discover</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Talent Pools Tab */}
        <TabsContent value="pools" className="space-y-4">
          <div className="grid gap-4">
            {talentPools.map((pool) => (
              <Card key={pool.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold">{pool.pool_name}</h3>
                        {getPoolTypeBadge(pool.pool_type)}
                        {!pool.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      {pool.description && (
                        <p className="text-sm text-muted-foreground">{pool.description}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {pool.member_count} members
                        </span>
                        <span className="flex items-center">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {pool.active_members} active
                        </span>
                        <span>Managed by: {pool.managed_by_name}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          fetchPoolDetails(pool.id);
                          setViewPoolDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedPool(pool);
                          setAddMembersDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add Members
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Search & Discover Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Talent Pool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Skills (comma-separated)</Label>
                  <Input
                    value={searchFilters.skills}
                    onChange={(e) => setSearchFilters({ ...searchFilters, skills: e.target.value })}
                    placeholder="React, Node.js, Python"
                  />
                </div>
                <div>
                  <Label>Min Experience (years)</Label>
                  <Input
                    type="number"
                    value={searchFilters.experience}
                    onChange={(e) => setSearchFilters({ ...searchFilters, experience: e.target.value })}
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input
                    value={searchFilters.department}
                    onChange={(e) => setSearchFilters({ ...searchFilters, department: e.target.value })}
                    placeholder="Engineering"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Education</Label>
                  <Input
                    value={searchFilters.education}
                    onChange={(e) => setSearchFilters({ ...searchFilters, education: e.target.value })}
                    placeholder="Bachelor's"
                  />
                </div>
                <div>
                  <Label>Availability</Label>
                  <Select
                    value={searchFilters.availability || "any"}
                    onValueChange={(value) => setSearchFilters({ ...searchFilters, availability: value === "any" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="not_available">Not Available</SelectItem>
                      <SelectItem value="considering_offers">Considering Offers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Min Score</Label>
                  <Input
                    type="number"
                    value={searchFilters.minScore}
                    onChange={(e) => setSearchFilters({ ...searchFilters, minScore: e.target.value })}
                    placeholder="70"
                  />
                </div>
              </div>
              
              <Button onClick={handleSearchTalentPool}>
                <Search className="h-4 w-4 mr-2" />
                Search Talent Pool
              </Button>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {searchResults.map((candidate) => (
                    <div key={candidate.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-semibold">{candidate.full_name}</h4>
                            {candidate.availability_status && getAvailabilityBadge(candidate.availability_status)}
                            {candidate.total_score && (
                              <Badge variant="outline">
                                <Star className="h-3 w-3 mr-1" />
                                Score: {candidate.total_score.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                          <p className="text-sm text-muted-foreground">{candidate.current_designation}</p>
                          {candidate.skills && (
                            <div className="flex flex-wrap gap-1">
                              {candidate.skills.slice(0, 5).map((skill: string, index: number) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Database className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Pools</p>
                        <p className="text-2xl font-bold">{analytics.total_pools}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Members</p>
                        <p className="text-2xl font-bold">{analytics.total_members}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Available</p>
                        <p className="text-2xl font-bold">{analytics.available_members}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Award className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Score</p>
                        <p className="text-2xl font-bold">
                          {analytics.avg_pool_score ? analytics.avg_pool_score.toFixed(1) : '0'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Skills */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Skills in Talent Pools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.topSkills.map((skill, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="font-medium">{skill.skill}</span>
                        <Badge variant="outline">{skill.candidate_count} candidates</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Pool Dialog */}
      <Dialog open={createPoolDialogOpen} onOpenChange={setCreatePoolDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Talent Pool</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Pool Name</Label>
              <Input
                value={newPool.poolName}
                onChange={(e) => setNewPool({ ...newPool, poolName: e.target.value })}
                placeholder="e.g., Senior Frontend Developers"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={newPool.description}
                onChange={(e) => setNewPool({ ...newPool, description: e.target.value })}
                placeholder="Describe the purpose and criteria for this talent pool..."
              />
            </div>
            
            <div>
              <Label>Pool Type</Label>
              <Select
                value={newPool.poolType}
                onValueChange={(value) => setNewPool({ ...newPool, poolType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skill_based">Skill Based</SelectItem>
                  <SelectItem value="department_based">Department Based</SelectItem>
                  <SelectItem value="level_based">Level Based</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Experience (years)</Label>
                <Input
                  type="number"
                  value={newPool.targetExperienceMin}
                  onChange={(e) => setNewPool({ ...newPool, targetExperienceMin: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Max Experience (years)</Label>
                <Input
                  type="number"
                  value={newPool.targetExperienceMax}
                  onChange={(e) => setNewPool({ ...newPool, targetExperienceMax: parseInt(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCreatePoolDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePool}>
                Create Pool
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Pool Dialog */}
      <Dialog open={viewPoolDialogOpen} onOpenChange={setViewPoolDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPool?.pool_name} - Members ({poolMembers.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {poolMembers.map((member) => (
              <div key={member.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-semibold">{member.full_name}</h4>
                      {getStatusBadge(member.status)}
                      {member.availability_status && getAvailabilityBadge(member.availability_status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <p className="text-sm text-muted-foreground">{member.current_designation}</p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>{member.total_experience} years exp</span>
                      {member.total_score && <span>Score: {member.total_score.toFixed(1)}</span>}
                      <span>Added: {new Date(member.added_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Select
                      value={member.status}
                      onValueChange={(value) => handleUpdateMemberStatus(member.id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="hired_elsewhere">Hired Elsewhere</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={addMembersDialogOpen} onOpenChange={setAddMembersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Members to {selectedPool?.pool_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select candidates to add to this talent pool:
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center space-x-3 p-2 border rounded">
                  <Checkbox
                    checked={selectedCandidates.includes(candidate.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCandidates([...selectedCandidates, candidate.id]);
                      } else {
                        setSelectedCandidates(selectedCandidates.filter(id => id !== candidate.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{candidate.full_name}</p>
                    <p className="text-sm text-muted-foreground">{candidate.email}</p>
                    <p className="text-sm text-muted-foreground">{candidate.current_designation}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedCandidates.length} candidates selected
              </span>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setAddMembersDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMembers} disabled={selectedCandidates.length === 0}>
                  Add Members
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}