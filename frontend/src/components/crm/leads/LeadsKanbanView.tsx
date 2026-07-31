import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Plus, Building2, GripVertical, Phone, Mail, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUpdateLead, useDeleteLead, useConvertLeadToDeal } from "@/hooks/useCrmMutations";
import { useUpdateLeadStage } from "@/hooks/useCrmData";
import { usePipelineStages, useCreatePipelineStage, useDeletePipelineStage, useUpdatePipelineStage } from "@/hooks/usePipelineStages";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { cn } from "@/lib/utils";
import { DeleteConfirmationDialog } from "@/components/crm/DeleteConfirmationDialog";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  source: string;
  value: number;
  assignee?: {
    name?: string;
    avatar?: string;
    initials?: string;
  };
  createdAt: string;
}

interface Column {
  id: string;
  key: string;
  label: string;
  color: string;
  isCustom?: boolean;
  is_active?: boolean;
}

interface LeadsKanbanViewProps {
  leads: Lead[];
  onCreateLead?: () => void;
  selectedStage?: string | null;
}

const colorOptions = [
  "bg-chart-1", "bg-warning", "bg-success", "bg-purple-500", 
  "bg-orange-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500",
  "bg-teal-500", "bg-red-500", "bg-yellow-500", "bg-green-500"
];

export function LeadsKanbanView({ leads, onCreateLead, selectedStage }: LeadsKanbanViewProps) {
  const navigate = useNavigate();
  const updateLead = useUpdateLead();
  const updateLeadStage = useUpdateLeadStage();
  const deleteLead = useDeleteLead();
  const convertLead = useConvertLeadToDeal();
  const { data: pipelineStages = [] } = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const updateStage = useUpdatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [isEditStageOpen, setIsEditStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<{id: string, label: string, color: string} | null>(null);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

  const columns: Column[] = pipelineStages.map(s => ({ 
    id: s.id, 
    key: s.stage_key,
    label: s.stage_label, 
    color: s.color || "bg-muted-foreground", 
    isCustom: true,
    is_active: s.is_active 
  })).filter(c => c.is_active !== false);

  const getInitials = (lead: Lead) => {
    const source =
      lead.assignee?.initials ||
      lead.assignee?.name ||
      lead.name ||
      lead.email ||
      lead.company ||
      "Lead";

    return (
      source
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "LD"
    );
  };

  const getStageLeads = (stageKey: string) => 
    leads.filter(l => (l.stage || 'new') === stageKey);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, newStageKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && (lead.stage || 'new') !== newStageKey) {
      updateLeadStage.mutate({ id: leadId, stage: newStageKey });
    }
  };

  const handleAddStage = () => {
    if (!newStageTitle.trim()) return;
    createStage.mutate({ stageName: newStageTitle, color: selectedColor });
    setNewStageTitle("");
    setSelectedColor(colorOptions[0]);
    setIsAddStageOpen(false);
  };

  const handleUpdateStage = () => {
    if (!editingStage || !editStageName.trim()) return;
    updateStage.mutate({ 
      id: editingStage.id, 
      stageName: editStageName,
      color: editStageColor 
    });
    setIsEditStageOpen(false);
    setEditingStage(null);
  };

  const handleHideStage = (id: string) => {
    updateStage.mutate({ id, is_active: false });
  };

  const handleDeleteStage = (id: string) => {
    setStageToDelete(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lead Pipeline</h2>
        <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Stage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="stage-title">Stage Title</Label>
                <Input
                  id="stage-title"
                  value={newStageTitle}
                  onChange={(e) => setNewStageTitle(e.target.value)}
                  placeholder="Enter stage name"
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2",
                        color,
                        selectedColor === color ? "border-foreground" : "border-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddStageOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStage}>
                  Add Stage
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        if (selectedStage && selectedStage !== "all" && selectedStage !== column.key) return null;
        const stageLeads = getStageLeads(column.key);
        const totalValue = stageLeads.reduce((sum, lead) => sum + lead.value, 0);

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 rounded-xl border transition-colors shadow-sm",
              "bg-muted/40 dark:bg-muted/20", // Improved contrast for dark mode
              dragOverColumn === column.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border/50"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.key)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold">{column.label}</h3>
                  <Badge variant="secondary" className="rounded-full">
                    {stageLeads.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onCreateLead}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingStage({ id: column.id, label: column.label, color: column.color });
                        setEditStageName(column.label);
                        setEditStageColor(column.color);
                        setIsEditStageOpen(true);
                      }}>
                        Edit Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleHideStage(column.id)}>
                        Hide Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteStage(column.id)}
                      >
                        Delete Stage
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ${totalValue.toLocaleString()} total value
              </p>
            </div>

            {/* Column Content */}
            <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
              {stageLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className={cn(
                    "border border-border/60 bg-card rounded-lg p-3 shadow-sm",
                    "hover:shadow-md hover:border-primary/30 transition-all duration-200",
                    "cursor-grab active:cursor-grabbing group"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      <div className="flex flex-col gap-1">
                        <p
                          className="font-semibold text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                          onClick={() => navigate(`/crm/leads/${lead.id}`)}
                          title="Lead Name"
                        >
                          {lead.name}
                        </p>
                        {lead.company && (
                          <div className="text-xs font-medium text-muted-foreground" title="Customer Name">
                            {lead.company}
                          </div>
                        )}
                        {lead.email && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/collaboration/mail", { state: { composeTo: lead.email } });
                            }}
                            className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors truncate block cursor-pointer"
                          >
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => convertLead.mutate(lead.id)}>
                          Convert to Deal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setLeadToDelete(lead.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 mt-2">
                    {lead.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <ClickToCall 
                          phoneNumber={lead.phone} 
                          entityType="lead" 
                          entityId={lead.id} 
                          className="text-muted-foreground hover:text-primary hover:underline transition-colors truncate block" 
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs border-border">
                        {lead.source || "—"}
                      </Badge>
                      <span className="text-sm font-semibold text-success">
                        ${lead.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {stageLeads.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No leads in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
      {/* Edit Stage Dialog */}
      <Dialog open={isEditStageOpen} onOpenChange={setIsEditStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Stage Name</label>
              <Input
                placeholder="Enter stage name..."
                value={editStageName}
                onChange={(e) => setEditStageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  "bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5",
                  "bg-warning", "bg-success", "bg-primary", "bg-destructive", "bg-muted-foreground",
                  "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-blue-500", "bg-emerald-500"
                ].map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      color,
                      editStageColor === color ? "border-primary scale-110" : "border-transparent"
                    )}
                    onClick={() => setEditStageColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditStageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStage}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog 
        open={!!stageToDelete}
        onOpenChange={(open) => !open && setStageToDelete(null)}
        onConfirm={() => {
          if (stageToDelete) {
            deleteStage.mutate(stageToDelete, {
              onSuccess: () => setStageToDelete(null)
            });
          }
        }}
        isLoading={deleteStage.isPending}
        title="Delete Pipeline Stage?"
        description="Are you sure you want to delete this stage? Leads in this stage will need to be moved manually."
      />

      <DeleteConfirmationDialog 
        open={!!leadToDelete}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
        onConfirm={() => {
          if (leadToDelete) {
            deleteLead.mutate(leadToDelete, {
              onSuccess: () => setLeadToDelete(null)
            });
          }
        }}
        isLoading={deleteLead.isPending}
        title="Delete Lead?"
        description="Are you sure you want to delete this lead? This action cannot be undone."
      />
    </div>
  );
}

