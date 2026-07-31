import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Eye, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { recruitmentApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function RequisitionsListPage() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    position: '',
    department: '',
    numberOfPositions: 1,
    jobDescription: '',
    requirements: '',
    urgency: 'medium',
    requestType: 'single',
    grade: ''
  });

  // Delete dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; bulk?: boolean } | null>(null);

  useEffect(() => {
    fetchRequisitions();
    
    // Refresh when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRequisitions();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getRequisitions({ search: searchQuery });
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchRequisitions();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeleteSingle = (id: string) => {
    setDeleteTarget({ id });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteBulk = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget({ bulk: true });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.bulk) {
        await recruitmentApi.bulkDeleteRequisitions(selectedIds);
        toast.success('Selected requisitions deleted successfully');
        setSelectedIds([]);
      } else if (deleteTarget.id) {
        await recruitmentApi.deleteRequisition(deleteTarget.id);
        toast.success('Requisition deleted successfully');
        setSelectedIds(prev => prev.filter(selectedId => selectedId !== deleteTarget.id));
      }
      fetchRequisitions();
    } catch (error) {
      console.error('Error deleting requisitions:', error);
      toast.error('Failed to delete requisition(s)');
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleEditOpen = (req: any) => {
    setEditingRequisition(req);
    setEditFormData({
      position: req.position || '',
      department: req.department || '',
      numberOfPositions: req.number_of_positions || 1,
      jobDescription: req.job_description || '',
      requirements: req.requirements || '',
      urgency: req.urgency || 'medium',
      requestType: req.request_type || 'single',
      grade: req.grade || ''
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequisition) return;
    try {
      await recruitmentApi.updateRequisition(editingRequisition.id, editFormData);
      toast.success('Requisition updated successfully');
      setEditDialogOpen(false);
      fetchRequisitions();
    } catch (error) {
      console.error('Error updating requisition:', error);
      toast.error('Failed to update requisition');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(requisitions.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      pending_hr: { label: 'Pending HR Approval', variant: 'secondary' },
      approved: { label: 'Approved', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' },
      in_advertisement: { label: 'In Advertisement', variant: 'default' },
      shortlisting: { label: 'Shortlisting', variant: 'default' },
      interviewing: { label: 'Interviewing', variant: 'default' },
      completed: { label: 'Completed', variant: 'default' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary' };
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

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Requisitions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRequisitions} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/recruitment/requisitions/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Requisition
          </Button>
        </div>
      </div>

      {/* Search Bar & Selection Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by position, department, or requester..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {requisitions.length > 0 && ["super_admin", "admin", "manager"].includes(userRole?.role || "") && (
          <div className="flex items-center px-4 py-2 gap-4 bg-card rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="select-all" 
                checked={selectedIds.length === requisitions.length && requisitions.length > 0}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-muted-foreground">
                Select All
              </Label>
            </div>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDeleteBulk} className="h-8">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Requisitions List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading requisitions...</div>
      ) : requisitions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No requisitions found</div>
      ) : (
        <div className="space-y-4">
          {requisitions.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow relative">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Select Checkbox */}
                  {["super_admin", "admin", "manager"].includes(userRole?.role || "") && (
                    <div className="pt-1.5">
                      <Checkbox
                        checked={selectedIds.includes(req.id)}
                        onCheckedChange={(checked) => handleSelectOne(req.id, !!checked)}
                      />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-semibold">{req.position}</h3>
                          {getStatusBadge(req.status)}
                          {getUrgencyBadge(req.urgency)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mt-4">
                          <div>
                            <span className="font-medium">Department:</span>
                            <p className="text-foreground">{req.department}</p>
                          </div>
                          <div>
                            <span className="font-medium">Positions:</span>
                            <p className="text-foreground">{req.number_of_positions}</p>
                          </div>
                          <div>
                            <span className="font-medium">Requested By:</span>
                            <p className="text-foreground">{req.requested_by_name}</p>
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>
                            <p className="text-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/recruitment/requisitions/${req.id}`)}
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditOpen(req)}
                        >
                          <Edit className="mr-1.5 h-4 w-4" />
                          Edit
                        </Button>
                        {["super_admin", "admin", "manager"].includes(userRole?.role || "") && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteSingle(req.id)}
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-background text-foreground border-border">
          <DialogHeader>
            <DialogTitle>Edit Requisition</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-2">
              <Label htmlFor="edit-position">Position / Role</Label>
              <Input
                id="edit-position"
                value={editFormData.position}
                onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Select
                  value={editFormData.department}
                  onValueChange={(val) => setEditFormData({ ...editFormData, department: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-positions">Number of Positions</Label>
                <Input
                  id="edit-positions"
                  type="number"
                  min="1"
                  value={editFormData.numberOfPositions}
                  onChange={(e) => setEditFormData({ ...editFormData, numberOfPositions: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-requestType">Request Type</Label>
                <Select
                  value={editFormData.requestType}
                  onValueChange={(val) => setEditFormData({ ...editFormData, requestType: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Request Type" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="single">Single Position</SelectItem>
                    <SelectItem value="team">Team/Multiple Positions</SelectItem>
                    <SelectItem value="other">Other Requirement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-urgency">Urgency</Label>
                <Select
                  value={editFormData.urgency}
                  onValueChange={(val) => setEditFormData({ ...editFormData, urgency: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Urgency" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-grade">Grade / Level (Optional)</Label>
              <Select
                value={editFormData.grade}
                onValueChange={(val) => setEditFormData({ ...editFormData, grade: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Grade" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="GD1-3">Junior (GD 1-3)</SelectItem>
                  <SelectItem value="GD4-6">Mid-Level (GD 4-6)</SelectItem>
                  <SelectItem value="GD7-9">Senior (GD 7-9)</SelectItem>
                  <SelectItem value="GD10-12">Lead (GD 10-12)</SelectItem>
                  <SelectItem value="GD13+">Manager (GD 13+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-jd">Job Description</Label>
              <Textarea
                id="edit-jd"
                value={editFormData.jobDescription}
                onChange={(e) => setEditFormData({ ...editFormData, jobDescription: e.target.value })}
                required
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-requirements">Requirements</Label>
              <Textarea
                id="edit-requirements"
                value={editFormData.requirements}
                onChange={(e) => setEditFormData({ ...editFormData, requirements: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.bulk 
                ? `This action will permanently delete the ${selectedIds.length} selected requisitions and cannot be undone.` 
                : 'This action will permanently delete this requisition and cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
