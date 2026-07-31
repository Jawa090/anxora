import { useMemo, useState, useEffect, useRef, Suspense, lazy } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  Sparkles,
  Phone,
  Mail,
  Building2,
  Layers,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  XCircle,
  Columns,
  UserCheck,
} from "lucide-react";
import {
  useDeals,
  useDeleteDeal,
  useBulkDeleteDeals,
  useBulkAssignDeals,
} from "@/hooks/useCrmData";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { useUpdateDeal } from "@/hooks/useCrmMutations";
import { useCreateActivity } from "@/hooks/useCrmInteractions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { useCustomDialog } from "@/contexts/DialogContext";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";
import { DealsKanbanView } from "@/components/crm/deals/DealsKanbanView";
import { DealsActivitiesView } from "@/components/crm/deals/DealsActivitiesView";
import { DealsCalendarView } from "@/components/crm/deals/DealsCalendarView";
import { toast } from "sonner";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { useDealPipelineStages } from "@/hooks/usePipelineStages";
import { WorkspaceFilter } from "@/components/crm/leads/WorkspaceFilter";
import { usePersistentState } from "@/hooks/usePersistentState";
import { EmailComposer } from "@/components/mail/EmailComposer";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const WorkflowsPage = lazy(() => import("@/pages/automation/WorkflowsPage"));

type ViewType = "kanban" | "list" | "activities" | "calendar" | "automation";

const statusTone = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "won" || s.includes("close"))
    return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
  if (s === "lost" || s.includes("lost"))
    return "bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50";
  if (s.includes("proposal"))
    return "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/50";
  return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
};

type DealRow = {
  id: string;
  name: string;
  stage: string;
  status: string;
  value: number;
  company: string;
  contact: string;
  email: string;
  phone: string;
  createdAt: string;
  source?: string;
  projectType?: string;
  responsiblePersonName?: string;
  responsiblePersonAvatar?: string;
  assignedToName?: string;
  assignedToAvatar?: string;
  priority?: string;
  probability?: number;
  expectedCloseDate?: string;
  deadline?: string;
  invoiceAmount?: number;
  campaignName?: string;
  campaignId?: string;
  notes?: string;
  tags?: string[];
  address?: string;
  website?: string;
  designation?: string;
  contact_person?: string;
  agent_name?: string;
  pipeline?: string;
  createdByName?: string;
  createdByAvatar?: string;
  latestActivityType?: string;
  latestCommentContent?: string;
  latestEmailDesc?: string;
  latestEmailSub?: string;
  latestCallDesc?: string;
  latestCallSub?: string;
  latestNoteDesc?: string;
  latestNoteSub?: string;
};

