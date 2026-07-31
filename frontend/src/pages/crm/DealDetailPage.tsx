import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, Save, ArrowRightLeft, Phone, Mail, Globe,
  MapPin, Building2, User, Calendar, DollarSign, Tag, FileText,
  Activity, MessageSquare, Clock, Star, MoreHorizontal, Copy, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Zap, ChevronDown, ChevronRight,
  TrendingUp, Users, Target, Award, Briefcase, Calendar as CalendarIcon,
  History, Plus, Edit3, Send, PhoneCall, Video, MessageCircle,
  BarChart3, PieChart, TrendingDown, Eye, Filter, Search, Settings, X,
  Check, Printer, Download, Share2, EyeOff
} from "lucide-react";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InteractionPanel } from "@/components/crm/InteractionPanel";
import { CreatableSelect } from "@/components/crm/CreatableSelect";
import { EntityFilesSection } from "@/components/crm/EntityFilesSection";
import { CustomFieldsSection, DraggableFieldItem } from "@/components/crm/CustomFieldsSection";
import { CustomFieldInput } from "@/components/crm/CustomFieldInput";
import { FieldDragWrapper, DroppableField } from "@/components/crm/FieldDragWrapper";
import { DroppableSection } from "@/components/crm/DroppableSection";
import { GripVertical } from "lucide-react";
import { useMemo } from 'react';
import { EntitySearchSelect } from "@/components/crm/EntitySearchSelect";
import { InlineContactDialog } from "@/components/crm/InlineContactDialog";
import { InlineCompanyDialog } from "@/components/crm/InlineCompanyDialog";
import { DealBlueprintsSection } from "@/components/crm/deals/DealBlueprintsSection";
import { DealTasksSection } from "@/components/crm/deals/DealTasksSection";
import { ChangeResponsibleDialog } from "@/components/crm/deals/ChangeResponsibleDialog";
import { DeleteConfirmationDialog } from "@/components/crm/DeleteConfirmationDialog";
import { useDeal } from "@/hooks/useCrmInteractions";
import { useUpdateDeal, useDeleteDeal, useLinkDealContact, useUnlinkDealContact, useLinkSigningParty, useUnlinkSigningParty, useConvertDealToCustomer } from "@/hooks/useCrmMutations";
import { useCreateActivity } from "@/hooks/useCrmInteractions";
import { useContacts, useCompanies, useSigningParties, useDealStats, useUpdateDealStage } from "@/hooks/useCrmData";
import { usePipelineStages, useCreatePipelineStage, useDealPipelineStages, useCreateDealPipelineStage, useDeleteDealPipelineStage, useUpdateDealPipelineStage } from "@/hooks/usePipelineStages";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi, api } from '@/lib/api';
import { EmailComposer } from "@/components/mail/EmailComposer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { useCustomFieldTemplates, useSaveCustomFieldTemplates } from "@/hooks/useCrmData";
import { mergeFieldsWithTemplatesSync } from "@/utils/crm/customFieldsRegistry";
import { sanitizePayload } from "@/utils/crm/sanitize";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";

type CustomField = { id: string; key: string; label?: string; value: string; type?: string; sectionId?: string; afterFieldId?: string };

const sourceOptions = [
  { value: "Instantly", label: "Instantly" },
  { value: "call", label: "Call" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "event", label: "Event" },
  { value: "advertisement", label: "Advertisement" },
  { value: "partner", label: "Partner" },
];

const fallbackStages = [
  {
    id: "drawings_received",
    label: "Drawings Received",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: FileText
  },
  {
    id: "awaiting_proposal",
    label: "Awaiting Proposal",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: Clock
  },
  {
    id: "proposal_sent",
    label: "Proposal Sent",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: Send
  },
  {
    id: "proposal_approved",
    label: "Proposal Approved",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: CheckCircle
  },
  {
    id: "invoice_sent",
    label: "Invoice Sent",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: DollarSign
  },
  {
    id: "project_approved",
    label: "Project Approved",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: Award
  },
  {
    id: "in_progress",
    label: "In Progress",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: Activity
  },
  {
    id: "awaiting_payment",
    label: "Awaiting Payment",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: DollarSign
  },
  {
    id: "project_delivered",
    label: "Delivered",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: CheckCircle
  },
  {
    id: "close_deal",
    label: "Closed",
    color: "bg-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: Award
  },
];

const defaultProjectTypes = [
  { value: "cost_estimation", label: "Cost Estimation" },
  { value: "fixed_price", label: "Fixed Price" },
  { value: "hourly", label: "Hourly" },
  { value: "quantity_takeoff", label: "Quantity Takeoff" },
  { value: "project_management", label: "Project Management" },
  { value: "design", label: "Design" },
];

const clientTypeOptions = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "partner", label: "Partner" },
];

