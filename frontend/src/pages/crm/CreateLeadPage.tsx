import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { leadsApi } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Save,
  ArrowLeft,
  Building2,
  CalendarDays,
  MessageSquare,
  ChevronDown,
  Sparkles,
  Tag,
  Users,
  Calendar as CalendarIcon,
  Briefcase,
  GripVertical,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { CreatableSelect } from "@/components/crm/CreatableSelect";
import {
  useCustomFieldTemplates,
  useSaveCustomFieldTemplates,
  useCreateLead,
} from "@/hooks/useCrmData";
import { mergeFieldsWithTemplatesSync } from "@/utils/crm/customFieldsRegistry";
import { sanitizePayload } from "@/utils/crm/sanitize";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isValid } from "date-fns";
import {
  CustomFieldsSection,
  DraggableFieldItem,
} from "@/components/crm/CustomFieldsSection";
import { CustomFieldInput } from "@/components/crm/CustomFieldInput";
import {
  FieldDragWrapper,
  DroppableField,
} from "@/components/crm/FieldDragWrapper";
import { DroppableSection } from "@/components/crm/DroppableSection";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";

const leadSchema = z.object({
  title: z.string().min(2, "Lead name is required"),
  stage: z.string().min(1, "Stage is required"),
  status: z.string().optional(),
  customerType: z.string().optional(),
  source: z.string().optional(),
  sourceInfo: z.string().optional(),
  value: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().nullish().or(z.literal("")),
  contactPerson: z.string().optional(),
  designation: z.string().optional(),
  phone: z.string().optional(),
  phoneType: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  emailType: z.string().optional(),
  website: z.string().optional().or(z.literal("")),
  websiteType: z.string().optional(),
  address: z.string().optional(),
  companyName: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companySize: z.string().optional(),
  serviceInterested: z.string().optional(),
  decisionMaker: z.string().optional(),
  interactionNotes: z.string().nullable().optional().or(z.literal("")),
  lastContactedDate: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  createdAt: z.string().optional(),
  assignedTo: z.string().optional().nullable(),
  expectedCloseDate: z.string().optional(),
  pipeline: z.string().optional(),
  responsiblePerson: z.string().optional(),
  externalSourceId: z.string().optional(),
  agentName: z.string().optional(),
  priority: z.string().optional(),
  tags: z.string().optional(),
  campaignName: z.string().optional(),
  campaignId: z.string().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

interface CustomField {
  id: string;
  key: string;
  value: string;
  type?: string;
  sectionId?: string;
  afterFieldId?: string;
}

const stageOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "unqualified", label: "Unqualified" },
];

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "interested", label: "Interested" },
  { value: "converted", label: "Converted" },
  { value: "disqualified", label: "Disqualified" },
];

const customerTypeOptions = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "customer", label: "Customer" },
  { value: "partner", label: "Partner" },
];

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
  // { value: "other", label: "Other" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const companySizeOptions = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

const serviceOptions = [
  { value: "Web Development", label: "Web Development" },
  { value: "Mobile App Development", label: "Mobile App Development" },
  { value: "Digital Marketing", label: "Digital Marketing" },
  { value: "SEO Services", label: "SEO Services" },
  { value: "Consulting", label: "Consulting" },
  { value: "Design Services", label: "Design Services" },
  { value: "E-commerce Solutions", label: "E-commerce Solutions" },
  { value: "Cloud Services", label: "Cloud Services" },
];

const phoneTypeOptions = [
  { value: "work", label: "Work Phone" },
  { value: "mobile", label: "Mobile" },
  { value: "home", label: "Home" },
  // { value: "other", label: "Other" },
];

const emailTypeOptions = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  // { value: "other", label: "Other" },
];

const websiteTypeOptions = [
  { value: "corporate", label: "Corporate" },
  { value: "personal", label: "Personal" },
  { value: "portfolio", label: "Portfolio" },
  // { value: "other", label: "Other" },
];