export default function DealsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [highlightedDealId, setHighlightedDealId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("deals_scroll_y");
    const savedId = sessionStorage.getItem("deals_last_id");
    if (savedScroll) {
      const y = parseInt(savedScroll, 10);
      requestAnimationFrame(() => { window.scrollTo({ top: y, behavior: "instant" }); });
      sessionStorage.removeItem("deals_scroll_y");
    }
    if (savedId) {
      setHighlightedDealId(savedId);
      sessionStorage.removeItem("deals_last_id");
      setTimeout(() => setHighlightedDealId(undefined), 3000);
    }
  }, [location.key]);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerTo, setEmailComposerTo] = useState("");
  const [emailComposerDealId, setEmailComposerDealId] = useState<string>("");
  const createActivity = useCreateActivity();

  const { data: mailboxes = [], isLoading: mailboxesLoading } = useQuery({
    queryKey: ["connected-mailboxes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await api.get<any[]>("/email/mailboxes");
      return data || [];
    },
    enabled: !!user,
  });

  const openEmailComposer = (email: string, dealId: string) => {
    if (mailboxesLoading) return;
    if (mailboxes.length === 0) {
      toast.error("No email account connected", {
        description:
          "Connect your Gmail or Outlook account first to send emails.",
        action: {
          label: "Connect Now",
          onClick: () => navigate("/collaboration/mail"),
        },
        duration: 6000,
      });
      return;
    }
    setEmailComposerTo(email);
    setEmailComposerDealId(dealId);
    setShowEmailComposer(true);
  };
  const { confirm } = useCustomDialog();
  const [view, setView] = usePersistentState<ViewType>("deals_view", "list");
  const [search, setSearch] = usePersistentState("deals_search", "");
  const [stage, setStage] = usePersistentState("deals_stage", "all");
  const [status, setStatus] = usePersistentState("deals_status", "all");
  const [workspaceFilter, setWorkspaceFilter] = usePersistentState(
    "deals_workspace",
    "all",
  );
  const [sortBy, setSortBy] = usePersistentState("deals_sortBy", "recent");
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [pageSize, setPageSize] = usePersistentState("deals_pageSize", 100);
  const [currentPage, setCurrentPage] = usePersistentState(
    "deals_currentPage",
    1,
  );
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);
  const [startDate, setStartDate] = usePersistentState<string>(
    "deals_startDate",
    "",
  );
  const [endDate, setEndDate] = usePersistentState<string>("deals_endDate", "");
  const [priorityFilter, setPriorityFilter] = usePersistentState(
    "deals_priority",
    "all",
  );
  const [sourceFilter, setSourceFilter] = usePersistentState(
    "deals_source",
    "all",
  );
  const [assignedToFilter, setAssignedToFilter] = usePersistentState(
    "deals_assignedTo",
    "all",
  );
  const [tagsFilter, setTagsFilter] = usePersistentState("deals_tags", "");
  const [campaignFilter, setCampaignFilter] = usePersistentState(
    "deals_campaign",
    "",
  );
  const [campaignNameFilter, setCampaignNameFilter] = usePersistentState("deals_campaignName", "");
  const [minValue, setMinValue] = usePersistentState("deals_minValue", "");
  const [maxValue, setMaxValue] = usePersistentState("deals_maxValue", "");

  const {
    data: dbDeals,
    isLoading,
    isError,
  } = useDeals({
    search,
    stage: stage !== "all" ? stage : undefined,
    status: status !== "all" ? status : undefined,
    page: currentPage,
    limit: pageSize,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    assignedTo: assignedToFilter && assignedToFilter !== "all" ? assignedToFilter : undefined,
    tags: tagsFilter || undefined,
    campaign: campaignFilter || undefined,
    campaignName: campaignNameFilter || undefined,
    minValue: minValue || undefined,
    maxValue: maxValue || undefined,
  });
  const { data: pipelineStages = [] } = useDealPipelineStages();
  const { data: allMembers = [] } = useOrganizationProfiles({ includeSelf: true });
  const deleteDeal = useDeleteDeal();
  const bulkDeleteDeals = useBulkDeleteDeals();
  const bulkAssignDeals = useBulkAssignDeals();
  const updateDeal = useUpdateDeal();
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState("");

  const handleBulkAssign = (userId: string) => {
    if (!userId || selectedDeals.length === 0) return;
    bulkAssignDeals.mutate(
      { ids: selectedDeals, assigned_to: userId },
      {
        onSuccess: () => {
          setSelectedDeals([]);
          setIsAllSelectedGlobally(false);
          setAssignPickerOpen(false);
          setBulkAssignUserId("");
        },
      }
    );
  };

  const handleBulkDelete = async () => {
    if (selectedDeals.length === 0 && !isAllSelectedGlobally) return;

    const count = isAllSelectedGlobally
      ? (dbDeals as any)?.pagination?.total
      : selectedDeals.length;

    confirm(
      `Are you sure you want to delete ${count} deals? This action cannot be undone.`,
      {
        title: "Bulk Delete Deals",
        confirmLabel: "Delete",
        variant: "destructive",
      },
    ).then(async (confirmed) => {
      if (confirmed) {
        try {
          await bulkDeleteDeals.mutateAsync(
            isAllSelectedGlobally
              ? { all: true, filters: { search, status, stage } }
              : selectedDeals,
          );
          setSelectedDeals([]);
          setIsAllSelectedGlobally(false);
        } catch (error) {
          // Error handled by mutation
        }
      }
    });
  };

  const handleBulkExport = () => {
    const csvContent = [
      ["Name", "Company", "Contact", "Value", "Stage", "Status", "Created"],
      ...filtered
        .filter((deal) => selectedDeals.includes(deal.id))
        .map((deal) => [
          deal.name,
          deal.company,
          deal.contact,
          deal.value.toString(),
          deal.stage,
          deal.status,
          deal.createdAt,
        ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Deals exported successfully");
  };

  // Reset selection when filters change
  useEffect(() => {
    setSelectedDeals([]);
    setIsAllSelectedGlobally(false);
  }, [search, status, stage, startDate, endDate, priorityFilter, assignedToFilter, minValue, maxValue]);

  const deals: DealRow[] = useMemo(() => {
    // Handle different response formats from the API
    let dealsData: any[] = [];

    if (Array.isArray(dbDeals)) {
      dealsData = dbDeals;
    } else if (dbDeals && typeof dbDeals === "object") {
      const dataObj = dbDeals as any;
      if (Array.isArray(dataObj.data)) {
        dealsData = dataObj.data;
      } else if (dataObj.deals && Array.isArray(dataObj.deals)) {
        dealsData = dataObj.deals;
      }
    }

    return dealsData.map((d: any) => {
      const stageKey = (d.stage || "qualification").toLowerCase();

      const companyName = d.company || d.companyName || d.company_name || "";
      const contactName = d.contactName || d.contact_name || d.name || "";
      const email =
        d.contactEmail || d.email || d.companyEmail || d.company_email || "";
      const phone =
        d.contactPhone || d.phone || d.companyPhone || d.company_phone || "";

      return {
        id: d.id,
        name: d.title || "Untitled Deal",
        stage: stageKey,
        status: d.status || d.stage || "open",
        value: Number(d.value) || 0,
        company: companyName,
        contact: contactName,
        email: email,
        phone: phone,
        createdAt: d.created_at || d.createdAt,
        source: d.source || d.lead_source || "",
        projectType: d.project_type || d.projectType,
        responsiblePersonName:
          d.responsible_person_name || d.responsiblePersonName,
        responsiblePersonAvatar:
          d.responsible_person_avatar || d.responsiblePersonAvatar,
        assignedToName: d.assigned_to_name || d.assignedToName,
        assignedToAvatar: d.assigned_to_avatar || d.assignedToAvatar,
        campaignName: d.campaign_name || d.campaignName || d.campaign || "",
        campaignId: d.campaign_id || d.campaignId || "",
        priority: d.priority || "medium",
        probability: d.probability !== undefined ? Number(d.probability) : 0,
        expectedCloseDate: d.expected_close_date || d.expectedCloseDate,
        deadline: d.deadline,
        invoiceAmount:
          d.invoice_amount !== undefined ? Number(d.invoice_amount) : 0,
        notes: d.notes || "",
        tags: d.tags || [],
        address: d.address || "",
        website: d.website || "",
        designation: d.designation || "",
        contact_person: d.contact_person || "",
        agent_name: d.agent_name || "",
        pipeline: d.pipeline || "",
        createdByName: d.created_by_name || d.createdByName || "",
        createdByAvatar: d.created_by_avatar || d.createdByAvatar || "",
        latestActivityType: d.latest_activity_type || "",
        latestCommentContent: d.latest_comment_content || "",
        latestEmailDesc: d.latest_email_desc || "",
        latestEmailSub: d.latest_email_sub || "",
        latestCallDesc: d.latest_call_desc || "",
        latestCallSub: d.latest_call_sub || "",
        latestNoteDesc: d.latest_note_desc || "",
        latestNoteSub: d.latest_note_sub || "",
      };
    });
  }, [dbDeals]);

  const [sourceTab, setSourceTab] = useState("all");

  // Combine pipeline stages from settings + unique stage values from actual deals in DB
  const stageOptions = useMemo(() => {
    const pipelineMap = new Map(
      (pipelineStages || []).map((s: any) => [s.stage_key, s.stage_label])
    );
    const uniqueFromDb: string[] = (dbDeals as any)?.unique_stages || [];
    // Add any stage from DB that doesn't exist in pipeline_stages
    uniqueFromDb.forEach((key) => {
      if (!pipelineMap.has(key)) {
        pipelineMap.set(key, key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    });
    return Array.from(pipelineMap.entries()).map(([value, label]) => ({ label, value }));
  }, [pipelineStages, dbDeals]);

  // Dynamic source tabs from deal data
  const sourceTabs = useMemo(() => {
    const sources = deals
      .map((d) => {
        const s = (d.source || "").trim();
        if (s.toLowerCase() === "instantly") return "Instantly";
        return s.toLowerCase();
      })
      .filter(Boolean);
    return Array.from(new Set(sources)).sort();
  }, [deals]);

  // ── Column visibility ─────────────────────────────────────────────────────
  const ALL_COLUMNS: { key: string; label: string }[] = [
    { key: "name", label: "Deal / Email" },
    { key: "title", label: "Title" },
    { key: "company", label: "Company" },
    { key: "contact", label: "Contact" },
    { key: "source", label: "Source" },
    { key: "campaignName", label: "Campaign" },
    { key: "value", label: "Value" },
    { key: "stage", label: "Stage" },
    { key: "status", label: "Status" },
    // Campaign responsible db field name is responsible_person 
    { key: "responsible", label: "Campaign Responsible" },
    { key: "assignedTo", label: "Assigned To" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created" },
    { key: "priority", label: "Priority" },
    { key: "probability", label: "Probability" },
    { key: "expectedCloseDate", label: "Expected Close" },
    { key: "invoiceAmount", label: "Invoice Amount" },
    { key: "projectType", label: "Project Type" },
    { key: "notes", label: "Notes" },
    { key: "tags", label: "Tags" },
    { key: "address", label: "Address" },
    { key: "website", label: "Website" },
    { key: "designation", label: "Designation" },
    { key: "contact_person", label: "Contact Person" },
    { key: "agent_name", label: "Agent" },
    { key: "pipeline", label: "Pipeline" },
    { key: "latestActivityType", label: "Activity Type" },
    { key: "comments", label: "Comments" },
    { key: "actions", label: "Actions" },
  ];
  const ALL_COLUMN_KEYS = ALL_COLUMNS.map((c) => c.key);
  const DEFAULT_VISIBLE = [
    "name",
    "company",
    "source",
    "campaignName",
    "value",
    "stage",
    "actions",
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("deals_visible_columns");
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch {
      return DEFAULT_VISIBLE;
    }
  });
  const [colPickerOpen, setColPickerOpen] = useState(false);

  const toggleColumn = (key: string) => {
    if (key === "name" || key === "actions") return;
    setVisibleColumns((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      localStorage.setItem("deals_visible_columns", JSON.stringify(next));
      return next;
    });
  };

  const filtered = useMemo(() => {
    return [...deals]
      .filter((d) => {
        if (sourceTab === "all") return true;
        const s = (d.source || "").trim();
        const normalized =
          s.toLowerCase() === "instantly" ? "Instantly" : s.toLowerCase();
        return normalized === sourceTab;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "value") return b.value - a.value;
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
  }, [deals, sortBy, sourceTab]);

  const columns: EntityColumn<DealRow>[] = [
    {
      key: "name",
      header: "Deal",
      sortable: true,
      render: (deal) => (
        <div className="space-y-0.5 max-w-[250px]">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-semibold truncate">{deal.contact_person || deal.name}</span>
            <Badge
              variant="outline"
              className={cn("whitespace-nowrap flex-shrink-0 uppercase", statusTone(deal.stage))}
            >
              {(deal.stage || "").replace(/_/g, " ") || "New"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Mail className="h-3 w-3" />
            {deal.email ? (
              <span
                className="hover:text-primary hover:underline transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openEmailComposer(deal.email, deal.id);
                }}
              >
                {deal.email}
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
      render: (deal) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground max-w-[180px]">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{deal.company || "—"}</span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (deal) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {deal.phone || deal.contact ? (
            <ClickToCall
              phoneNumber={deal.phone || deal.contact}
              entityType="deal"
              entityId={deal.id}
              className="font-medium"
            />
          ) : (
            "—"
          )}
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sortable: true,
      render: (deal) => (
        <span className="font-semibold">
          {deal.value ? `$${Number(deal.value).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      key: "campaignName",
      header: "Campaign",
      sortable: true,
      render: (deal) =>
        deal.campaignName ? (
          <span
            className="text-sm text-muted-foreground truncate max-w-[160px] block"
            title={deal.campaignName}
          >
            {deal.campaignName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "stage",
      header: "Stage",
      render: (deal) => (
        <Badge variant="outline" className={statusTone(deal.stage)}>
          {deal.stage || "Open"}
        </Badge>
      ),
    },

    // Campaign responsible db field name is responsible_person 
    {
      key: "responsible",
      header: "Campaign Responsible",
      render: (deal) => (
        <div className="flex items-center gap-2">
          {deal.responsiblePersonName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border/50">
                {deal.responsiblePersonAvatar ? (
                  <img
                    src={deal.responsiblePersonAvatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-primary">
                    {deal.responsiblePersonName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">
                {deal.responsiblePersonName}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "assignedTo",
      header: "Assigned To",
      render: (deal) => (
        <div className="flex items-center gap-2">
          {deal.assignedToName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden border border-border/50 shrink-0">
                {deal.assignedToAvatar ? (
                  <img src={deal.assignedToAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-blue-600">
                    {deal.assignedToName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">{deal.assignedToName}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "createdBy",
      header: "Created By",
      render: (deal) => (
        <div className="flex items-center gap-2">
          {deal.createdByName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center overflow-hidden border border-border/50 shrink-0">
                {deal.createdByAvatar ? (
                  <img src={deal.createdByAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-orange-600">
                    {deal.createdByName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">{deal.createdByName}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (deal) => (
        <span className="text-sm text-muted-foreground">
          {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    // ── Extra DB columns ──────────────────────────────────────────────
    { key: "title", header: "Title", className: "min-w-[220px] max-w-[280px]", render: (d) => <span className="text-sm font-medium text-foreground truncate block max-w-[260px]" title={d.name || ""}>{d.name || "—"}</span> },
    {
      key: "source",
      header: "Source",
      render: (d) => (
        <span className="text-sm text-muted-foreground">{d.source || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <span className="text-sm text-muted-foreground capitalize">
          {d.status || "—"}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (d) =>
        d.priority ? (
          <Badge variant="outline" className="capitalize text-[10px]">
            {d.priority}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "probability",
      header: "Probability",
      render: (d) =>
        d.probability ? (
          <span className="text-sm text-muted-foreground">
            {d.probability}%
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "expectedCloseDate",
      header: "Expected Close",
      render: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.expectedCloseDate
            ? new Date(d.expectedCloseDate).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
    {
      key: "invoiceAmount",
      header: "Invoice Amount",
      render: (d) =>
        d.invoiceAmount ? (
          <span className="text-sm font-medium">
            ${Number(d.invoiceAmount).toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "projectType",
      header: "Project Type",
      render: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.projectType || "—"}
        </span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      render: (d) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[180px] block">
          {d.notes || "—"}
        </span>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (d) =>
        d.tags && d.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(d.tags) ? d.tags : String(d.tags).split(","))
              .slice(0, 3)
              .map((t: string) => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1">
                  {t}
                </Badge>
              ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "address",
      header: "Address",
      render: (d) => (
        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
          {d.address || "—"}
        </span>
      ),
    },
    {
      key: "website",
      header: "Website",
      render: (d) =>
        d.website ? (
          <a
            href={d.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate max-w-[120px] block"
            onClick={(e) => e.stopPropagation()}
          >
            {d.website}
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      key: "designation",
      header: "Designation",
      render: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.designation || "—"}
        </span>
      ),
    },
    {
      key: "contact_person",
      header: "Contact Person",
      render: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.contact_person || "—"}
        </span>
      ),
    },
    {
      key: "agent_name",
      header: "Agent",
      render: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.agent_name || "—"}
        </span>
      ),
    },
    {
      key: "pipeline",
      header: "Pipeline",
      render: (d) => (
        <span className="text-sm text-muted-foreground capitalize">
          {d.pipeline || "—"}
        </span>
      ),
    },
    {
      key: "latestActivityType",
      header: "Activity Type",
      className: "min-w-[180px]",
      render: (d) => {
        if (!d.latestActivityType) return <span className="text-sm text-muted-foreground">—</span>;
        const types = d.latestActivityType.split(",").map(t => t.trim()).filter(Boolean);

        const details: { type: string; subject?: string; desc?: string }[] = [];
        types.forEach(t => {
          const typeLower = t.toLowerCase();
          if (typeLower.includes("email") && (d.latestEmailSub || d.latestEmailDesc)) {
            details.push({ type: "Email", subject: d.latestEmailSub, desc: d.latestEmailDesc });
          } else if (typeLower.includes("call") && (d.latestCallSub || d.latestCallDesc)) {
            details.push({ type: "Call Log", subject: d.latestCallSub, desc: d.latestCallDesc });
          } else if (typeLower.includes("note") && (d.latestNoteSub || d.latestNoteDesc)) {
            details.push({ type: "Note", subject: d.latestNoteSub, desc: d.latestNoteDesc });
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
                onClick={() => navigate(`/crm/deals/${d.id}?tab=activity`)}
              >
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1 border-border">
                  Latest Activity Details
                </p>
                <div className="space-y-3">
                  {details.map(det => (
                    <div key={det.type} className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Badge className="text-[9px] px-1 py-0 capitalize" variant="outline">{det.type}</Badge>
                        {det.subject && <span className="truncate max-w-[180px] text-muted-foreground font-normal">{det.subject}</span>}
                      </div>
                      {det.desc ? (
                        <p className="text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap pl-2 border-l-2 border-primary/20">
                          {det.desc}
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
    {
      key: "comments",
      header: "Comments",
      render: (d) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]" title={d.latestCommentContent || ""}>
          {d.latestCommentContent || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (deal) => (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => navigate(`/crm/deals/${deal.id}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => navigate(`/crm/deals/${deal.id}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Deal
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  updateDeal.mutate({
                    id: deal.id,
                    status: "unqualified",
                    stage: "unqualified",
                  });
                }}
              >
                <XCircle className="h-4 w-4 mr-2 text-orange-600" />
                Unqualify Deal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  if (
                    await confirm(
                      "Are you sure you want to delete this deal?",
                      { variant: "destructive", title: "Delete Deal" },
                    )
                  ) {
                    deleteDeal.mutate(deal.id);
                  }
                }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const handleCreate = () => navigate("/crm/deals/create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        description="Interactive pipeline of every deal with instant filters and automation shortcuts."
        meta={[
          {
            label: "Total",
            value: (dbDeals as any)?.pagination?.total || 0,
            tone: "info",
          },
          {
            label: "Selected",
            value: isAllSelectedGlobally
              ? (dbDeals as any)?.pagination?.total
              : selectedDeals.length,
            tone: "warning",
          },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/crm/leads/import?type=deal")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            {/* <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                setView(view === "automation" ? "list" : "automation")
              }
            >
              <Layers className="h-4 w-4" />
              Automation
            </Button> */}
            <Button className="bg-primary" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Deal
            </Button>
          </div>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title,name, comp, camp, email, web, desig, notes, contact..."
        searchClassName="max-w-[475px]"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { label: "Open", value: "open" },
              { label: "Won", value: "won" },
              // { label: "Lost", value: "lost" },
              { label: "Unqualified", value: "unqualified" },
            ],
          },
          {
            label: "Stage",
            value: stage,
            onChange: setStage,
            options: stageOptions,
          },
          {
            label: "Priority",
            value: priorityFilter,
            onChange: setPriorityFilter,
            options: [
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Urgent", value: "urgent" },
            ],
          },
          {
            label: "Campaign",
            type: "input" as any,
            value: campaignNameFilter,
            onChange: setCampaignNameFilter,
          },
          {
            label: "Responsible Person",
            type: "input" as any,
            value: assignedToFilter,
            onChange: setAssignedToFilter,
          },
          { label: "Min Value", type: "input" as any, value: minValue, onChange: setMinValue },
          { label: "Max Value", type: "input" as any, value: maxValue, onChange: setMaxValue },
          { label: "From", type: "date" as any, value: startDate, onChange: setStartDate },
          { label: "To", type: "date" as any, value: endDate, onChange: setEndDate },
        ]}
        // quickFilters={[
        //   {
        //     label: "Won",
        //     value: "won",
        //     active: status === "won",
        //     onToggle: setStatus,
        //   },
        //   {
        //     label: "Open",
        //     value: "open",
        //     active: status === "open",
        //     onToggle: setStatus,
        //   },
        //   {
        //     label: "Unqualified",
        //     value: "unqualified",
        //     active: status === "unqualified",
        //     onToggle: setStatus,
        //   },
        // ]}
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
          // {
          //   id: "automation",
          //   label: "Automation",
          //   icon: <Sparkles className="h-4 w-4" />,
          // },
        ]}
        onViewChange={(v) => setView(v as ViewType)}
      ></DataToolbar>

      {/* ── Source tabs + Add Fields — always visible in list view ────── */}
      {view === "list" && (
        <div className="flex items-center gap-1 flex-wrap border-b border-border pb-0">
          {sourceTabs.length > 0 && (
            <>
              <button
                onClick={() => setSourceTab("all")}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                  sourceTab === "all"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                All
                <span className="ml-1.5 text-xs opacity-60">
                  ({(dbDeals as any)?.pagination?.total ?? deals.length})
                </span>
              </button>
              {sourceTabs.map((src) => {
                const sourceCounts = (dbDeals as any)?.source_counts || {};
                const count =
                  sourceCounts[src] ??
                  deals.filter(
                    (d) =>
                      (d.source || "").trim().toLowerCase() ===
                      src.toLowerCase(),
                  ).length;
                return (
                  <button
                    key={src}
                    onClick={() => setSourceTab(src)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px capitalize",
                      sourceTab === src
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                    )}
                  >
                    {src}
                    <span className="ml-1.5 text-xs opacity-60">({count})</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Column picker — always visible, pushed to right */}
          <Popover open={colPickerOpen} onOpenChange={setColPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs ml-auto"
              >
                <Columns className="h-3.5 w-3.5" />
                Add Fields
                <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-semibold">
                  {
                    visibleColumns.filter(
                      (k) => k !== "name" && k !== "actions",
                    ).length
                  }
                  /{ALL_COLUMN_KEYS.length - 2}
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
                        key === "name" || key === "actions"
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer",
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

      {/* ── Table toolbar: bulk actions ────────────────── */}
      {view === "list" && (selectedDeals.length > 0 || isAllSelectedGlobally) && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Popover open={assignPickerOpen} onOpenChange={setAssignPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <UserCheck className="h-4 w-4" />
                Assign To ({isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Assign {selectedDeals.length} deal{selectedDeals.length > 1 ? "s" : ""} to
              </p>
              <MemberSearchSelect
                members={allMembers}
                value={bulkAssignUserId}
                onChange={(id) => { setBulkAssignUserId(id); if (id) handleBulkAssign(id); }}
                placeholder="Select a user..."
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={handleBulkExport}>
            <Download className="h-4 w-4 mr-2" />
            Export ({isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDelete}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length})
          </Button>
        </div>
      )}

      {view === "list" && (
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 lg:p-6">
            <EntityTable
              data={filtered}
              columns={columns.filter((c) =>
                visibleColumns.includes(c.key as string),
              )}
              isLoading={isLoading}
              pageSize={pageSize}
              totalCount={
                (dbDeals as any)?.pagination?.total || filtered.length
              }
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              selectedRows={selectedDeals}
              onSelectionChange={(ids) => setSelectedDeals(ids as string[])}
              isAllSelectedGlobally={isAllSelectedGlobally}
              onGlobalSelectionChange={setIsAllSelectedGlobally}
              emptyState={
                <EmptyState
                  title="No deals yet"
                  description="Create or import deals to populate your pipeline."
                  actionLabel="Add deal"
                  onAction={handleCreate}
                  icon={<Sparkles className="h-6 w-6" />}
                />
              }
              highlightedId={highlightedDealId}
              onRowClick={(row) => {
                sessionStorage.setItem("deals_scroll_y", String(window.scrollY));
                sessionStorage.setItem("deals_last_id", String(row.id));
                navigate(`/crm/deals/${row.id}`);
              }}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && view === "kanban" && (
        <DealsKanbanView
          deals={filtered as any}
          selectedStage={stage === "all" ? null : stage}
          onStageSelect={(s) => setStage(s || "all")}
        />
      )}

      {view === "activities" && <DealsActivitiesView />}
      {view === "calendar" && <DealsCalendarView />}

      {view === "automation" && (
        <Suspense
          fallback={
            <div className="text-center py-8 text-muted-foreground">
              Loading automation...
            </div>
          }
        >
          <WorkflowsPage />
        </Suspense>
      )}

      {isError && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              title="Failed to load deals"
              description="Check connection and try again."
              muted
            />
          </CardContent>
        </Card>
      )}

      <EmailComposer
        open={showEmailComposer}
        onOpenChange={setShowEmailComposer}
        mailboxes={mailboxes}
        initialTo={emailComposerTo}
        entityType="deal"
        entityId={emailComposerDealId}
      />
    </div>
  );
}
