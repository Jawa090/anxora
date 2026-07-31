import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, MoreHorizontal, DollarSign, Calendar, GripVertical, 
  CreditCard, Building2, User, Mail, Phone, ArrowUpRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUpdateDeal, useDeleteDeal } from "@/hooks/useCrmMutations";
import { useDealPipelineStages, useUpdateDealPipelineStage, useDeleteDealPipelineStage } from "@/hooks/usePipelineStages";
import { DeleteConfirmationDialog } from "@/components/crm/DeleteConfirmationDialog";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DealData {
  id: string;
  title?: string;
  name?: string; // Fallback
  stage: string | null;
  status: string;
  value: number | null;
  probability: number | null;
  currency?: string | null;
  expected_close_date?: string | null;
  expectedCloseDate?: string | null; // Fallback
  invoice_amount?: number | null;
  invoiceAmount?: number | null; // Fallback
  companies?: { name: string } | null;
  company?: string; // Fallback
  contacts?: { 
    first_name: string; 
    last_name?: string | null;
    email?: string | null;
  } | null;
  contact_name?: string | null;
  contact?: string; // Fallback
  email?: string;
  phone?: string;
  deadline?: string | null;
  projectType?: string;
  responsiblePersonName?: string;
  responsiblePersonAvatar?: string;
  priority?: string;
}