const currencyOptions = [
  { value: "USD", label: "US Dollar" },
  { value: "EUR", label: "Euro" },
  { value: "GBP", label: "British Pound" },
  { value: "AED", label: "UAE Dirham" },
];

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted p-2.5">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  fieldProps,
  type = "text",
  rightAddon,
  error,
}: {
  label: string;
  placeholder?: string;
  fieldProps: any;
  type?: string;
  rightAddon?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex items-stretch gap-2">
        <Input
          type={type}
          placeholder={placeholder}
          {...fieldProps}
          className={cn(
            "h-11",
            error && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {rightAddon}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function LabeledTextarea({
  label,
  placeholder,
  fieldProps,
  rows = 4,
  error,
}: {
  label: string;
  placeholder?: string;
  fieldProps: any;
  rows?: number;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Textarea
        rows={rows}
        placeholder={placeholder}
        {...fieldProps}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function InlineSelect({
  value,
  onChange,
  placeholder,
  options: initialOptions,
  className,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  className?: string;
  error?: string;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");

  const merged = [...initialOptions];
  for (const o of options) {
    if (!merged.find((x) => x.value === o.value)) merged.push(o);
  }

  const handleAdd = () => {
    if (!newVal.trim()) return;
    const id = newVal
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!merged.find((o) => o.value === id)) {
      setOptions((prev) => [...prev, { value: id, label: newVal.trim() }]);
    }
    onChange(id);
    setNewVal("");
    setAdding(false);
  };

  if (adding) {
    return (
      <div className={cn("flex gap-1 items-center", className)}>
        <Input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder="New option"
          className="h-10 text-xs"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
            if (e.key === "Escape") {
              setAdding(false);
              setNewVal("");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 px-2 text-xs"
          onClick={handleAdd}
        >
          ✓
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-10 px-2 text-xs"
          onClick={() => {
            setAdding(false);
            setNewVal("");
          }}
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 items-center">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            className={cn(
              className || "w-[160px] h-11",
              error && "border-destructive",
            )}
          >
            <SelectValue placeholder={placeholder || "Select"} />
          </SelectTrigger>
          <SelectContent>
            {merged.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setAdding(true)}
          title="Add new option"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive px-1">{error}</p>}
    </div>
  );
}

export default function CreateLeadPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const createLead = useCreateLead();

  const form = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      title: "",
      stage: "new",
      status: "new",
      customerType: "",
      source: "call",
      sourceInfo: "",
      value: "",
      currency: "USD",
      notes: "",
      contactPerson: "",
      designation: "",
      phone: "",
      phoneType: "work",
      email: "",
      emailType: "work",
      website: "",
      websiteType: "corporate",
      address: "",
      companyName: "",
      companyPhone: "",
      companyEmail: "",
      companySize: "",
      serviceInterested: "",
      decisionMaker: "",
      interactionNotes: "",
      lastContactedDate: "",
      nextFollowUpDate: "",
      createdAt: new Date().toISOString().split("T")[0],
      assignedTo: null,
      expectedCloseDate: "",
      pipeline: "default",
      agentName: "",
      priority: "medium",
      tags: "",
      campaignName: "",
    },
  });

  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const selectedPipeline = watch("pipeline") || "default";

  // Filter Assigned To members based on selected pipeline
  const assignedToDepartment =
    selectedPipeline === "marketing"
      ? "Marketing"
      : selectedPipeline === "sales"
        ? "Sales"
        : "Sales,Marketing"; // standard = both

  const { data: members = [] } = useOrganizationProfiles({
    department: assignedToDepartment,
    includeSelf: true,
  });

  // Reset assignedTo when pipeline changes so stale selection is cleared
  const prevPipelineRef = useRef(selectedPipeline);
  useEffect(() => {
    if (prevPipelineRef.current !== selectedPipeline) {
      prevPipelineRef.current = selectedPipeline;
      setValue("assignedTo", null);
    }
  }, [selectedPipeline, setValue]);
  const { data: dbStages = [] } = usePipelineStages();
  const { data: campaignsList = [] } = useQuery({
    queryKey: ["leads-campaigns-list"],
    queryFn: () => leadsApi.getCampaignsList(),
    staleTime: 60000,
  });
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignDropdownOpen, setCampaignDropdownOpen] = useState(false);
  const filteredCampaigns = useMemo(() =>
    campaignsList.filter(c => c.campaign_name.toLowerCase().includes(campaignSearch.toLowerCase())),
    [campaignsList, campaignSearch]
  );

  const customDbStages = dbStages
    .filter((s) => !stageOptions.some((d) => d.value === s.stage_key))
    .map((s) => ({
      value: s.stage_key,
      label: s.stage_label,
    }));

  const allStageOptions = [...stageOptions, ...customDbStages];

  const [contactId, setContactId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Load templates when profile is available
  const { data: templates, isLoading: templatesLoading } =
    useCustomFieldTemplates("lead");
  const saveTemplates = useSaveCustomFieldTemplates();

  useEffect(() => {
    if (templates) {
      setCustomFields(
        templates.map((t) => ({
          id: `template-${Math.random().toString(36).substr(2, 9)}`,
          key: t.key,
          value: "",
          type: t.type,
          sectionId: t.sectionId || "custom-fields",
          afterFieldId: t.afterFieldId,
        })),
      );
    }
  }, [templates]);

  const isSaving = createLead.isPending;

  const onSubmit = (data: LeadForm) => {
    const payload = {
      title: data.title,
      stage: data.stage,
      status: data.status || data.stage,
      customerType: data.customerType || null,
      source: data.source || null,
      sourceInfo: data.sourceInfo || null,
      value: data.value ? Number(data.value) : undefined,
      currency: data.currency || "USD",
      notes: data.notes || null,
      contact_person: data.contactPerson || null,
      designation: data.designation || null,
      phone: data.phone || null,
      phoneType: data.phoneType || null,
      email: data.email || null,
      emailType: data.emailType || null,
      website: data.website || null,
      websiteType: data.websiteType || null,
      address: data.address || null,
      companyName: data.companyName || null,
      companyPhone: data.companyPhone || null,
      companyEmail: data.companyEmail || null,
      companySize: data.companySize || null,
      serviceInterested: data.serviceInterested || null,
      decisionMaker: data.decisionMaker || null,
      interactionNotes: data.interactionNotes || null,
      lastContactedDate:
        data.lastContactedDate && isValid(new Date(data.lastContactedDate))
          ? new Date(data.lastContactedDate).toISOString()
          : null,
      nextFollowUpDate:
        data.nextFollowUpDate && isValid(new Date(data.nextFollowUpDate))
          ? (() => {
              const d = new Date(data.nextFollowUpDate!);
              const off = -d.getTimezoneOffset();
              const sign = off >= 0 ? "+" : "-";
              const pad = (n: number) =>
                String(Math.floor(Math.abs(n))).padStart(2, "0");
              return (
                d.getFullYear() +
                "-" +
                pad(d.getMonth() + 1) +
                "-" +
                pad(d.getDate()) +
                "T" +
                pad(d.getHours()) +
                ":" +
                pad(d.getMinutes()) +
                ":00" +
                sign +
                pad(off / 60) +
                ":" +
                pad(off % 60)
              );
            })()
          : null,
      expectedCloseDate:
        data.expectedCloseDate && isValid(new Date(data.expectedCloseDate))
          ? new Date(data.expectedCloseDate).toISOString()
          : null,
      createdAt:
        data.createdAt && isValid(new Date(data.createdAt))
          ? new Date(data.createdAt).toISOString()
          : new Date().toISOString(),
      lastTouch: new Date().toISOString(),
      assignedTo: data.assignedTo || null,
      pipeline: data.pipeline || "default",
      responsiblePerson: data.responsiblePerson || null,
      externalSourceId: data.externalSourceId || null,
      agentName: data.agentName || null,
      campaignName: data.campaignName || null,
      campaignId: data.campaignId || null,
      priority: data.priority || null,
      tags: data.tags
        ? data.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [],
      customFields: customFields.reduce(
        (acc, field) => {
          if (field.key.trim()) {
            acc[field.key.trim()] = {
              value: field.value,
              type: field.type || "string",
              sectionId: field.sectionId || "custom-fields",
              afterFieldId: field.afterFieldId,
            };
          }
          return acc;
        },
        {} as Record<string, any>,
      ),
    } as Record<string, unknown>;

    createLead.mutate(sanitizePayload(payload), {
      onSuccess: () => {
        // Save these field definitions as templates for future leads
        saveTemplates.mutate({ entityType: "lead", templates: customFields });

        toast.success("Lead created successfully", { description: data.title });
        navigate("/crm/leads");
      },
      onError: (err: any) => {
        toast.error("Failed to create lead", {
          description: err?.message || "Please try again",
        });
      },
    });
  };

  const handleFieldDropToSection = (
    fieldKey: string,
    fieldValue: string,
    sectionId: string,
    updatedFields?: CustomField[],
  ) => {
    setCustomFields((prev) => {
      const updated =
        updatedFields ||
        prev.map((f) => (f.id === fieldKey ? { ...f, sectionId } : f));
      // Persist this change globally to the registry so new leads follow this layout
      saveTemplates.mutate({ entityType: "lead", templates: updated });
      return updated;
    });
  };

  const renderDroppedFields = (
    sectionId: string,
    isTop = false,
    afterFieldId?: string,
  ) => {
    const sectionFields = customFields.filter((f) => {
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
        <SortableContext
          items={sectionFields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          {sectionFields.map((field) => (
            <DraggableFieldItem key={field.id} fieldKey={field.id}>
              <div className="group relative">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {field.key}
                  </Label>
                  <DraggableFieldItem fieldKey={field.id} isHandle>
                    <div className="p-1 cursor-grab active:cursor-grabbing text-primary hover:text-primary-foreground hover:bg-primary rounded transition-all opacity-0 group-hover:opacity-100">
                      <GripVertical className="h-3 w-3" />
                    </div>
                  </DraggableFieldItem>
                </div>
                <CustomFieldInput
                  field={field}
                  editing={true}
                  updateField={(id, updates) => {
                    setCustomFields((prev) =>
                      prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
                    );
                  }}
                  entityType="lead"
                />
              </div>
            </DraggableFieldItem>
          ))}
        </SortableContext>
      </>
    );
  };

  const saveButton = (
    <Button
      onClick={handleSubmit(onSubmit)}
      disabled={isSaving}
      className="gap-2"
    >
      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {isSaving ? "Saving..." : "Save lead"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Create New Lead"
        description="Capture a new lead with custom fields support."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={isSaving}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FieldDragWrapper
          customFields={customFields}
          onCustomFieldsChange={setCustomFields}
          onFieldDropToSection={handleFieldDropToSection}
          editing={true}
        >
          <div className="space-y-6">
            <Card className="border shadow-sm overflow-hidden">
              <DroppableSection id="lead-company-details-top" editing={true}>
                <CardHeader className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Lead & Company Details
                  </CardTitle>
                  <CardDescription>
                    Core contact and company information
                  </CardDescription>
                </CardHeader>
              </DroppableSection>
              <CardContent className="p-6">
                <DroppableSection id="lead-company-details-top" editing={true}>
                  {renderDroppedFields("lead-company-details-top", true)}
                </DroppableSection>

                <DroppableSection id="lead-company-details" editing={true}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <DroppableField
                      id="fixed-lead-company-details-pipeline"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Pipeline
                        </Label>
                        <Select
                          value={watch("pipeline") || "default"}
                          onValueChange={(v) => setValue("pipeline", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select pipeline" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[140px] overflow-y-auto">
                            <SelectItem value="default">
                              Standard Pipeline
                            </SelectItem>
                            <SelectItem value="marketing">
                              Marketing Pipeline
                            </SelectItem>
                            <SelectItem value="sales">
                              Sales Pipeline
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-pipeline",
                    )}

                    <DroppableField
                      id="fixed-lead-company-details-stage"
                      editing={true}
                    >
                      <div className="space-y-1">
                        <Label className="text-sm font-medium text-foreground">
                          Stage
                        </Label>
                        <CreatableSelect
                          label=""
                          value={watch("stage") || ""}
                          onChange={(v) => {
                            setValue("stage", v);
                            if (statusOptions.some(opt => opt.value === v)) {
                              setValue("status", v);
                            }
                          }}
                          options={allStageOptions}
                          placeholder="Select stage"
                        />
                        {errors.stage && (
                          <p className="text-xs text-destructive">
                            {errors.stage.message}
                          </p>
                        )}
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-stage",
                    )}

                    <DroppableField
                      id="fixed-lead-company-details-status"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Status
                        </Label>
                        <Select
                          value={watch("status") || "new"}
                          onValueChange={(v) => setValue("status", v)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.status && (
                          <p className="text-xs text-destructive">
                            {errors.status.message}
                          </p>
                        )}
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-status",
                    )}

                    <DroppableField
                      id="fixed-lead-company-details-assignedTo"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Assigned To
                          {assignedToDepartment && (
                            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {assignedToDepartment} only
                            </span>
                          )}
                        </Label>
                        <MemberSearchSelect
                          members={members}
                          value={watch("assignedTo") || ""}
                          onChange={(v) => setValue("assignedTo", v || null)}
                          placeholder="Select owner..."
                        />
                        {errors.assignedTo && (
                          <p className="text-xs text-destructive">
                            {errors.assignedTo.message}
                          </p>
                        )}
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-assignedTo",
                    )}

                    <DroppableField
                      id="fixed-lead-company-details-customerType"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Customer Type
                        </Label>
                        <CreatableSelect
                          label=""
                          value={watch("customerType") || ""}
                          onChange={(v) => setValue("customerType", v)}
                          options={customerTypeOptions}
                          placeholder="not selected"
                        />
                        {errors.customerType && (
                          <p className="text-xs text-destructive">
                            {errors.customerType.message}
                          </p>
                        )}
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-customerType",
                    )}

                    <DroppableField
                      id="fixed-lead-company-details-title"
                      editing={true}
                    >
                      <div className="">
                        <LabeledInput
                          label="Lead name"
                          placeholder="Lead name"
                          fieldProps={register("title")}
                          error={errors.title?.message}
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-title",
                    )}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2 mt-5">
                    <DroppableField
                      id="fixed-lead-company-details-companyName"
                      editing={true}
                    >
                      <LabeledInput
                        label="Company name"
                        placeholder="Company name"
                        fieldProps={register("companyName")}
                        error={errors.companyName?.message}
                      />
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-companyName",
                    )}

                    {/* <DroppableField
                      id="fixed-lead-company-details-companyPhone"
                      editing={true}
                    >
                      <LabeledInput
                        label="Company phone"
                        placeholder="Company phone"
                        fieldProps={register("companyPhone")}
                        error={errors.companyPhone?.message}
                      />
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-companyPhone",
                    )}

                    <DroppableField
                      id="fixed-lead-company-details-companyEmail"
                      editing={true}
                    >
                      <LabeledInput
                        label="Company email"
                        placeholder="Company email"
                        fieldProps={register("companyEmail")}
                        error={errors.companyEmail?.message}
                      />
                    </DroppableField>
                    {renderDroppedFields(
                      "lead-company-details",
                      false,
                      "fixed-lead-company-details-companyEmail",
                    )} */}

                    
                    <LabeledInput
                      label="Company Phone"
                      placeholder="+1 555 0123"
                      fieldProps={register("companyPhone")}
                      error={errors.companyPhone?.message}
                    />
                    <LabeledInput
                      label="Company Email"
                      placeholder="info@company.com"
                      fieldProps={register("companyEmail")}
                      type="email"
                      error={errors.companyEmail?.message}
                    />
                    <LabeledInput
                      label="Contact Person"
                      placeholder="Contact person name"
                      fieldProps={register("contactPerson")}
                      error={errors.contactPerson?.message}
                    />
                    <LabeledInput
                      label="Designation"
                      placeholder="Job title / designation"
                      fieldProps={register("designation")}
                      error={errors.designation?.message}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Personal Number
                      </Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          placeholder="+1 555 0123"
                          className={cn(
                            "h-11 flex-1 min-w-0",
                            errors.phone && "border-destructive",
                          )}
                          {...register("phone")}
                        />
                        <Select
                          value={watch("phoneType") || "work"}
                          onValueChange={(v) => setValue("phoneType", v)}
                        >
                          <SelectTrigger className="h-11 w-[150px] shrink-0 border-border">
                            <SelectValue placeholder="Work Phone" />
                          </SelectTrigger>
                          <SelectContent>
                            {phoneTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {errors.phone && (
                        <p className="text-xs text-destructive">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Personal E-mail
                      </Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          className={cn(
                            "h-11 flex-1 min-w-0",
                            errors.email && "border-destructive",
                          )}
                          {...register("email")}
                        />
                        <Select
                          value={watch("emailType") || "work"}
                          onValueChange={(v) => setValue("emailType", v)}
                        >
                          <SelectTrigger className="h-11 w-[130px] shrink-0 border-border">
                            <SelectValue placeholder="Work" />
                          </SelectTrigger>
                          <SelectContent>
                            {emailTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {errors.email && (
                        <p className="text-xs text-destructive">
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Website
                      </Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          placeholder="https://example.com"
                          className={cn(
                            "h-11 flex-1 min-w-0",
                            errors.website && "border-destructive",
                          )}
                          {...register("website")}
                        />
                        <Select
                          value={watch("websiteType") || "corporate"}
                          onValueChange={(v) => setValue("websiteType", v)}
                        >
                          <SelectTrigger className="h-11 w-[150px] shrink-0 border-border">
                            <SelectValue placeholder="Corporate" />
                          </SelectTrigger>
                          <SelectContent>
                            {websiteTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {errors.website && (
                        <p className="text-xs text-destructive">
                          {errors.website.message}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-foreground">
                          Address
                        </Label>
                      </div>
                      <Textarea
                        placeholder="Address"
                        {...register("address")}
                        className={cn(
                          "min-h-[84px]",
                          errors.address && "border-destructive",
                        )}
                      />
                      {errors.address && (
                        <p className="text-xs text-destructive">
                          {errors.address.message}
                        </p>
                      )}
                    </div>
                  </div>
                  {renderDroppedFields("lead-company-details")}
                </DroppableSection>
              </CardContent>
            </Card>

            <Card className="border shadow-sm overflow-hidden">
              <DroppableSection id="activity-tracking-top" editing={true}>
                <CardHeader className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Activity & Interaction
                  </CardTitle>
                  <CardDescription>
                    Track touchpoints and follow-up timing
                  </CardDescription>
                </CardHeader>
              </DroppableSection>
              <CardContent className="p-6">
                <DroppableSection id="activity-tracking-top" editing={true}>
                  {renderDroppedFields("activity-tracking-top", true)}
                </DroppableSection>

                <DroppableSection id="activity-tracking" editing={true}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Last Contacted Date
                      </Label>
                      <Input
                        type="date"
                        {...register("lastContactedDate")}
                        className={cn(
                          "h-10",
                          errors.lastContactedDate && "border-destructive",
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        Next Follow-up Date &amp; Time
                      </Label>
                      <Input
                        type="datetime-local"
                        {...register("nextFollowUpDate")}
                        className={cn(
                          "h-10",
                          errors.nextFollowUpDate && "border-destructive",
                        )}
                      />
                      {watch("nextFollowUpDate") &&
                        isValid(new Date(watch("nextFollowUpDate")!)) && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(
                              watch("nextFollowUpDate")!,
                            ).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <LabeledTextarea
                      label="All Interaction Notes With Dates"
                      placeholder="Add interaction notes..."
                      fieldProps={register("interactionNotes")}
                      rows={8}
                    />
                  </div>
                  {renderDroppedFields("activity-tracking")}
                </DroppableSection>
              </CardContent>
            </Card>

            <DroppableSection id="qualification-opportunity" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <SectionTitle
                    icon={Sparkles}
                    title="Qualification & Opportunity"
                    description="Capture the sales potential and buying intent."
                  />
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <DroppableField
                      id="fixed-qualification-opportunity-serviceInterested"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Service Interested
                        </Label>
                        <CreatableSelect
                          label=""
                          value={watch("serviceInterested") || ""}
                          onChange={(v) => setValue("serviceInterested", v)}
                          options={serviceOptions}
                          disabled={false}
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "qualification-opportunity",
                      false,
                      "fixed-qualification-opportunity-serviceInterested",
                    )}

                    <DroppableField
                      id="fixed-qualification-opportunity-companySize"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Company Size
                        </Label>
                        <CreatableSelect
                          label=""
                          value={watch("companySize") || ""}
                          onChange={(v) => setValue("companySize", v)}
                          options={companySizeOptions}
                          placeholder="Company Size"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "qualification-opportunity",
                      false,
                      "fixed-qualification-opportunity-companySize",
                    )}

                    <DroppableField
                      id="fixed-qualification-opportunity-value"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Estimated Opportunity Value
                        </Label>
                        <div className="flex items-stretch gap-2">
                          <Input
                            type="number"
                            placeholder="0"
                            {...register("value")}
                            className={cn("h-10 flex-1 min-w-0")}
                          />
                          <Select
                            value={watch("currency") || "USD"}
                            onValueChange={(v) => setValue("currency", v)}
                          >
                            <SelectTrigger className="h-10 w-[150px] shrink-0 border-border">
                              <SelectValue placeholder="US Dollar" />
                            </SelectTrigger>
                            <SelectContent>
                              {currencyOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "qualification-opportunity",
                      false,
                      "fixed-qualification-opportunity-value",
                    )}

                    <DroppableField
                      id="fixed-qualification-opportunity-decisionMaker"
                      editing={true}
                    >
                      <LabeledInput
                        label="Decision Maker Identified"
                        placeholder="not selected"
                        fieldProps={register("decisionMaker")}
                      />
                    </DroppableField>
                    {renderDroppedFields(
                      "qualification-opportunity",
                      false,
                      "fixed-qualification-opportunity-decisionMaker",
                    )}

                    <DroppableField
                      id="fixed-qualification-opportunity-expectedCloseDate"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Expected Close Date
                        </Label>
                        <Input
                          type="date"
                          {...register("expectedCloseDate")}
                          className="h-10"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "qualification-opportunity",
                      false,
                      "fixed-qualification-opportunity-expectedCloseDate",
                    )}
                    
                    {/* Campaign responsible db field name is responsible_person */}
                    <DroppableField
                      id="fixed-qualification-opportunity-responsiblePerson"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Campaign Responsible  
                          {/* {assignedToDepartment && (
                            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {assignedToDepartment} only
                            </span>
                          )} */}
                        </Label>
                        <MemberSearchSelect
                          members={members}
                          value={watch("responsiblePerson") || ""}
                          onChange={(v) => setValue("responsiblePerson", v || null)}
                          placeholder="Select campaign responsible..."
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "qualification-opportunity",
                      false,
                      "fixed-qualification-opportunity-responsiblePerson",
                    )}
                  </div>
                  {renderDroppedFields("qualification-opportunity")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="source-section" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <SectionTitle
                    icon={Tag}
                    title="Source"
                    description="Record where the lead came from and any source context."
                  />
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <DroppableField
                      id="fixed-source-section-createdAt"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Created on
                        </Label>
                        <Input
                          type="date"
                          {...register("createdAt")}
                          className="h-10"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-createdAt",
                    )}

                    <DroppableField
                      id="fixed-source-section-source"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Source
                        </Label>
                        <CreatableSelect
                          label=""
                          value={watch("source") || ""}
                          onChange={(v) => setValue("source", v)}
                          options={sourceOptions}
                          placeholder="Select source..."
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-source",
                    )}

                    <div className="md:col-span-2 space-y-2">
                      <DroppableField
                        id="fixed-source-section-sourceInfo"
                        editing={true}
                      >
                        <Label className="text-sm font-medium text-foreground">
                          Source Information
                        </Label>
                        <Textarea
                          placeholder="Source Information"
                          {...register("sourceInfo")}
                          className="min-h-[110px]"
                        />
                      </DroppableField>
                      {renderDroppedFields(
                        "source-section",
                        false,
                        "fixed-source-section-sourceInfo",
                      )}
                    </div>

                    <DroppableField
                      id="fixed-source-section-externalSourceId"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          External Source ID
                        </Label>
                        <Input
                          placeholder="e.g. CRM-123"
                          {...register("externalSourceId")}
                          className="h-10"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-externalSourceId",
                    )}

                    <DroppableField
                      id="fixed-source-section-agentName"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Agent Name
                        </Label>
                        <Input
                          placeholder="Agent name"
                          {...register("agentName")}
                          className="h-10"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-agentName",
                    )}

                    <DroppableField
                      id="fixed-source-section-priority"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Priority
                        </Label>
                        <CreatableSelect
                          label=""
                          value={watch("priority") || ""}
                          onChange={(v) => setValue("priority", v)}
                          options={priorityOptions}
                          placeholder="Select priority"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-priority",
                    )}

                    <DroppableField
                      id="fixed-source-section-tags"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Tags
                        </Label>
                        <Input
                          placeholder="e.g. hot-lead, enterprise, Q2"
                          {...register("tags")}
                          className="h-10"
                        />
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-tags",
                    )}

                    <DroppableField
                      id="fixed-source-section-campaignName"
                      editing={true}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Campaign Name
                        </Label>
                        <div className="relative">
                          <Input
                            placeholder="Search campaign..."
                            value={campaignSearch || watch("campaignName") || ""}
                            onFocus={() => { setCampaignDropdownOpen(true); setCampaignSearch(""); }}
                            onChange={(e) => { setCampaignSearch(e.target.value); setCampaignDropdownOpen(true); }}
                            onBlur={() => setTimeout(() => setCampaignDropdownOpen(false), 150)}
                            className="h-10"
                          />
                          {campaignDropdownOpen && filteredCampaigns.length > 0 && (
                            <div className="absolute z-[200] bottom-full mb-1 left-0 min-w-[320px] w-full bg-popover border border-border rounded-md shadow-xl max-h-64 overflow-y-auto">
                              {filteredCampaigns.map((c) => (
                                <button
                                  key={c.campaign_id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate"
                                  onMouseDown={() => {
                                    setValue("campaignName", c.campaign_name);
                                    setValue("campaignId", c.campaign_id);
                                    setCampaignSearch("");
                                    setCampaignDropdownOpen(false);
                                  }}
                                >
                                  {c.campaign_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </DroppableField>
                    {renderDroppedFields(
                      "source-section",
                      false,
                      "fixed-source-section-campaignName",
                    )}

                    <div className="md:col-span-2 space-y-2">
                      <DroppableField
                        id="fixed-source-section-notes"
                        editing={true}
                      >
                        <Label className="text-sm font-medium text-foreground">
                          Additional Notes
                        </Label>
                        <Textarea
                          placeholder="Add any extra context"
                          {...register("notes")}
                          className="min-h-[110px]"
                        />
                      </DroppableField>
                      {renderDroppedFields(
                        "source-section",
                        false,
                        "fixed-source-section-notes",
                      )}
                    </div>
                  </div>
                  {renderDroppedFields("source-section")}
                </CardContent>
              </Card>
            </DroppableSection>

            <CustomFieldsSection
              fields={customFields}
              onChange={setCustomFields}
              editing={true}
            />
          </div>
        </FieldDragWrapper>

        <div className="space-y-6">
          <Card className="border shadow-sm sticky top-6 rounded-xl">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                Lead Preview
              </CardTitle>
              <CardDescription>
                You are now adding a lead. Complete the fields and save when
                ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  Add a new activity
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Plan your next action on the lead to keep follow-up details in
                  one place.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <span className="text-sm font-medium">
                    {watch("stage") || "new"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Source</span>
                  <span className="text-sm font-medium">
                    {watch("source") || "call"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Opportunity
                  </span>
                  <span className="text-sm font-medium">
                    {watch("currency") || "USD"} {watch("value") || "0"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {saveButton}
                <Button
                  variant="outline"
                  onClick={() => navigate("/crm/leads")}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