const paymentMethodOptions = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const qaStatusOptions = [
  { value: "not_selected", label: "Not selected" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

const currencyOptions = [
  { value: "USD", label: "US Dollar" },
  { value: "EUR", label: "Euro" },
  { value: "GBP", label: "British Pound" },
  { value: "AED", label: "UAE Dirham" },
];

const yesNoOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
// Professional Field component for enterprise-level forms
interface FieldProps {
  entityId?: string;
  label: string;
  value: string | undefined | null;
  onChange: (value: string) => void;
  editing: boolean;
  icon?: React.ReactNode;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  required?: boolean;
  onEmailClick?: (email: string) => void;
}

function Field({ label, value, onChange, editing, icon, multiline, type = "text", placeholder, required, entityId, onEmailClick }: FieldProps) {
  const navigate = useNavigate();
  if (!editing && !value) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-1">
          {icon}
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center">
          <span className="text-muted-foreground italic">Not specified</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground flex items-center gap-1">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {editing ? (
        multiline ? (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none border-border"
          />
        ) : (
          <Input
            type={type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 border-border"
          />
        )
      ) : (
        <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center">
          {type === "tel" ? (
            <ClickToCall
              phoneNumber={value || ""}
              entityType="deal"
              entityId={entityId || ""}
              className="font-medium break-words w-full text-left"
            />
          ) : type === "email" ? (
            <span
              className="text-primary hover:underline font-medium break-words w-full cursor-pointer"
              onClick={() => onEmailClick?.(value || "")}
            >
              {value}
            </span>
          ) : type === "date" && value && isValid(new Date(value)) ? (
            <span className="text-foreground font-medium break-words w-full">
              {format(new Date(value), "MMM d, yyyy")}
            </span>
          ) : type === "datetime-local" && value && isValid(new Date(value)) ? (
            <span className="text-foreground font-medium break-words w-full">
              {new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          ) : (
            <span className="text-foreground font-medium break-words w-full">{value}</span>
          )}
        </div>
      )}
    </div>
  );
}

function displayJsonValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

const getStatusColor = (status: string) => {
  const stage = fallbackStages.find(s => s.id === status);
  return stage ? `${stage.bgColor} ${stage.textColor} ${stage.borderColor}` : 'bg-muted/40 text-foreground ';
};

const getStatusIcon = (status: string) => {
  const stage = fallbackStages.find(s => s.id === status);
  const IconComponent = stage?.icon || Clock;
  return <IconComponent className="h-4 w-4" />;
};
export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userRole, profile } = useAuth();
  const { data: deal, isLoading } = useDeal(id!);
  const updateDeal = useUpdateDeal();
  const updateDealStage = useUpdateDealStage();
  const deleteDeal = useDeleteDeal();
  const { dialNumber } = useSoftphone();
  const linkContact = useLinkDealContact();
  const unlinkContact = useUnlinkDealContact();
  const linkSigningParty = useLinkSigningParty();
  const unlinkSigningParty = useUnlinkSigningParty();
  const convertDealToCustomer = useConvertDealToCustomer();
  const createActivity = useCreateActivity();
  const { data: contacts } = useContacts();
  const { data: companies } = useCompanies();
  const { data: signingParties } = useSigningParties();
  const { data: templates, isLoading: templatesLoading } = useCustomFieldTemplates('deal');
  const saveTemplates = useSaveCustomFieldTemplates();

  const { data: dealStats } = useDealStats();

  // Email composer state
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerTo, setEmailComposerTo] = useState<string>("");
  const { data: mailboxes = [], isLoading: mailboxesLoading } = useQuery({
    queryKey: ["connected-mailboxes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await api.get<any[]>('/email/mailboxes');
      return data || [];
    },
    enabled: !!user,
  });

  const openEmailComposer = (email?: string) => {
    if (mailboxesLoading) return;
    if (mailboxes.length === 0) {
      toast.error("No email account connected", {
        description: "Connect your Gmail or Outlook account first to send emails.",
        action: { label: "Connect Now", onClick: () => navigate("/collaboration/mail") },
        duration: 6000,
      });
      return;
    }
    setEmailComposerTo(email || linkedContact?.email || deal?.email || "");
    setShowEmailComposer(true);
  };

  const [showStageManager, setShowStageManager] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  const { data: dbStages = [] } = useDealPipelineStages(showStageManager);
  const createStage = useCreateDealPipelineStage();
  const deleteStage = useDeleteDealPipelineStage();
  const updateStage = useUpdateDealPipelineStage();

  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [showDeleteDealDialog, setShowDeleteDealDialog] = useState(false);

  const [editing, setEditing] = useState(() => window.location.pathname.endsWith('/edit'));
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [responsibleDialogOpen, setResponsibleDialogOpen] = useState(false);
  const [selectedLinkedContactId, setSelectedLinkedContactId] = useState<string | null>(null);
  const [selectedSigningPartyId, setSelectedSigningPartyId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState("activity");
  const [interactionTab, setInteractionTab] = useState("activity");
  const activitySectionRef = useRef<HTMLDivElement>(null);

  const handleScrollToActivity = (tab: string = "activity", innerTab: string = "activity") => {
    setSidebarTab(tab);
    setInteractionTab(innerTab);
    setTimeout(() => {
      activitySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!deal) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(deal, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `deal_${deal.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Deal data exported successfully");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "activity" || tabParam === "activities") {
      setSidebarTab("activity");
      setInteractionTab("activity");
      setTimeout(() => {
        activitySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500);
    }
  }, [id, deal]);

  // Check if user can delete deals
  const canDelete = userRole?.role === 'super_admin' || userRole?.role === 'admin' || userRole?.role === 'manager' || deal?.user_id === user?.id;

  // Fetch responsible person profile
  const { data: responsiblePerson } = useQuery({
    queryKey: ['profile', form.assigned_to],
    queryFn: async () => {
      const data = await usersApi.getById(form.assigned_to as string).catch(() => null);
      return data;
    },
    enabled: !!form.assigned_to,
  });

  // Fetch all team members for assignment
  const selectedPipeline = (form.pipeline as string) || deal?.pipeline || "default";
  
  const departmentFilter = selectedPipeline === "marketing"
    ? "Marketing"
    : selectedPipeline === "sales"
      ? "Sales"
      : "Sales,Marketing"; // standard = both

  const { data: members = [] } = useOrganizationProfiles({
    department: departmentFilter,
    includeSelf: true
  });

  // Combine DB stages with visual fallback data (colors/icons)
  const pipelineStages = useMemo(() => {
    const stages = dbStages.map(s => {
      const fallback = fallbackStages.find(f => f.id === s.stage_key);
      return {
        id: s.stage_key,
        label: s.stage_label,
        description: fallback?.label || "Custom stage",
        color: s.color || fallback?.color || "bg-muted-foreground",
        bgColor: fallback?.bgColor || "bg-muted/40",
        textColor: fallback?.textColor || "text-foreground",
        borderColor: fallback?.borderColor || "",
        icon: fallback?.icon || Clock,
        dbId: s.id,
        is_active: s.is_active,
        probability: s.probability
      };
    });

    // Ensure current deal stage is included if it's missing from the pipeline
    const currentStageId = (form.stage || deal?.stage) as string;
    if (currentStageId && !stages.find(s => s.id === currentStageId)) {
      const fallback = fallbackStages.find(f => f.id === currentStageId);
      stages.push({
        id: currentStageId,
        label: fallback?.label || currentStageId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: "Legacy or custom stage",
        color: fallback?.color || "bg-orange-500",
        bgColor: fallback?.bgColor || "bg-orange-50",
        textColor: fallback?.textColor || "text-orange-700",
        borderColor: fallback?.borderColor || "border-orange-200",
        icon: fallback?.icon || AlertCircle,
        dbId: "virtual",
        is_active: true,
        probability: 0
      });
    }

    return stages;
  }, [dbStages, deal?.stage, form.stage]);

  const activePipelineStages = useMemo(() => pipelineStages.filter(s => s.is_active), [pipelineStages]);
  const stageOptions = useMemo(() => activePipelineStages.map(s => ({ value: s.id, label: s.label })), [activePipelineStages]);


  useEffect(() => {
    if (deal && templates && !editing && !updateDeal.isPending && !updateDealStage.isPending) {
      const dbCustomFields = (deal.custom_fields as any) || {};
      const fields = Object.entries(dbCustomFields).map(([k, v]: [string, any]) => {
        if (v && typeof v === 'object' && 'value' in v) {
          const rawSectionId = (v as any).sectionId;
          let sectionId = rawSectionId;
          // Map lead section IDs to deal section IDs
          if (rawSectionId === 'lead-company-details') sectionId = 'company-info';
          if (rawSectionId === 'activity-tracking') sectionId = 'deal-info';
          if (rawSectionId === 'qualification-opportunity') sectionId = 'deal-info';
          if (rawSectionId === 'source-section') sectionId = 'more-section';

          return {
            id: `field-${k.replace(/\s+/g, '-').toLowerCase()}`,
            key: k,
            value: String((v as any).value),
            type: (v as any).type || 'string',
            sectionId: sectionId || 'custom-fields',
            afterFieldId: (v as any).afterFieldId || undefined
          };
        }
        return { id: `field-${k.replace(/\s+/g, '-').toLowerCase()}`, key: k, value: String(v), type: 'string', sectionId: 'custom-fields' };
      });
      // Merge with templates to show empty "standard" custom fields
      const mergedFields = mergeFieldsWithTemplatesSync(fields, templates);
      setCustomFields(mergedFields);
      setForm({
        ...deal,
        expected_close_date: deal.expected_close_date && isValid(new Date(deal.expected_close_date)) ? format(new Date(deal.expected_close_date), "yyyy-MM-dd") : "",
        next_follow_up_date: deal.next_follow_up_date && isValid(new Date(deal.next_follow_up_date)) ? format(new Date(deal.next_follow_up_date), "yyyy-MM-dd'T'HH:mm") : "",
        createdAt: deal.created_at && isValid(new Date(deal.created_at)) ? format(new Date(deal.created_at), "yyyy-MM-dd'T'HH:mm") : "",
      });
    }
  }, [deal, templates, editing, updateDeal.isPending, updateDealStage.isPending]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted/30 to-background flex items-center justify-center">
        <div className="text-center  p-8 rounded-2xl shadow-xl border ">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Loading Deal Details</h3>
          <p className="text-muted-foreground">Please wait while we fetch the information...</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted/30 to-background flex items-center justify-center">
        <div className="text-center  p-8 rounded-2xl shadow-xl border  max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Deal Not Found</h2>
          <p className="text-muted-foreground mb-6">The deal you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => navigate('/crm/deals')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Deals
          </Button>
        </div>
      </div>
    );
  }
  const handleSave = () => {
    const changes: Record<string, unknown> = {};
    Object.entries(form).forEach(([key, val]) => {
      if (val !== (deal as Record<string, unknown>)[key]) changes[key] = val;
    });

    // Explicitly check assigned_to since it might be stored differently
    if ((form.assigned_to || null) !== (deal.assigned_to || null)) {
      changes.assigned_to = form.assigned_to || null;
    }

    const customFieldsObj = customFields.reduce((acc, field) => {
      if (field.key.trim()) acc[field.key.trim()] = {
        value: field.value,
        type: field.type || 'string',
        sectionId: field.sectionId,
        afterFieldId: field.afterFieldId
      };
      return acc;
    }, {} as Record<string, { value: string; type: string; sectionId?: string; afterFieldId?: string }>);

    // Check if custom fields changed compared to deal record
    const dealCustomFields = deal.custom_fields || {};
    const customFieldsChanged = JSON.stringify(customFieldsObj) !== JSON.stringify(dealCustomFields);

    if (Object.keys(changes).length === 0 && !customFieldsChanged) {
      saveTemplates.mutate({ entityType: 'deal', templates: customFields });
      setEditing(false);
      return;
    }

    const formattedChanges: Record<string, unknown> = { ...changes };
    if (formattedChanges.expected_close_date) formattedChanges.expected_close_date = new Date(formattedChanges.expected_close_date as string).toISOString();
    if (formattedChanges.next_follow_up_date) {
      const d = new Date(formattedChanges.next_follow_up_date as string);
      const off = -d.getTimezoneOffset();
      const sign = off >= 0 ? '+' : '-';
      const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
      formattedChanges.next_follow_up_date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00' + sign + pad(off / 60) + ':' + pad(off % 60);
    }

    updateDeal.mutate(sanitizePayload({
      id: deal.id,
      ...formattedChanges,
      customFields: customFieldsObj
    }), {
      onSuccess: async (updatedDeal) => {
        saveTemplates.mutate({ entityType: 'deal', templates: customFields });
        
        // Force refetch and wait for it to ensure we have joined data
        await queryClient.refetchQueries({ queryKey: ['deals', id] });
        
        setEditing(false);
        createActivity.mutate({
          entityType: 'deal',
          entityId: deal.id,
          activityType: 'update',
          title: 'Deal information updated',
          description: `Updated fields: ${Object.keys(changes).join(', ')}`,
        });
      }
    });
  };

  const handleConvertToCustomer = () => {
    convertDealToCustomer.mutate(deal.id, {
      onSuccess: (data: any) => {
        navigate(`/crm/customers/${data.id}`);
      }
    });
  };

  const handleDelete = () => {
    deleteDeal.mutate(deal.id, {
      onSuccess: () => {
        navigate('/crm/deals');
      }
    });
  };

  const handleStageChange = (newStage: string) => {
    if (newStage === (form.stage || deal?.stage)) return;
    setForm(prev => ({ ...prev, stage: newStage }));
    if (!editing) {
      updateDealStage.mutate({ id: deal.id, stage: newStage }, {
        onSuccess: (updatedDeal) => {
          // Sync form with actual server state
          if (updatedDeal) {
            setForm(prev => ({ ...prev, stage: updatedDeal.stage, status: updatedDeal.status }));
          }

          const stageName = pipelineStages.find(s => s.id === newStage)?.label || newStage;
          createActivity.mutate({
            entityType: 'deal',
            entityId: deal.id,
            activityType: 'stage_change',
            title: `Stage changed to ${stageName}`,
            description: `Deal pipeline stage updated to ${stageName}`,
          });
        },
        onError: () => {
          // Revert on error
          setForm(prev => ({ ...prev, stage: deal.stage }));
        }
      });
    }
  };

  const handleResponsibleChange = (userId: string) => {
    set("assigned_to", userId);
    if (!editing) {
      updateDeal.mutate({ id: deal.id, assigned_to: userId }, {
        onSuccess: () => {
          createActivity.mutate({
            entityType: 'deal',
            entityId: deal.id,
            activityType: 'update',
            title: 'Changed responsible person',
          });
        }
      });
    }
  };

  const set = (key: string, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFieldDropToSection = (fieldKey: string, fieldValue: string, sectionId: string, updatedFields?: CustomField[]) => {
    setCustomFields(prev => {
      const updated = updatedFields || prev.map(f => f.id === fieldKey ? { ...f, sectionId } : f);
      // Persist this change globally to the registry so new deals follow this layout
      saveTemplates.mutate({ entityType: 'deal', templates: updated });
      return updated;
    });
  };

  const renderDroppedFields = (sectionId: string, isTop = false, afterFieldId?: string) => {
    const sectionFields = customFields.filter(f => {
      if (f.sectionId !== sectionId) return false;

      if (afterFieldId) {
        return f.afterFieldId === afterFieldId;
      }

      if (isTop) {
        return f.afterFieldId === `${sectionId}-top`;
      }

      return !f.afterFieldId;
    });

    if (sectionFields.length === 0) return null;

    return (
      <>
        {sectionFields.map((field) => (
          <DraggableFieldItem key={field.id} fieldKey={field.id}>
            <div className="group relative space-y-2">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium text-foreground">{field.label || field.key}</Label>
                <div className="p-1 cursor-grab active:cursor-grabbing text-primary hover:text-primary-foreground hover:bg-primary rounded transition-all opacity-0 group-hover:opacity-100">
                  <GripVertical className="h-3 w-3" />
                </div>
              </div>
              <CustomFieldInput
                field={field}
                editing={editing}
                updateField={(id, updates) => {
                  setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
                }}
                entityId={id}
              />
            </div>
          </DraggableFieldItem>
        ))}
      </>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const contactOptions = (contacts || []).map(c => ({
    id: c.id,
    label: `${c.first_name} ${c.last_name || ''}`.trim(),
    sublabel: c.email || c.phone || undefined,
  }));

  const signingPartyOptions = (signingParties || []).map((c: any) => ({
    id: c.id,
    label: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || 'Signing Party',
    sublabel: c.email || c.phone || undefined,
  }));

  const companyOptions = (companies || []).map(c => ({
    id: c.id,
    label: c.name,
    sublabel: c.email || c.phone || undefined,
  }));

  // Get linked contact/company details for display in view mode
  const linkedContact = contacts?.find(c => c.id === form.contact_id);
  const linkedCompany = companies?.find(c => c.id === form.company_id);

  const blueprints = Array.isArray((form as any).project_blueprints) ? (form as any).project_blueprints : [];

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="min-h-screen bg-background">
      {/* Enterprise Header with Breadcrumb Navigation */}
      <div className="bg-card border-b shadow-sm sticky top-0 z-40">
        <div className="px-4 md:px-6 py-4">
          {/* Professional Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-6">
            <span className="hover:text-foreground cursor-pointer">CRM</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <span className="hover:text-foreground cursor-pointer" onClick={() => navigate('/crm/deals')}>Deals</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <span className="text-foreground font-medium truncate">{deal.title}</span>
          </nav>

          {/* Header Content */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/crm/deals")}
                className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted self-start md:self-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Deals
              </Button>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative">
                  <Avatar className="h-14 w-14 ring-4 ring-background shadow-lg">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${deal.title}`} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                      {deal.title?.split(' ').map(n => n[0]).join('').toUpperCase() || 'D'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-background rounded-full"></div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground break-words max-w-[200px] sm:max-w-none">{deal.title}</h1>
                    <Badge className={cn("gap-1 px-3 py-1 font-medium whitespace-nowrap", pipelineStages.find(s => s.id === (form.stage || deal.stage))?.bgColor || "bg-muted/40", pipelineStages.find(s => s.id === (form.stage || deal.stage))?.textColor || "text-foreground", pipelineStages.find(s => s.id === (form.stage || deal.stage))?.borderColor)}>
                      {(() => {
                        const stage = pipelineStages.find(s => s.id === (form.stage || deal.stage));
                        const Icon = stage?.icon || Clock;
                        return <Icon className="h-4 w-4" />;
                      })()}
                      {pipelineStages.find(s => s.id === (form.stage || deal.stage))?.label || (form.stage || deal.stage)}
                    </Badge>


                    {!editing && (
                      <div className="flex items-center gap-2 ml-2">
                        {(linkedContact?.phone || deal.phone) && (
                          <ClickToCall
                            phoneNumber={linkedContact?.phone || deal.phone}
                            entityType="deal"
                            entityId={deal.id}
                            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm transition-all hover:scale-105 active:scale-95"
                          />
                        )}
                        {(linkedContact?.email || deal.email) && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs shadow-sm transition-all hover:scale-105 active:scale-95"
                            onClick={() => openEmailComposer(linkedContact?.email || deal.email)}
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-white">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">{linkedCompany?.name || 'No Company'}</span>
                    </div>
                    {deal.value && (
                      <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        <span>${Number(deal.value).toLocaleString()}</span>
                      </div>
                    )}
                    {deal.created_at && (
                      <div className="flex items-center gap-1 text-white whitespace-nowrap">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Created {format(new Date(form.createdAt as string || deal.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Professional Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setEditing(false); setForm({ ...deal }); }}
                    className="gap-2  text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={updateDeal.isPending}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                  >
                    <Save className="h-4 w-4" />
                    {updateDeal.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="gap-2 "
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Deal
                  </Button>

                  {deal.converted_to_customer_id ? (
                    <Button
                      onClick={() => navigate(`/crm/customers/${deal.converted_to_customer_id}`)}
                      className="gap-2 bg-primary hover:bg-primary/80 text-white shadow-lg"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      View Converted Customer
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="gap-2 bg-primary hover:bg-primary/80 text-white shadow-lg">
                          <ArrowRightLeft className="h-4 w-4" />
                          Convert to Customer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-emerald-600" />
                            Convert Deal to Customer
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            This will create a new customer from this deal's information and move it to your customers section. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleConvertToCustomer}
                            disabled={convertDealToCustomer.isPending}
                            className="bg-primary hover:bg-primary/80"
                          >
                            {convertDealToCustomer.isPending ? "Converting..." : "Convert to Customer"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-xl shadow-xl  z-[100] pointer-events-auto  max-h-[450px] overflow-y-auto">
                      <DropdownMenuLabel className="px-3 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Communication</DropdownMenuLabel>
                      {linkedContact?.email && (
                        <DropdownMenuItem onSelect={() => copyToClipboard(linkedContact.email, 'Email')} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground">Copy Contact Email</p>
                            <p className="text-xs text-muted-foreground truncate">{linkedContact.email}</p>
                          </div>
                        </DropdownMenuItem>
                      )}
                      {linkedContact?.phone && (
                        <>
                          <DropdownMenuItem onSelect={() => dialNumber(linkedContact.phone!, { entityType: 'deal', entityId: deal.id })} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
                              <PhoneCall className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground">Call Contact</p>
                              <p className="text-xs text-muted-foreground">{linkedContact.phone}</p>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copyToClipboard(linkedContact.phone!, 'Phone')} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                            <div className="p-2 bg-muted/40 rounded-md">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground">Copy Contact Phone</p>
                            </div>
                          </DropdownMenuItem>
                        </>
                      )}

                      <DropdownMenuSeparator className="my-2 bg-muted" />

                      <DropdownMenuLabel className="px-3 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Jump</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => handleScrollToActivity("activity")} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                          <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">View Activity Timeline</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleScrollToActivity("activity", "booking")} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Schedule Meeting</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                          <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Send Message</p>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-2 bg-muted" />

                      <DropdownMenuLabel className="px-3 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Reports & Data</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={handlePrint} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                          <Printer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Print Deal Details</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExport} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
                          <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Export as JSON</p>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-2 bg-muted" />

                      {canDelete && (
                        <DropdownMenuItem onSelect={() => setForm(prev => ({ ...prev, showDeleteDialog: true }))} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-red-50 group transition-colors">
                          <div className="p-2 bg-red-50 rounded-md group-hover:bg-red-100 transition-colors">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </div>
                          <p className="font-semibold text-sm text-red-600">Delete Deal</p>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="my-2 bg-muted" />
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-orange-50 group transition-colors"
                        onSelect={() => {
                          updateDeal.mutate({ id: deal.id, status: 'unqualified', stage: 'unqualified' }, {
                            onSuccess: () => {
                              toast.success("Deal marked as unqualified");
                              createActivity.mutate({
                                entityType: 'deal',
                                entityId: deal.id,
                                activityType: 'status_change',
                                title: 'Marked as Unqualified',
                                description: 'Deal has been moved to the unqualified section',
                              });
                            }
                          });
                        }}
                      >
                        <div className="p-2 bg-orange-50 rounded-md group-hover:bg-orange-100 transition-colors">
                          <XCircle className="h-4 w-4 text-orange-600" />
                        </div>
                        <p className="font-semibold text-sm text-orange-600">Mark as Unqualified</p>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Metrics Dashboard */}
      <div className="px-4 md:px-6 py-6 border-b">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-xl p-6 border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Total Deals</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{dealStats?.overview?.total_deals ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <span>{dealStats?.overview?.open_deals ?? 0} open</span>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-emerald-100 dark:border-emerald-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Deal Value</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">
                ${deal.value ? Number(deal.value).toLocaleString() : '0'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Close: {deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d') : 'Not set'}</span>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-purple-100 dark:border-purple-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Days in Pipeline</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">
                {deal.created_at ? Math.floor((new Date().getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
              </span>
              <span className="text-lg text-muted-foreground">days</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Since created</span>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-orange-100 dark:border-orange-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Won Deals</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{dealStats?.overview?.won_deals ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>${dealStats?.overview?.won_value ? Number(dealStats.overview.won_value).toLocaleString() : '0'} won</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Pipeline Progress */}
      <div className="px-4 md:px-6 py-6  border-b ">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Deal Pipeline Progress</h3>
            <p className="text-sm text-muted-foreground">Track your deal through each stage of the sales process</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowStageManager(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            Manage Stages
          </Button>
        </div>
        <div className="relative overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="flex items-center justify-between mb-4 min-w-[1000px] lg:min-w-0 px-4">
            {pipelineStages.map((stage, index) => {
              const isActive = stage.id === (form.stage || deal.stage);
              const isPassed = pipelineStages.findIndex(s => s.id === (form.stage || deal.stage)) > index;
              const isClickable = !editing;

              return (
                <div key={stage.id} className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 cursor-pointer",
                      isActive
                        ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                        : isPassed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "   hover:",
                      isClickable && "hover:scale-105"
                    )}
                    onClick={() => isClickable && handleStageChange(stage.id)}
                  >
                    {isPassed ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <stage.icon className="h-6 w-6" />
                    )}
                    {isActive && (
                      <div className="absolute -inset-1 bg-blue-600 rounded-full animate-pulse opacity-25"></div>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <div className={cn(
                      "text-sm font-medium mb-1",
                      isActive ? "text-blue-600" : isPassed ? "text-emerald-600" : "text-muted-foreground"
                    )}>
                      {stage.label}
                    </div>
                  </div>
                  {index < pipelineStages.length - 1 && (
                    <div className={cn(
                      "absolute top-6 left-1/2 w-full h-0.5 -translate-y-1/2 transition-colors duration-300",
                      isPassed ? "bg-emerald-500" : "bg-muted"
                    )} style={{ left: `${((index + 1) / pipelineStages.length) * 100}%`, width: `${100 / pipelineStages.length}%` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Professional Form Sections */}
          <div className="lg:col-span-7 space-y-6">
            <FieldDragWrapper
              customFields={customFields}
              onCustomFieldsChange={setCustomFields}
              onFieldDropToSection={handleFieldDropToSection}
              editing={editing}
            >
              <div className="space-y-6">
                {/* Deal Information Card */}
                <Card className="shadow-lg border-0 backdrop-blur-sm overflow-hidden">
                  <DroppableSection id="deal-info-top" editing={editing}>
                    <CardHeader className="pb-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <CardTitle className="text-lg text-foreground">Deal Information</CardTitle>
                          <CardDescription className="text-muted-foreground">Core details about this deal</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="px-6 pb-2">
                      {renderDroppedFields("deal-info-top", true)}
                    </div>
                  </DroppableSection>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <DroppableSection id="deal-info" editing={editing} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                      <div className="md:col-span-2">
                        <Field
                          label="Deal Title"
                          value={form.title as string}
                          onChange={(val) => set("title", val)}
                          editing={editing}
                          icon={<Briefcase className="h-4 w-4" />}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Pipeline
                        </Label>
                        <Select value={(form.pipeline as string) || "default"} onValueChange={(v) => set("pipeline", v)} disabled={!editing}>
                          <SelectTrigger className="h-10 border-border">
                            <SelectValue placeholder="Select pipeline" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Standard Pipeline</SelectItem>
                            <SelectItem value="marketing">Marketing Pipeline</SelectItem>
                            <SelectItem value="sales">Sales Pipeline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Stage</Label>
                        <Select value={(form.stage as string) || ""} onValueChange={(v) => set("stage", v)} disabled={!editing}>
                          <SelectTrigger className="h-10 border-border">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelineStages.map(stage => (
                              <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Field
                        label="Deal Value"
                        value={form.value as string}
                        onChange={(val) => set("value", val)}
                        editing={editing}
                        icon={<DollarSign className="h-4 w-4" />}
                        type="number"
                        placeholder="Enter deal value"
                      />
                      <Field
                        label="Currency"
                        value={form.currency as string}
                        onChange={(val) => set("currency", val)}
                        editing={editing}
                        icon={<DollarSign className="h-4 w-4" />}
                        placeholder="USD, EUR, etc."
                      />
                      <Field
                        label="Expected Close Date"
                        value={form.expected_close_date ? (editing ? form.expected_close_date as string : format(new Date(form.expected_close_date as string), 'MMM d, yyyy')) : ""}
                        onChange={(val) => set("expected_close_date", val)}
                        editing={editing}
                        icon={<Calendar className="h-4 w-4" />}
                        type="date"
                      />
                      <Field
                        label="Next Follow-up Date & Time"
                        value={form.next_follow_up_date ? (editing ? form.next_follow_up_date as string : new Date(form.next_follow_up_date as string).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })) : ""}
                        onChange={(val) => set("next_follow_up_date", val)}
                        editing={editing}
                        icon={<Clock className="h-4 w-4" />}
                        type="datetime-local"
                      />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Assigned To
                        </Label>
                        {editing ? (
                          <MemberSearchSelect
                            members={members}
                            value={form.assigned_to as string || ""}
                            onChange={(v) => set("assigned_to", v || undefined)}
                            placeholder="Select owner..."
                          />
                        ) : (
                          <div className="h-10 px-3 py-2 border rounded-lg bg-muted/40 flex items-center gap-2">
                            {form.assigned_to ? (
                              <>
                                <Avatar className="h-6 w-6">
                                      <AvatarImage src={(members.find(m => m.id === form.assigned_to) as any)?.avatar_url || undefined} />
                                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                        {members.find(m => m.id === form.assigned_to)?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                      </AvatarFallback>
                                    </Avatar>
                                <span className="text-foreground font-medium">
                                  {members.find((m: any) => m.id === form.assigned_to)?.full_name || 'Assigned User'}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </div>
                        )}
                      </div>
                      <DroppableField id="fixed-deal-details-external_source_id" editing={editing}>
                        <Field
                          label="External Source ID"
                          value={form.external_source_id as string}
                          onChange={(val) => set("external_source_id", val)}
                          editing={editing}
                          icon={<ExternalLink className="h-4 w-4" />}
                          placeholder="e.g., EXT-12345"
                        />
                      </DroppableField>
                      {renderDroppedFields("deal-details", false, "fixed-deal-details-external_source_id")}
                      <DroppableField id="fixed-deal-details-probability" editing={editing}>
                        <Field
                          label="Probability (%)"
                          value={form.probability?.toString()}
                          onChange={(val) => set("probability", parseInt(val) || 0)}
                          editing={editing}
                          icon={<Target className="h-4 w-4" />}
                          type="number"
                        />
                      </DroppableField>
                      {renderDroppedFields("deal-details", false, "fixed-deal-details-probability")}
                      <DroppableField id="fixed-deal-details-created_date" editing={editing}>
                        <Field
                          label="Created Date"
                          value={editing ? (form.createdAt as string) : (form.createdAt && isValid(new Date(form.createdAt as string)) ? format(new Date(form.createdAt as string), 'MMM d, yyyy HH:mm') : 'Not specified')}
                          onChange={(v) => set("createdAt", v)}
                          editing={editing}
                          type="datetime-local"
                          icon={<CalendarIcon className="h-4 w-4" />}
                          entityId={id}
                        />
                      </DroppableField>
                      {renderDroppedFields("deal-details", false, "fixed-deal-details-created_date")}
                      <div className="md:col-span-2">
                        <DroppableField id="fixed-deal-details-description" editing={editing}>
                          <Field
                            label="Description"
                            value={form.description as string}
                            onChange={(val) => set("description", val)}
                            editing={editing}
                            icon={<FileText className="h-4 w-4" />}
                            multiline
                            placeholder="Describe the deal details..."
                          />
                        </DroppableField>
                        {renderDroppedFields("deal-details", false, "fixed-deal-details-description")}
                      </div>
                    </DroppableSection>

                    <DroppableSection id="deal-info" editing={editing} className="md:col-span-2 mt-4">
                      {renderDroppedFields("deal-info")}
                    </DroppableSection>
                  </CardContent>
                </Card>

                {/* Contact Information Card */}
                <Card className="shadow-lg border-0 backdrop-blur-sm overflow-hidden">
                  <DroppableSection id="contact-info-top" editing={editing}>
                    <CardHeader className="pb-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <CardTitle className="text-lg text-foreground">Contact Information</CardTitle>
                          <CardDescription className="text-muted-foreground">Details of the primary contact</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="px-6 pb-2">
                      {renderDroppedFields("contact-info-top", true)}
                    </div>
                  </DroppableSection>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <DroppableSection id="contact-info" editing={editing} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                      <div className="md:col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Linked Contact Profile
                          </label>
                          {editing ? (
                            <Select value={form.contact_id as string} onValueChange={(val) => set("contact_id", val)}>
                              <SelectTrigger className=" ">
                                <SelectValue placeholder="Select contact..." />
                              </SelectTrigger>
                              <SelectContent>
                                {contactOptions.map(option => (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div>
                                      <div className="font-medium">{option.label}</div>
                                      {option.sublabel && <div className="text-xs text-muted-foreground">{option.sublabel}</div>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                              <span className="text-foreground font-medium">
                                {linkedContact ? `${linkedContact.first_name} ${linkedContact.last_name || ''}`.trim() : 'No contact selected'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Field
                        label="Contact Name"
                        value={form.contact_name as string}
                        onChange={(val) => set("contact_name", val)}
                        editing={editing}
                        icon={<User className="h-4 w-4" />}
                        placeholder="Full name"
                      />
                      <Field
                        label="Designation"
                        value={form.designation as string}
                        onChange={(val) => set("designation", val)}
                        editing={editing}
                        icon={<Briefcase className="h-4 w-4" />}
                        placeholder="Job title"
                      />
                      <Field
                        label="Email"
                        value={form.email as string}
                        onChange={(val) => set("email", val)}
                        editing={editing}
                        icon={<Mail className="h-4 w-4" />}
                        type="email"
                        placeholder="Email address"
                      />
                      <Field
                        label="Phone"
                        value={form.phone as string}
                        onChange={(val) => set("phone", val)}
                        editing={editing}
                        icon={<Phone className="h-4 w-4" />}
                        placeholder="Phone number"
                      />
                      <div className="md:col-span-2">
                        <Field
                          label="Address"
                          value={form.address as string}
                          onChange={(val) => set("address", val)}
                          editing={editing}
                          icon={<MapPin className="h-4 w-4" />}
                          placeholder="Full address"
                        />
                      </div>
                    </DroppableSection>

                    <DroppableSection id="contact-info" editing={editing} className="md:col-span-2 mt-4">
                      {renderDroppedFields("contact-info")}
                    </DroppableSection>
                  </CardContent>
                </Card>

                {/* Company Information Card */}
                <Card className="shadow-lg border-0 backdrop-blur-sm overflow-hidden">
                  <DroppableSection id="company-info-top" editing={editing}>
                    <CardHeader className="pb-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <CardTitle className="text-lg text-foreground">Company Information</CardTitle>
                          <CardDescription className="text-muted-foreground">Organizational details</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="px-6 pb-2">
                      {renderDroppedFields("company-info-top", true)}
                    </div>
                  </DroppableSection>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <DroppableSection id="company-info" editing={editing} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                      <div className="md:col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Linked Company Profile
                          </label>
                          {editing ? (
                            <Select value={form.company_id as string} onValueChange={(val) => set("company_id", val)}>
                              <SelectTrigger className=" ">
                                <SelectValue placeholder="Select company..." />
                              </SelectTrigger>
                              <SelectContent>
                                {companyOptions.map(option => (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div>
                                      <div className="font-medium">{option.label}</div>
                                      {option.sublabel && <div className="text-xs text-muted-foreground">{option.sublabel}</div>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                              <span className="text-foreground font-medium">{linkedCompany?.name || 'No company selected'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Field
                        label="Company Name"
                        value={form.company_name as string}
                        onChange={(val) => set("company_name", val)}
                        editing={editing}
                        icon={<Building2 className="h-4 w-4" />}
                        placeholder="Legal company name"
                      />
                      <Field
                        label="Website"
                        value={form.website as string}
                        onChange={(val) => set("website", val)}
                        editing={editing}
                        icon={<Globe className="h-4 w-4" />}
                        placeholder="https://example.com"
                      />
                      <Field
                        label="Company Phone"
                        value={form.company_phone as string}
                        onChange={(val) => set("company_phone", val)}
                        editing={editing}
                        icon={<Phone className="h-4 w-4" />}
                        placeholder="Main office phone"
                      />
                      <Field
                        label="Company Email"
                        value={form.company_email as string}
                        onChange={(val) => set("company_email", val)}
                        editing={editing}
                        icon={<Mail className="h-4 w-4" />}
                        placeholder="General info email"
                      />
                      <Field
                        label="Company Size"
                        value={form.company_size as string}
                        onChange={(val) => set("company_size", val)}
                        editing={editing}
                        icon={<Users className="h-4 w-4" />}
                        placeholder="e.g., 50-100 employees"
                      />
                    </DroppableSection>

                    <DroppableSection id="company-info" editing={editing} className="md:col-span-2 mt-4">
                      {renderDroppedFields("company-info")}
                    </DroppableSection>
                  </CardContent>
                </Card>

                <DroppableSection id="about-deal" editing={editing}>
                  <Card className="border   shadow-sm rounded-xl">
                    <CardHeader className="border-b  bg-muted/30">
                      <CardTitle className="text-base text-foreground">About Deal</CardTitle>
                      <CardDescription className="text-muted-foreground">Client and project basics</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Client Type</Label>
                        {editing ? (
                          <Select value={(form.client_type as string) || ""} onValueChange={(val) => set("client_type", val)}>
                            <SelectTrigger className=" ">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientTypeOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <span className="text-foreground font-medium">{(form.client_type as string) || 'Not selected'}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Project Type</Label>
                        {editing ? (
                          <Select value={(form.project_type as string) || ""} onValueChange={(val) => set("project_type", val)}>
                            <SelectTrigger className=" ">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {defaultProjectTypes.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <span className="text-foreground font-medium">{(form.project_type as string) || 'Not selected'}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Available to everyone</Label>
                        {editing ? (
                          <Select value={form.available_to_everyone === true ? "yes" : form.available_to_everyone === false ? "no" : "yes"} onValueChange={(val) => set("available_to_everyone", val === "yes")}>
                            <SelectTrigger className=" ">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {yesNoOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <span className="text-foreground font-medium">
                              {form.available_to_everyone === true ? "Yes" : form.available_to_everyone === false ? "No" : "Not selected"}
                            </span>
                          </div>
                        )}
                      </div>
                      {renderDroppedFields("about-deal")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                <DroppableSection id="more-section" editing={editing}>
                  <Card className="border   shadow-sm rounded-xl">
                    <CardHeader className="border-b  bg-muted/30">
                      <CardTitle className="text-base text-foreground">More</CardTitle>
                      <CardDescription className="text-muted-foreground">Source, deadline, and feedback</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Source</Label>
                        {editing ? (
                          <Select value={(form.source as string) || ""} onValueChange={(val) => set("source", val)}>
                            <SelectTrigger className=" ">
                              <SelectValue placeholder="Not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <span className="text-foreground font-medium">{(form.source as string) || 'Not selected'}</span>
                          </div>
                        )}
                      </div>
                      <Field
                        label="Source Information"
                        value={displayJsonValue(form.source_info)}
                        onChange={(val) => set("source_info", val)}
                        editing={editing}
                        multiline
                        placeholder="Source Information"
                      />
                      <Field
                        label="Quotation Received"
                        value={form.quotation_received as string}
                        onChange={(val) => set("quotation_received", val)}
                        editing={editing}
                        placeholder="Quotation Received"
                      />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">QA Status</Label>
                        {editing ? (
                          <Select value={(form.qa_status as string) || ""} onValueChange={(val) => set("qa_status", val)}>
                            <SelectTrigger className=" ">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {qaStatusOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <span className="text-foreground font-medium">{(form.qa_status as string) || 'Not selected'}</span>
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Field
                          label="Feedback"
                          value={form.feedback as string}
                          onChange={(val) => set("feedback", val)}
                          editing={editing}
                          multiline
                          placeholder="Feedback"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Field
                          label="Project Feedback Details"
                          value={form.feedback_details as string}
                          onChange={(val) => set("feedback_details", val)}
                          editing={editing}
                          multiline
                          placeholder="Project feedback details"
                        />
                      </div>
                      {renderDroppedFields("more-section")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                <DroppableSection id="budget-payment" editing={editing}>
                  <Card className="border   shadow-sm rounded-xl">
                    <CardHeader className="border-b  bg-muted/30">
                      <CardTitle className="text-base text-foreground">Budget & Payment</CardTitle>
                      <CardDescription className="text-muted-foreground">Proposal, invoice, and hourly pricing</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Payment Method</Label>
                        {editing ? (
                          <Select value={(form.payment_method as string) || ""} onValueChange={(val) => set("payment_method", val)}>
                            <SelectTrigger className=" ">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethodOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <span className="text-foreground font-medium">{(form.payment_method as string) || 'Not selected'}</span>
                          </div>
                        )}
                      </div>
                      <Field
                        label="Invoice Link"
                        value={form.invoice_link as string}
                        onChange={(val) => set("invoice_link", val)}
                        editing={editing}
                        placeholder="Invoice link"
                      />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Hourly Rate</Label>
                        <div className="flex items-stretch gap-2">
                          <Input
                            type="number"
                            value={form.hourly_rate !== undefined && form.hourly_rate !== null ? String(form.hourly_rate) : ""}
                            onChange={(e) => set("hourly_rate", e.target.value ? Number(e.target.value) : null)}
                            disabled={!editing}
                            className=" "
                          />
                          <Select value={(form.hourly_rate_currency as string) || "USD"} onValueChange={(val) => set("hourly_rate_currency", val)} disabled={!editing}>
                            <SelectTrigger className="w-[120px]  "><SelectValue /></SelectTrigger>
                            <SelectContent>{currencyOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Field
                        label="Hours Of Work"
                        value={form.hours_of_work as string}
                        onChange={(val) => set("hours_of_work", val)}
                        editing={editing}
                        placeholder="Hours of work"
                      />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Proposal Amount</Label>
                        <div className="flex items-stretch gap-2">
                          <Input
                            type="number"
                            value={form.proposal_amount !== undefined && form.proposal_amount !== null ? String(form.proposal_amount) : ""}
                            onChange={(e) => set("proposal_amount", e.target.value ? Number(e.target.value) : null)}
                            disabled={!editing}
                            className=" "
                          />
                          <Select value={(form.proposal_currency as string) || "USD"} onValueChange={(val) => set("proposal_currency", val)} disabled={!editing}>
                            <SelectTrigger className="w-[120px]  "><SelectValue /></SelectTrigger>
                            <SelectContent>{currencyOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Invoice Amount</Label>
                        <div className="flex items-stretch gap-2">
                          <Input
                            type="number"
                            value={form.invoice_amount !== undefined && form.invoice_amount !== null ? String(form.invoice_amount) : ""}
                            onChange={(e) => set("invoice_amount", e.target.value ? Number(e.target.value) : null)}
                            disabled={!editing}
                            className=" "
                          />
                          <Select value={(form.invoice_currency as string) || "USD"} onValueChange={(val) => set("invoice_currency", val)} disabled={!editing}>
                            <SelectTrigger className="w-[120px]  "><SelectValue /></SelectTrigger>
                            <SelectContent>{currencyOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      {renderDroppedFields("budget-payment")}
                    </CardContent>
                  </Card>
                </DroppableSection>
                <DroppableSection id="project-details" editing={editing}>
                  <Card className="border   shadow-sm rounded-xl">
                    <CardHeader className="border-b  bg-muted/40/80">
                      <CardTitle className="text-base text-foreground">Project Details</CardTitle>
                      <CardDescription className="text-muted-foreground">Scope and blueprint files</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                      <div className="md:col-span-2">
                        <Field
                          label="Scope"
                          value={form.scope as string}
                          onChange={(val) => set("scope", val)}
                          editing={editing}
                          multiline
                          placeholder="Scope"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Field
                          label="Project Deadline"
                          value={form.deadline ? (editing ? form.deadline as string : format(new Date(form.deadline as string), 'MMM d, yyyy')) : ""}
                          onChange={(val) => set("deadline", val)}
                          editing={editing}
                          icon={<Calendar className="h-4 w-4" />}
                          type="date"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Field
                          label="Project Blueprints"
                          value={displayJsonValue(form.project_blueprints)}
                          onChange={(val) => set("project_blueprints", val)}
                          editing={editing}
                          multiline
                          placeholder="Drop your files here"
                        />
                      </div>
                      {renderDroppedFields("project-details")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                <DroppableSection id="marketing-qualification" editing={editing}>
                  <Card className="shadow-lg border-0  backdrop-blur-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Target className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg text-foreground">Lead Qualification & Sales Info</CardTitle>
                          <CardDescription className="text-muted-foreground">Marketing and qualification metadata</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          Priority
                        </label>
                        {editing ? (
                          <Select value={form.priority as string} onValueChange={(val) => set("priority", val)}>
                            <SelectTrigger className="">
                              <SelectValue placeholder="Select priority..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 px-3 py-2 border  rounded-lg bg-muted/40 flex items-center">
                            <Badge className={cn(
                              form.priority === 'urgent' ? 'bg-red-100 text-red-700 border-red-200' :
                                form.priority === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                  form.priority === 'medium' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-muted text-foreground '
                            )}>
                              {(form.priority as string || 'Medium').toUpperCase()}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Field
                        label="Lead Source"
                        value={form.source as string}
                        onChange={(val) => set("source", val)}
                        editing={editing}
                        icon={<Tag className="h-4 w-4" />}
                        placeholder="e.g., Website, Referral"
                      />
                      <Field
                        label="Sales Agent"
                        value={form.agent_name as string}
                        onChange={(val) => set("agent_name", val)}
                        editing={editing}
                        icon={<User className="h-4 w-4" />}
                        placeholder="Attributed agent"
                      />
                      <Field
                        label="Decision Maker"
                        value={form.decision_maker as string}
                        onChange={(val) => set("decision_maker", val)}
                        editing={editing}
                        icon={<Award className="h-4 w-4" />}
                        placeholder="Primary decision maker"
                      />
                      <Field
                        label="Service Interested"
                        value={form.service_interested as string}
                        onChange={(val) => set("service_interested", val)}
                        editing={editing}
                        icon={<Zap className="h-4 w-4" />}
                        placeholder="Project/Service type"
                      />
                      <Field
                        label="Source Info"
                        value={form.source_info as string}
                        onChange={(val) => set("source_info", val)}
                        editing={editing}
                        icon={<Search className="h-4 w-4" />}
                        placeholder="Campaign details, UTM params, etc."
                      />
                      {renderDroppedFields("marketing-qualification")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                <CustomFieldsSection
                  fields={customFields}
                  onChange={setCustomFields}
                  editing={editing}
                  entityType="deal"
                  entityId={id}
                  className={!editing ? "" : "animate-in fade-in slide-in-from-bottom-2 duration-300"}
                />
              </div>
            </FieldDragWrapper>
          </div>

          {/* Right Sidebar - Activity & Actions */}
          <div className="lg:col-span-5 space-y-6 sticky top-24">
            {/* Quick Actions Card */}
            <Card className="shadow-lg border-0 bg-background/60 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Deal Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 gap-3">
                {(linkedContact?.phone || deal.phone) && (
                  <ClickToCall
                    phoneNumber={linkedContact?.phone || deal.phone}
                    entityType="deal"
                    entityId={deal.id}
                    className="w-full"
                    customTrigger={
                      <Button variant="outline" className="w-full justify-start gap-2 h-10 border hover:bg-muted/50">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">Call</span>
                      </Button>
                    }
                  />
                )}
                {(linkedContact?.email || deal.email) && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                    onClick={() => openEmailComposer(linkedContact?.email || deal.email)}
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">Email</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                  onClick={() => handleScrollToActivity("activity", "booking")}
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Schedule</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                  onClick={() => navigate(`/crm/deals/${deal.id}`)}
                >
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Convert</span>
                </Button>
              </CardContent>
            </Card>

            {/* Activity & Documents Section - Moved to Sidebar */}
            <Card ref={activitySectionRef} className="shadow-lg border-0 overflow-hidden flex flex-col h-[750px]">
              <CardHeader className="pb-0 border-b bg-muted/20">
                <div className="flex items-center justify-between pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Activity & Files
                  </CardTitle>
                </div>
                <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full h-10 bg-muted/40 p-1">
                    <TabsTrigger value="activity" className="text-xs font-semibold">Timeline</TabsTrigger>
                    <TabsTrigger value="files" className="text-xs font-semibold">Files</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <Tabs value={sidebarTab} className="h-full flex flex-col">
                  <TabsContent
                    value="activity"
                    forceMount={true}
                    className={cn(
                      "m-0 p-0 flex-1 overflow-y-auto",
                      sidebarTab !== "activity" && "hidden"
                    )}
                  >
                    <div className="p-4">
                      <InteractionPanel
                        entityType="deal"
                        entityId={deal.id}
                        activeTab={interactionTab}
                        onTabChange={setInteractionTab}
                        defaultPhone={deal.phone || deal.linkedContact?.phone}
                        onComposeEmail={() => openEmailComposer(linkedContact?.email || deal.email)}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent
                    value="files"
                    forceMount={true}
                    className={cn(
                      "m-0 p-0 flex-1 overflow-y-auto",
                      sidebarTab !== "files" && "hidden"
                    )}
                  >
                    <div className="p-4">
                      <EntityFilesSection entityType="deal" entityId={deal.id} />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Original Interaction Notes Section (Secondary here) */}
            <Card className="shadow-lg border-0 bg-background/60 backdrop-blur-sm opacity-80 hover:opacity-100 transition-opacity">
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold">Legacy Notes Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Last Update</p>
                    <p className="text-xs font-medium">{form.last_touch ? format(new Date(form.last_touch as string), 'MMM d, yyyy') : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Follow Up</p>
                    <p className="text-xs font-medium text-primary">{form.next_follow_up_date ? new Date(form.next_follow_up_date as string).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}</p>
                  </div>
                </div>
                {form.interaction_notes && (
                  <div className="pt-2 border-t">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Key Summary</p>
                    <p className="text-xs text-muted-foreground line-clamp-3">{form.interaction_notes as string}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>


      </div>

      {/* Stage Manager Dialog */}
      <Dialog open={showStageManager} onOpenChange={setShowStageManager}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Manage Pipeline Stages
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2 max-h-[60vh] overflow-y-auto px-1">
              {pipelineStages.map(s => (
                <div key={s.dbId} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                  s.is_active ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-dashed opacity-60"
                )}>
                  {editingStageId === s.dbId ? (
                    <>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editingStageName}
                          onChange={e => setEditingStageName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingStageName.trim()) {
                              updateStage.mutate({ id: s.dbId, stageName: editingStageName.trim() }, {
                                onSuccess: () => setEditingStageId(null)
                              });
                            }
                            if (e.key === 'Escape') setEditingStageId(null);
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Prob %</Label>
                          <Input
                            type="number"
                            value={s.probability}
                            onChange={e => updateStage.mutate({ id: s.dbId, probability: Number(e.target.value) })}
                            className="h-6 w-16 text-[10px]"
                          />
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"
                        disabled={!editingStageName.trim() || updateStage.isPending}
                        onClick={() => updateStage.mutate({ id: s.dbId, stageName: editingStageName.trim() }, { onSuccess: () => setEditingStageId(null) })}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        onClick={() => setEditingStageId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{s.label}</span>
                          {!s.is_active && <Badge variant="outline" className="text-[10px] py-0 h-4">Hidden</Badge>}
                          {fallbackStages.some(f => f.id === s.id) && <Badge variant="secondary" className="text-[10px] py-0 h-4">Default</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Probability: {s.probability || 0}%</p>
                      </div>

                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditingStageId(s.dbId); setEditingStageName(s.label); }}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>

                      <Button size="icon" variant="ghost" className={cn("h-7 w-7", s.is_active ? "text-muted-foreground hover:text-orange-500" : "text-orange-500 hover:text-orange-700")}
                        onClick={() => updateStage.mutate({ id: s.dbId, is_active: !s.is_active })}
                        title={s.is_active ? "Hide Stage" : "Show Stage"}>
                        {s.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>

                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setStageToDelete(s.dbId)}
                        disabled={deleteStage.isPending}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="New stage name..."
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newStageName.trim()) {
                    createStage.mutate({ stageName: newStageName.trim() }, { onSuccess: () => setNewStageName("") });
                  }
                }}
                className="h-9"
              />
              <Button
                size="sm"
                className="gap-1.5 shrink-0"
                disabled={!newStageName.trim() || createStage.isPending}
                onClick={() => createStage.mutate({ stageName: newStageName.trim() }, { onSuccess: () => setNewStageName("") })}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageManager(false)}>Close</Button>
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
        description="Are you sure you want to delete this stage? This will permanently remove it from the pipeline configuration."
      />

      <DeleteConfirmationDialog
        open={showDeleteDealDialog}
        onOpenChange={setShowDeleteDealDialog}
        onConfirm={() => handleDelete()}
        isLoading={deleteDeal.isPending}
        title="Delete Deal?"
        description={`Are you sure you want to delete "${deal.title}"? This action cannot be undone.`}
      />

      <EmailComposer
        open={showEmailComposer}
        onOpenChange={setShowEmailComposer}
        mailboxes={mailboxes}
        initialTo={emailComposerTo}
        entityType="deal"
        entityId={id}
      />
    </div>
  );
}
