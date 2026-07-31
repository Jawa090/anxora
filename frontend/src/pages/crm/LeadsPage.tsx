import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Sparkles, Mail, Building2, Download, Upload, MoreHorizontal, Edit, Trash2, Eye, Globe, CheckCircle, UserCheck, Columns, UserCircle2, Zap, ChevronRight } from "lucide-react";
import { useLeads, useDeleteLead, useBulkDeleteLeads, useBulkAssignLeads, useBulkUpdateCreatedByLeads, useUsers } from "@/hooks/useCrmData";
import { useUpdateLead } from "@/hooks/useCrmMutations";
import { useCreateActivity } from "@/hooks/useCrmInteractions";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";
import { LeadsKanbanView } from "@/components/crm/leads/LeadsKanbanView";
import { LeadsActivitiesView } from "@/components/crm/leads/LeadsActivitiesView";
import { LeadsCalendarView } from "@/components/crm/leads/LeadsCalendarView";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { useCustomDialog } from "@/contexts/DialogContext";
import { toast } from "sonner";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailComposer } from "@/components/mail/EmailComposer";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const statusTone = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "qualified") return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
  if (s === "contacted") return "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/50";
  if (s === "unqualified") return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
  return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
};

type ViewType = "kanban" | "list" | "activities" | "calendar";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  stage?: string;
  source: string;
  value: number;
  type: "inbound" | "planned";
  createdAt: string;
  responsiblePersonName?: string;
  responsiblePersonAvatar?: string;
  assignedToName?: string;
  assignedToAvatar?: string;
  campaignName?: string;
  campaignId?: string;
  createdByName?: string;
  createdByAvatar?: string;
  // Extra DB fields
  priority?: string;
  designation?: string;
  address?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  industry?: string;
  contact_person?: string;
  next_follow_up_date?: string;
  last_contacted_date?: string;
  expected_close_date?: string;
  agent_name?: string;
  pipeline?: string;
  latestActivityType?: string;
  latestCommentContent?: string;
  latestEmailDesc?: string;
  latestEmailSub?: string;
  latestCallDesc?: string;
  latestCallSub?: string;
  latestNoteDesc?: string;
  latestNoteSub?: string;
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | undefined>(undefined);

  // Restore scroll position and highlight when coming back from lead detail
  useEffect(() => {
    const savedScroll = sessionStorage.getItem("leads_scroll_y");
    const savedId = sessionStorage.getItem("leads_last_id");
    if (savedScroll) {
      const y = parseInt(savedScroll, 10);
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" });
      });
      sessionStorage.removeItem("leads_scroll_y");
    }
    if (savedId) {
      setHighlightedLeadId(savedId);
      sessionStorage.removeItem("leads_last_id");
      // Auto-clear highlight after 3 seconds
      setTimeout(() => setHighlightedLeadId(undefined), 3000);
    }
  }, [location.key]);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerTo, setEmailComposerTo] = useState("");
  const [emailComposerLeadId, setEmailComposerLeadId] = useState<string>("");
  const createActivity = useCreateActivity();

  const { data: mailboxes = [], isLoading: mailboxesLoading } = useQuery({
    queryKey: ["connected-mailboxes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await api.get<any[]>('/email/mailboxes');
      return data || [];
    },
    enabled: !!user,
  });

  const openEmailComposer = (email: string, leadId: string) => {
    if (mailboxesLoading) return;
    if (mailboxes.length === 0) {
      toast.error("No email account connected", {
        description: "Connect your Gmail or Outlook account first to send emails.",
        action: {
          label: "Connect Now",
          onClick: () => navigate("/collaboration/mail"),
        },
        duration: 6000,
      });
      return;
    }
    setEmailComposerTo(email);
    setEmailComposerLeadId(leadId);
    setShowEmailComposer(true);
  };
  const [view, setView] = usePersistentState<ViewType>("leads_view", "list");
  const [search, setSearch] = usePersistentState("leads_search", "");
  const [status, setStatus] = usePersistentState("leads_status", "all");
  const [stageFilter, setStageFilter] = usePersistentState("leads_stage", "all");
  const [type, setType] = usePersistentState("leads_type", "all");
  const [workspaceFilter, setWorkspaceFilter] = usePersistentState("leads_workspace", "all");
  const { confirm } = useCustomDialog();
  const [sortBy, setSortBy] = usePersistentState("leads_sortBy", "recent");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = usePersistentState("leads_currentPage", 1);
  const [pageSize, setPageSize] = usePersistentState("leads_pageSize", 100);
  const [startDate, setStartDate] = usePersistentState<string>("leads_startDate", "");
  const [endDate, setEndDate] = usePersistentState<string>("leads_endDate", "");
  const [priorityFilter, setPriorityFilter] = usePersistentState("leads_priority", "all");
  const [sourceFilter, setSourceFilter] = usePersistentState("leads_source", "all");
  const [assignedToFilter, setAssignedToFilter] = usePersistentState("leads_assignedTo", "");
  const [tagsFilter, setTagsFilter] = usePersistentState("leads_tags", "");
  const [campaignFilter, setCampaignFilter] = usePersistentState("leads_campaign", "");
  const [campaignNameFilter, setCampaignNameFilter] = usePersistentState("leads_campaignName", "");
  const [minValue, setMinValue] = usePersistentState("leads_minValue", "");
  const [maxValue, setMaxValue] = usePersistentState("leads_maxValue", "");

  const { data: dbLeads, isLoading, isError } = useLeads({
    search,
    status: status !== "all" ? status : undefined,
    stage: stageFilter !== "all" ? stageFilter : undefined,
    type: type !== "all" ? type : undefined,
    workspaceId: workspaceFilter !== "all" ? workspaceFilter : undefined,
    page: currentPage,
    limit: pageSize,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    assignedTo: assignedToFilter ? assignedToFilter : undefined,
    tags: tagsFilter || undefined,
    campaign: campaignFilter || undefined,
    campaignName: campaignNameFilter || undefined,
    minValue: minValue || undefined,
    maxValue: maxValue || undefined,
  });
  const { data: users = [] } = useUsers({ department: 'Sales', includeSelf: true });
  const { data: allMembers = [] } = useOrganizationProfiles({ includeSelf: true });
  const { data: salesMarketingMembers = [] } = useOrganizationProfiles({ includeSelf: true, department: 'sales,marketing' });
  const { data: pipelineStages = [] } = usePipelineStages();
  const deleteLead = useDeleteLead();
  const bulkDeleteLeads = useBulkDeleteLeads();
  const bulkAssignLeads = useBulkAssignLeads();
  const bulkUpdateCreatedByLeads = useBulkUpdateCreatedByLeads();
  const updateLead = useUpdateLead();
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState("");
  const [createdByPickerOpen, setCreatedByPickerOpen] = useState(false);
  const [bulkCreatedByUserId, setBulkCreatedByUserId] = useState("");

  // ── Column visibility ─────────────────────────────────────────────────────
  // All available columns (from DB via l.*). First 4 always visible by default.
  const ALL_COLUMNS: { key: string; label: string }[] = [
    { key: "name", label: "Lead / Email" },
    { key: "title", label: "Title" },
    { key: "company", label: "Company" },
    { key: "source", label: "Source" },
    { key: "campaignName", label: "Campaign" },
    { key: "value", label: "Value" },
    // Campaign responsible db field name is responsible_person 
    { key: "responsible", label: "Campaign Responsible" },
    // Lead responsible db field name is assigned_to 
    { key: "assignedTo", label: "Leads Responsible" },
    { key: "phone", label: "Contact" },
    { key: "createdAt", label: "Created" },
    { key: "createdByName", label: "Created By" },
    { key: "stage", label: "Stage" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "designation", label: "Designation" },
    { key: "address", label: "Address" },
    { key: "email", label: "Email" },
    { key: "website", label: "Website" },
    { key: "notes", label: "Notes" },
    { key: "tags", label: "Tags" },
    { key: "industry", label: "Industry" },
    { key: "contact_person", label: "Contact Person" },
    { key: "next_follow_up_date", label: "Follow-up Date" },
    { key: "last_contacted_date", label: "Last Contacted" },
    { key: "expected_close_date", label: "Expected Close" },
    { key: "agent_name", label: "Agent" },
    { key: "pipeline", label: "Pipeline" },
    { key: "latestActivityType", label: "Activity Type" },
    { key: "comments", label: "Comments" },
    { key: "actions", label: "Actions" },
  ];
  const ALL_COLUMN_KEYS = ALL_COLUMNS.map(c => c.key);
  const ALL_COLUMN_LABELS: Record<string, string> = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.label]));

  // Default visible: first 4 + actions
  const DEFAULT_VISIBLE = ["name", "company", "source", "campaignName", "actions"];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("leads_visible_columns");
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch { return DEFAULT_VISIBLE; }
  });
  const [colPickerOpen, setColPickerOpen] = useState(false);

  const toggleColumn = (key: string) => {
    if (key === "name" || key === "actions") return; // always visible
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem("leads_visible_columns", JSON.stringify(next));
      return next;
    });
  };

  const leads: LeadRow[] = useMemo(() => {
    // Handle different response formats from the API
    let leadsData: any[] = [];

    if (Array.isArray(dbLeads)) {
      leadsData = dbLeads;
    } else if (dbLeads && typeof dbLeads === 'object') {
      const dataObj = dbLeads as any;
      if (Array.isArray(dataObj.data)) {
        leadsData = dataObj.data;
      } else if (dataObj.leads && Array.isArray(dataObj.leads)) {
        leadsData = dataObj.leads;
      }
    }

    return leadsData.map((l: any) => {
      const inferredType = ((l.source || "").toLowerCase().includes("inbound") || (l.channel || "").includes("web")) ? "inbound" : "planned";
      return {
        id: l.id,
        name: l.title || l.name || "Untitled",
        email: l.email || "",
        phone: l.phone || l.company_phone || "",
        company: l.company_name || l.company || "",
        status: l.status || "new",
        stage: l.stage || l.status || "new",
        source: l.source || l.lead_source || "",
        value: Number(l.value) || 0,
        type: inferredType,
        createdAt: l.created_at,
        responsiblePersonName: l.responsible_person_name,
        responsiblePersonAvatar: l.responsible_person_avatar,
        assignedToName: l.assigned_to_name,
        assignedToAvatar: l.assigned_to_avatar,
        campaignName: l.campaign_name || l.campaignName || l.campaign || "",
        campaignId: l.campaign_id || l.campaignId || "",
        createdByName: l.createdByName || l.created_by_name || null,
        createdByAvatar: l.createdByAvatar || l.created_by_avatar || null,
        // Extra DB fields
        priority: l.priority || "",
        designation: l.designation || "",
        address: l.address || "",
        website: l.website || "",
        notes: l.notes || "",
        tags: l.tags || [],
        industry: l.industry || "",
        contact_person: l.contact_person || "",
        next_follow_up_date: l.next_follow_up_date || "",
        last_contacted_date: l.last_contacted_date || "",
        expected_close_date: l.expected_close_date || "",
        agent_name: l.agent_name || "",
        pipeline: l.pipeline || "",
        latestActivityType: l.latest_activity_type || "",
        latestCommentContent: l.latest_comment_content || "",
        latestEmailDesc: l.latest_email_desc || "",
        latestEmailSub: l.latest_email_sub || "",
        latestCallDesc: l.latest_call_desc || "",
        latestCallSub: l.latest_call_sub || "",
        latestNoteDesc: l.latest_note_desc || "",
        latestNoteSub: l.latest_note_sub || "",
      };
    });
  }, [dbLeads]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedLeads([]);
    setIsAllSelectedGlobally(false);
  }, [search, status, stageFilter, type, workspaceFilter, startDate, endDate, assignedToFilter, priorityFilter, minValue, maxValue]);

  const [sourceTab, setSourceTab] = useState("all");

  // Unique sources from current leads for dynamic tabs
  const sourceTabs = useMemo(() => {
    const sources = leads
      .map(l => {
        const s = (l.source || "").trim();
        if (s.toLowerCase() === "instantly") return "Instantly";
        return s.toLowerCase();
      })
      .filter(Boolean);
    const unique = Array.from(new Set(sources)).sort();
    return unique;
  }, [leads]);

  const filtered = useMemo(() => {
    return [...leads]
      .filter(l => {
        if (sourceTab === "all") return true;
        const s = (l.source || "").trim();
        const normalized = s.toLowerCase() === "instantly" ? "Instantly" : s.toLowerCase();
        return normalized === sourceTab;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "value") return b.value - a.value;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [leads, sortBy, sourceTab]);

  const handleCreate = () => navigate("/crm/leads/create");


  const handleBulkDelete = () => {
    if (selectedLeads.length === 0 && !isAllSelectedGlobally) return;

    const count = isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length;

    confirm(`Are you sure you want to delete ${count} leads? This action cannot be undone.`, {
      title: "Bulk Delete Leads",
      confirmLabel: "Delete",
      variant: "destructive",
    }).then((confirmed) => {
      if (confirmed) {
        bulkDeleteLeads.mutate(
          isAllSelectedGlobally
            ? { all: true, filters: { search, status, type, workspaceId: workspaceFilter } }
            : selectedLeads,
          {
            onSuccess: () => {
              setSelectedLeads([]);
              setIsAllSelectedGlobally(false);
            },
          }
        );
      }
    });
  };

  const handleBulkAssign = (userId: string) => {
    if (!userId || selectedLeads.length === 0) return;
    bulkAssignLeads.mutate(
      { ids: selectedLeads, assigned_to: userId },
      {
        onSuccess: () => {
          setSelectedLeads([]);
          setIsAllSelectedGlobally(false);
          setAssignPickerOpen(false);
          setBulkAssignUserId("");
        },
      }
    );
  };

  const handleBulkUpdateCreatedBy = (userId: string) => {
    if (!userId || selectedLeads.length === 0) return;
    bulkUpdateCreatedByLeads.mutate(
      { ids: selectedLeads, created_by: userId },
      {
        onSuccess: () => {
          setSelectedLeads([]);
          setIsAllSelectedGlobally(false);
          setCreatedByPickerOpen(false);
          setBulkCreatedByUserId("");
        },
      }
    );
  };

  const handleBulkExport = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Status', 'Source', 'Value', 'Created'],
      ...filtered
        .filter(lead => selectedLeads.includes(lead.id))
        .map(lead => [
          lead.name,
          lead.email,
          lead.phone,
          lead.company,
          lead.status,
          lead.source,
          lead.value.toString(),
          lead.createdAt
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Leads exported successfully');
  };

  const columns: EntityColumn<LeadRow>[] = [
    {
      key: "name",
      header: "Lead",
      sortable: true,
      render: (lead) => (
        <div className="space-y-0.5 max-w-[250px]">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-semibold truncate">{lead.contact_person}</span>
            <Badge variant="outline" className={cn(statusTone(lead.stage), "whitespace-nowrap flex-shrink-0 uppercase")}>
              {lead.stage || "New"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Mail className="h-3 w-3" />
            {lead.email ? (
              <span
                className="hover:text-primary hover:underline transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openEmailComposer(lead.email, lead.id);
                }}
              >
                {lead.email}
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (lead) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground max-w-[180px]">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{lead.company || "—"}</span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      render: (lead) => <span className="text-sm text-muted-foreground">{lead.source || "—"}</span>,
    },
    {
      key: "campaignName",
      header: "Campaign",
      sortable: true,
      render: (lead) => (
        lead.campaignName ? (
          <span className="text-sm text-muted-foreground truncate max-w-[160px] block" title={lead.campaignName}>
            {lead.campaignName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sortable: true,
      render: (lead) => (
        <span className="font-semibold">
          {lead.value ? `$${Number(lead.value).toLocaleString()}` : "—"}
        </span>
      ),
    },
    // Campaign responsible db field name is responsible_person 
    {
      key: "responsible",
      header: "Campaign Responsible",
      render: (lead) => (
        <div className="flex items-center gap-2">
          {lead.responsiblePersonName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border/50">
                {lead.responsiblePersonAvatar ? (
                  <img src={lead.responsiblePersonAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-primary">
                    {lead.responsiblePersonName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">{lead.responsiblePersonName}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    // Lead responsible db field name is assigned_to
    {
      key: "assignedTo",
      header: "Leads Responsible",
      render: (lead) => (
        <div className="flex items-center gap-2">
          {lead.assignedToName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden border border-border/50 shrink-0">
                {lead.assignedToAvatar ? (
                  <img src={lead.assignedToAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-blue-600">
                    {lead.assignedToName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">{lead.assignedToName}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Contact",
      render: (lead) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lead.phone ? (
            <ClickToCall
              phoneNumber={lead.phone}
              entityType="lead"
              entityId={lead.id}
              className="font-medium"
            />
          ) : (
            "—"
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (lead) => (
        <span className="text-sm text-muted-foreground">
          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "createdByName",
      header: "Created By",
      render: (lead) => (
        <div className="flex items-center gap-2">
          {lead.createdByName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border/50 shrink-0">
                {lead.createdByAvatar ? (
                  <img src={lead.createdByAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-primary">
                    {lead.createdByName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">{lead.createdByName}</span>
            </>
          ) : lead.source === 'Instantly' ? (
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Zap className="h-3 w-3 text-orange-500" />
              </div>
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Instantly</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    // ── Extra DB columns ──────────────────────────────────────────────
    { key: "title", header: "Title", className: "min-w-[220px] max-w-[280px]", render: (l) => <span className="text-sm font-medium text-foreground truncate block max-w-[260px]" title={l.name || ""}>{l.name || "—"}</span> },
    { key: "stage", header: "Stage", render: (l) => l.stage ? <Badge variant="outline" className={cn(statusTone(l.stage), "uppercase text-[10px]")}>{l.stage}</Badge> : <span className="text-muted-foreground text-sm">—</span> },
    { key: "status", header: "Status", render: (l) => <span className="text-sm text-muted-foreground">{l.status || "—"}</span> },
    { key: "priority", header: "Priority", render: (l) => l.priority ? <Badge variant="outline" className="capitalize text-[10px]">{l.priority}</Badge> : <span className="text-muted-foreground text-sm">—</span> },
    { key: "designation", header: "Designation", render: (l) => <span className="text-sm text-muted-foreground">{l.designation || "—"}</span> },
    { key: "address", header: "Address", render: (l) => <span className="text-sm text-muted-foreground truncate max-w-[150px] block">{l.address || "—"}</span> },
    { key: "email", header: "Email", render: (l) => l.email ? <span className="text-sm text-primary hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); openEmailComposer(l.email, l.id); }}>{l.email}</span> : <span className="text-muted-foreground text-sm">—</span> },
    { key: "website", header: "Website", render: (l) => l.website ? <a href={l.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[120px] block" onClick={e => e.stopPropagation()}>{l.website}</a> : <span className="text-muted-foreground text-sm">—</span> },
    { key: "notes", header: "Notes", render: (l) => <span className="text-sm text-muted-foreground line-clamp-1 max-w-[180px] block">{l.notes || "—"}</span> },
    { key: "tags", header: "Tags", render: (l) => l.tags && l.tags.length > 0 ? <div className="flex flex-wrap gap-1">{(Array.isArray(l.tags) ? l.tags : String(l.tags).split(",")).slice(0, 3).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px] px-1">{t}</Badge>)}</div> : <span className="text-muted-foreground text-sm">—</span> },
    { key: "industry", header: "Industry", render: (l) => <span className="text-sm text-muted-foreground">{l.industry || "—"}</span> },
    { key: "contact_person", header: "Contact Person", render: (l) => <span className="text-sm text-muted-foreground">{l.contact_person || "—"}</span> },
    { key: "next_follow_up_date", header: "Follow-up", render: (l) => <span className="text-sm text-muted-foreground">{l.next_follow_up_date ? new Date(l.next_follow_up_date).toLocaleDateString() : "—"}</span> },
    { key: "last_contacted_date", header: "Last Contact", render: (l) => <span className="text-sm text-muted-foreground">{l.last_contacted_date ? new Date(l.last_contacted_date).toLocaleDateString() : "—"}</span> },
    { key: "expected_close_date", header: "Close Date", render: (l) => <span className="text-sm text-muted-foreground">{l.expected_close_date ? new Date(l.expected_close_date).toLocaleDateString() : "—"}</span> },
    { key: "agent_name", header: "Agent", render: (l) => <span className="text-sm text-muted-foreground">{l.agent_name || "—"}</span> },
    { key: "pipeline", header: "Pipeline", render: (l) => <span className="text-sm text-muted-foreground capitalize">{l.pipeline || "—"}</span> },
    {
      key: "latestActivityType",
      header: "Activity Type",
      className: "min-w-[180px]",
      render: (l) => {
        if (!l.latestActivityType) return <span className="text-sm text-muted-foreground">—</span>;
        const types = l.latestActivityType.split(",").map(t => t.trim()).filter(Boolean);

        const details: { type: string; subject?: string; desc?: string }[] = [];
        types.forEach(t => {
          const typeLower = t.toLowerCase();
          if (typeLower.includes("email") && (l.latestEmailSub || l.latestEmailDesc)) {
            details.push({ type: "Email", subject: l.latestEmailSub, desc: l.latestEmailDesc });
          } else if (typeLower.includes("call") && (l.latestCallSub || l.latestCallDesc)) {
            details.push({ type: "Call Log", subject: l.latestCallSub, desc: l.latestCallDesc });
          } else if (typeLower.includes("note") && (l.latestNoteSub || l.latestNoteDesc)) {
            details.push({ type: "Note", subject: l.latestNoteSub, desc: l.latestNoteDesc });
          }
        });

        const badgeList = (
          <div className="flex flex-wrap gap-1">
            {types.map(t => (
              <Badge key={t} variant="secondary" className="capitalize text-[10px] px-1.5 py-0.5">
                {t.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        );

        if (details.length === 0) return badgeList;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer inline-block">{badgeList}</div>
              </HoverCardTrigger>
              <HoverCardContent 
                className="w-80 p-3 space-y-3 z-[100] cursor-pointer hover:border-primary/40 transition-colors" 
                align="start"
                onClick={() => navigate(`/crm/leads/${l.id}?tab=activity`)}
              >
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1 border-border">
                  Latest Activity Details
                </p>
                <div className="space-y-3">
                  {details.map(d => (
                    <div key={d.type} className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Badge className="text-[9px] px-1 py-0 capitalize" variant="outline">{d.type}</Badge>
                        {d.subject && <span className="truncate max-w-[180px] text-muted-foreground font-normal">{d.subject}</span>}
                      </div>
                      {d.desc ? (
                        <p className="text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap pl-2 border-l-2 border-primary/20">
                          {d.desc}
                        </p>
                      ) : (
                        <p className="text-muted-foreground/50 italic pl-2 border-l-2 border-border/30">No description</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t pt-1.5 border-border flex justify-end">
                  <span className="text-[9px] text-primary/80 font-medium flex items-center gap-0.5">
                    Click to view all activities <ChevronRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        );
      }
    },
    { key: "comments", header: "Comments", render: (l) => <span className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]" title={l.latestCommentContent || ""}>{l.latestCommentContent || "—"}</span> },
    {
      key: "actions",
      header: "",
      render: (lead) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { sessionStorage.setItem("leads_scroll_y", String(window.scrollY)); navigate(`/crm/leads/${lead.id}`); }}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Lead
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  updateLead.mutate({ id: lead.id, status: 'unqualified', stage: 'unqualified' });
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                Unqualify Lead
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await confirm('Are you sure you want to delete this lead?', { variant: 'destructive', title: 'Delete Lead' })) {
                    deleteLead.mutate(lead.id);
                  }
                }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];


  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <PageHeader
        title="Leads"
        description="A live filterable pipeline of every lead with fast actions."
        meta={[
          { label: "Total", value: (dbLeads as any)?.pagination?.total || 0, tone: "info" },
          { label: "Selected", value: isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length, tone: "warning" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/crm/leads/external-sources')}>
              <Globe className="h-4 w-4 mr-2" />External Sources
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/crm/leads/import?type=lead')}>
              <Upload className="h-4 w-4 mr-2" />Import
            </Button>
            <Button className="bg-primary" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />New Lead
            </Button>
          </div>
        }
      />


      {/* ── Filters / Sort / View toolbar ─────────────────────────────── */}
      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title,name, comp, camp, email, web, created, desig, notes, contact..."
        searchClassName="max-w-[475px]"
        filters={[
          {
            label: "Status", value: status, onChange: setStatus, options: [
              { label: "New", value: "new" },
              { label: "Contacted", value: "contacted" },
              { label: "Qualified", value: "qualified" },
              { label: "Interested", value: "interested" },
              { label: "Converted", value: "converted" },
              { label: "Disqualified", value: "disqualified" },
            ]
          },
          {
            label: "Stage", value: stageFilter, onChange: setStageFilter,
            options: [...(pipelineStages?.map(s => ({ label: s.stage_label, value: s.stage_key })) || [])]
          },
          // {
          //   label: "Type", value: type, onChange: setType, options: [
          //     { label: "Inbound", value: "inbound" }, { label: "Planned", value: "planned" },
          //   ]
          // },
          {
            label: "Priority", value: priorityFilter, onChange: setPriorityFilter, options: [
              { label: "New", value: "new" }, { label: "Low", value: "low" },
              { label: "Medium", value: "medium" }, { label: "High", value: "high" }, { label: "Urgent", value: "urgent" },
            ]
          },
          // {
          //   label: "Source", value: sourceFilter, onChange: setSourceFilter, options: [
          //     { label: "Website", value: "Website" },
          //     { label: "Referral", value: "Referral" }, { label: "Cold Call", value: "Cold Call" },
          //     { label: "LinkedIn", value: "LinkedIn" }, { label: "Email", value: "Email" }, { label: "Other", value: "Other" },
          //   ]
          // },
          {
            label: "Campaign", type: "input" as any, value: campaignNameFilter, onChange: setCampaignNameFilter,
          },
          {
            label: "Responsible", type: "input" as any, value: assignedToFilter, onChange: setAssignedToFilter,
          },
          // { label: "Tags", type: "input" as any, value: tagsFilter, onChange: setTagsFilter },
          { label: "Min Value", type: "input" as any, value: minValue, onChange: setMinValue },
          { label: "Max Value", type: "input" as any, value: maxValue, onChange: setMaxValue },
          { label: "From", type: "date" as any, value: startDate, onChange: setStartDate },
          { label: "To", type: "date" as any, value: endDate, onChange: setEndDate },
        ]}
        sortValue={sortBy}
        sortOptions={[
          { label: "Recent", value: "recent" },
          { label: "Name", value: "name" },
          { label: "Value", value: "value" },
        ]}
        onSortChange={setSortBy}
        view={view}
        viewOptions={[
          { id: "list", label: "List" },
          { id: "kanban", label: "Kanban" },
          // { id: "activities", label: "Activities" },
          { id: "calendar", label: "Calendar" },
        ]}
        onViewChange={(v) => setView(v as ViewType)}
      />

      {/* ── Source tabs — dynamic, one per unique source value ────────── */}
      {view === "list" && sourceTabs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap border-b border-border pb-0">
          <button
            onClick={() => setSourceTab("all")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
              sourceTab === "all"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            All
            <span className="ml-1.5 text-xs opacity-60">({(dbLeads as any)?.pagination?.total ?? leads.length})</span>
          </button>
          {sourceTabs.map(src => {
            const sourceCounts = (dbLeads as any)?.source_counts || {};
            const count = sourceCounts[src] ?? leads.filter(l => (l.source || "").trim() === src).length;
            return (
              <button
                key={src}
                onClick={() => setSourceTab(src)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px capitalize",
                  sourceTab === src
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {src}
                <span className="ml-1.5 text-xs opacity-60">({count})</span>
              </button>
            );
          })}
          {/* Column picker — always visible in list view, pushed to right */}
          <Popover open={colPickerOpen} onOpenChange={setColPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-auto">
                <Columns className="h-3.5 w-3.5" />
                Add Fields
                <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-semibold">
                  {visibleColumns.filter(k => k !== "name" && k !== "actions").length}/{ALL_COLUMN_KEYS.length - 2}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 h-[47vh] p-2" align="end">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                Show / Hide Columns
              </p>
              <ScrollArea className="h-[42vh]">
                <div className="space-y-0.5 pr-2">
                  {ALL_COLUMNS.map(({ key, label }) => (
                    <label
                      key={key}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent select-none",
                        key === "name" || key === "actions" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <Checkbox
                        checked={visibleColumns.includes(key)}
                        onCheckedChange={() => toggleColumn(key)}
                        disabled={key === "name" || key === "actions"}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      )}


      {/* ── Table toolbar: bulk actions + column picker ────────────────── */}
      {view === "list" && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk actions — appear when leads are selected */}
          {(selectedLeads.length > 0 || isAllSelectedGlobally) && (
            <>
              {selectedLeads.length > 0 && !isAllSelectedGlobally && (
                <>
                  <Popover open={assignPickerOpen} onOpenChange={setAssignPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <UserCheck className="h-4 w-4" />
                        Assign To ({selectedLeads.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Assign {selectedLeads.length} lead{selectedLeads.length > 1 ? "s" : ""} to
                      </p>
                      <MemberSearchSelect
                        members={allMembers}
                        value={bulkAssignUserId}
                        onChange={(id) => { setBulkAssignUserId(id); if (id) handleBulkAssign(id); }}
                        placeholder="Select a user..."
                      />
                    </PopoverContent>
                  </Popover>

                </>
              )}
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="h-4 w-4 mr-2" />
                Export ({isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length})
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleBulkDelete}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length})
              </Button>
              <div className="h-5 w-px bg-border mx-1" />
            </>
          )}


        </div>
      )}

      {/* ── List view table ────────────────────────────────────────────── */}
      {view === "list" && (
        <Card>
          <CardContent className="p-4 lg:p-6">
            <EntityTable
              data={filtered}
              columns={columns.filter(c => visibleColumns.includes(c.key as string))}
              isLoading={isLoading}
              pageSize={pageSize}
              totalCount={(dbLeads as any)?.pagination?.total || filtered.length}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              selectedRows={selectedLeads}
              onSelectionChange={(ids) => {
                setSelectedLeads(ids as string[]);
                if (ids.length === 0) setIsAllSelectedGlobally(false);
              }}
              isAllSelectedGlobally={isAllSelectedGlobally}
              onGlobalSelectionChange={setIsAllSelectedGlobally}
              emptyState={
                <EmptyState
                  title="No leads yet"
                  description="Import or create your first lead to get started."
                  actionLabel="Add lead"
                  onAction={handleCreate}
                  icon={<Sparkles className="h-6 w-6" />}
                />
              }
              highlightedId={highlightedLeadId}
              onRowClick={(row) => {
                sessionStorage.setItem("leads_scroll_y", String(window.scrollY || document.documentElement.scrollTop));
                sessionStorage.setItem("leads_last_id", String(row.id));
                navigate(`/crm/leads/${row.id}`);
              }}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && view === "kanban" && <LeadsKanbanView leads={filtered as any} onCreateLead={handleCreate} selectedStage={status} />}
      {view === "activities" && <LeadsActivitiesView />}
      {view === "calendar" && <LeadsCalendarView />}

      {isError && (
        <Card>
          <CardContent className="p-6">
            <EmptyState title="Failed to load leads" description="Check connection and try again." muted />
          </CardContent>
        </Card>
      )}

      <EmailComposer
        open={showEmailComposer}
        onOpenChange={setShowEmailComposer}
        mailboxes={mailboxes}
        initialTo={emailComposerTo}
        entityType="lead"
        entityId={emailComposerLeadId}
      />
    </div>
  );
}