const getPriorityStyles = (priority?: string) => {
  const p = (priority || "medium").toLowerCase();
  switch (p) {
    case "urgent":
      return "bg-destructive/15 text-destructive border-destructive/20 dark:bg-destructive/25";
    case "high":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:bg-orange-500/25";
    case "medium":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:bg-blue-500/25";
    case "low":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getProjectTypeLabel = (type?: string) => {
  if (!type) return "";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// Replaced by useDealPipelineStages

interface DealsKanbanViewProps {
  deals?: DealData[];
  selectedStage?: string | null;
  onStageSelect?: (stage: string | null) => void;
}

export function DealsKanbanView({ deals = [], selectedStage }: DealsKanbanViewProps) {
  const navigate = useNavigate();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const { data: pipelineStages = [] } = useDealPipelineStages();
  const updateStage = useUpdateDealPipelineStage();
  const deleteStage = useDeleteDealPipelineStage();
  
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isEditStageOpen, setIsEditStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<{id: string, label: string, color: string, probability: number} | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [editStageProb, setEditStageProb] = useState(0);
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);

  const stages = pipelineStages.map(s => ({
    id: s.id,
    key: s.stage_key,
    name: s.stage_label,
    color: s.color || "bg-gray-500",
    prob: s.probability || 0,
    is_active: s.is_active
  })).filter(s => s.is_active !== false);

  // Map lead stages or unknown stages to valid deal pipeline stage keys
  const STAGE_FALLBACK_MAP: Record<string, string> = {
    'new':              'drawings_received',
    'contacted':        'drawings_received',
    'qualified':        'awaiting_proposal',
    'proposal':         'proposal_sent',
    'negotiation':      'proposal_sent',
    'first_engagement': 'drawings_received',
    'qualification':    'drawings_received',
    'open':             'drawings_received',
  };

  const validStageKeys = stages.map(s => s.key);

  const resolveDealStage = (deal: DealData): string => {
    const s = deal.stage || '';
    if (validStageKeys.includes(s)) return s;
    return STAGE_FALLBACK_MAP[s.toLowerCase()] || validStageKeys[0] || 'drawings_received';
  };

  const getStageDeals = (stageKey: string) =>
    deals.filter((d) => resolveDealStage(d) === stageKey);

  const getStageTotalValue = (stageKey: string) =>
    getStageDeals(stageKey).reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("dealId", dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(stageId);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, newStageKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const dealId = e.dataTransfer.getData("dealId");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (deal && resolveDealStage(deal) !== newStageKey) {
      const stageInfo = stages.find((s) => s.key === newStageKey);
      updateDeal.mutate({
        id: dealId,
        stage: newStageKey,
        probability: stageInfo?.prob ?? deal.probability,
      });
    }
  };

  const handleUpdateStage = () => {
    if (!editingStage || !editStageName.trim()) return;
    updateStage.mutate({ 
      id: editingStage.id, 
      stageName: editStageName,
      color: editStageColor,
      probability: editStageProb
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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageDeals = getStageDeals(stage.key);
        if (selectedStage && selectedStage !== stage.key) return null;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-80 rounded-xl border transition-colors",
              "bg-muted/40 dark:bg-muted/20", // Improved contrast for dark mode
              dragOverColumn === stage.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border/50"
            )}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            {/* Stage Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                  <span className="font-semibold">{stage.name}</span>
                  <Badge variant="secondary" className="ml-1">
                    {stageDeals.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => navigate("/crm/deals/create")}
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
                        setEditingStage({ id: stage.id, label: stage.name, color: stage.color, probability: stage.prob });
                        setEditStageName(stage.name);
                        setEditStageColor(stage.color);
                        setEditStageProb(stage.prob);
                        setIsEditStageOpen(true);
                      }}>
                        Edit Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleHideStage(stage.id)}>
                        Hide Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteStage(stage.id)}
                      >
                        Delete Stage
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ${getStageTotalValue(stage.key).toLocaleString()} total
              </p>
            </div>

            {/* Deals */}
            <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {stageDeals.map((deal) => {
                const dealTitle = deal.name || deal.title || "Untitled Deal";
                const companyName = deal.company || deal.companies?.name || "";
                const contactName = deal.contact || deal.contact_name || 
                  (deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name || ''}`.trim() : '');
                const email = deal.email || deal.contacts?.email || "";
                const phone = deal.phone || "";
                const priority = deal.priority || "medium";
                const projectType = deal.projectType;
                
                const prob = deal.probability ?? 0;
                const closeDate = deal.deadline || deal.expectedCloseDate || deal.expected_close_date;
                const value = Number(deal.value) || 0;
                const invoiceAmount = Number(deal.invoiceAmount || deal.invoice_amount) || 0;

                return (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    className={cn(
                      "rounded-xl border border-border/50 bg-card p-4 cursor-grab active:cursor-grabbing",
                      "hover:shadow-md hover:border-primary/40 transition-all duration-200 group flex flex-col gap-3 relative",
                      "bg-gradient-to-b from-card to-card/95"
                    )}
                  >
                    {/* Header: Title and Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1 min-w-0">
                        <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                        <div className="min-w-0">
                          <h4
                            className="font-semibold text-sm leading-tight text-foreground hover:text-primary cursor-pointer transition-colors break-words flex items-center gap-1"
                            onClick={() => navigate(`/crm/deals/${deal.id}`)}
                          >
                            {dealTitle}
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                          </h4>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 hover:bg-muted/80 rounded-md">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/crm/deals/${deal.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/crm/deals/${deal.id}/edit`)}>
                            Edit Deal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDealToDelete(deal.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Metadata Badges (Project Type & Priority) */}
                    {(projectType || priority) && (
                      <div className="flex flex-wrap gap-1">
                        {projectType && (
                          <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium bg-primary/5 text-primary border-primary/10">
                            {getProjectTypeLabel(projectType)}
                          </Badge>
                        )}
                        {priority && (
                          <Badge variant="outline" className={cn("text-[10px] py-0 px-2 font-semibold capitalize", getPriorityStyles(priority))}>
                            {priority}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Company and Contact Details */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {companyName && (
                        <div className="flex items-center gap-1.5" title="Company">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate font-medium text-foreground/80">{companyName}</span>
                        </div>
                      )}
                      {contactName && (
                        <div className="flex items-center gap-1.5" title="Contact Person">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{contactName}</span>
                        </div>
                      )}
                      
                      {/* Email and Phone micro-actions */}
                      {(email || phone) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 pt-1 border-t border-border/30">
                          {email && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate("/collaboration/mail", { state: { composeTo: email } });
                              }}
                              className="flex items-center gap-1 hover:text-primary transition-colors hover:underline min-w-0"
                              title={`Send email to ${email}`}
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{email}</span>
                            </button>
                          )}
                          {phone && (
                            <div className="flex items-center gap-1 hover:text-primary transition-colors min-w-0" onClick={(e) => e.stopPropagation()}>
                              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                              <ClickToCall
                                phoneNumber={phone}
                                entityType="deal"
                                entityId={deal.id}
                                className="hover:underline text-[11px]"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cost / Value & Progress / Close Date */}
                    <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Value</span>
                        <div className="flex items-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          <DollarSign className="h-3.5 w-3.5 shrink-0" />
                          {value.toLocaleString()}
                        </div>
                      </div>

                      {closeDate && (
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Close Date</span>
                          <div className="flex items-center gap-1 text-xs font-semibold text-foreground/80">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {new Date(closeDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "2-digit"
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar (Probability) & Responsible Person Footer */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      {/* Probability Progress */}
                      <div className="flex-grow">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5 font-medium">
                          <span>Probability</span>
                          <span>{prob}%</span>
                        </div>
                        <Progress value={prob} className="h-1" />
                      </div>

                      {/* Owner / Responsible Person Avatar */}
                      {deal.responsiblePersonName ? (
                        <div className="shrink-0" title={`Responsible: ${deal.responsiblePersonName}`}>
                          <Avatar className="h-6 w-6 border border-border">
                            {deal.responsiblePersonAvatar && (
                              <AvatarImage src={deal.responsiblePersonAvatar} alt={deal.responsiblePersonName} />
                            )}
                            <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                              {deal.responsiblePersonName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ) : (
                        <div className="shrink-0" title="Unassigned">
                          <div className="h-6 w-6 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
                            <User className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment received indicator for Approved stage */}
                    {deal.stage === "proposal_approved" && (() => {
                      const totalValue = value;
                      const invoicePaid = invoiceAmount;
                      const paymentPct = totalValue > 0 ? Math.min(Math.round((invoicePaid / totalValue) * 100), 100) : 0;
                      const paymentLabel = paymentPct >= 100 ? "Full" : paymentPct > 0 ? "Partial" : "None";
                      return (
                        <div className="pt-2 border-t border-border/30">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                              <CreditCard className="h-3 w-3" />
                              {paymentLabel} Payment
                            </span>
                            <span className="font-semibold text-foreground/80">{paymentPct}%</span>
                          </div>
                          <Progress value={paymentPct} className="h-1 bg-muted" />
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {stageDeals.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No deals in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* Edit Stage Dialog */}
      <Dialog open={isEditStageOpen} onOpenChange={setIsEditStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deal Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stage Name</Label>
              <Input
                placeholder="Enter stage name..."
                value={editStageName}
                onChange={(e) => setEditStageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Probability (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editStageProb}
                onChange={(e) => setEditStageProb(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
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
        description="Are you sure you want to delete this stage? Deals in this stage will need to be moved manually."
      />

      <DeleteConfirmationDialog 
        open={!!dealToDelete}
        onOpenChange={(open) => !open && setDealToDelete(null)}
        onConfirm={() => {
          if (dealToDelete) {
            deleteDeal.mutate(dealToDelete, {
              onSuccess: () => setDealToDelete(null)
            });
          }
        }}
        isLoading={deleteDeal.isPending}
        title="Delete Deal?"
        description="Are you sure you want to delete this deal? This action cannot be undone."
      />
    </div>
  );
}
