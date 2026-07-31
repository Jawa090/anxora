import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";

const SizeStyle = Quill.import("attributors/style/size") as any;
SizeStyle.whitelist = ["small", "large", "huge"];
Quill.register(SizeStyle, true);

const AlignStyle = Quill.import("attributors/style/align") as any;
Quill.register(AlignStyle, true);

import {
  Plus,
  Mail,
  MessageSquare,
  Share2,
  Search,
  MoreHorizontal,
  Trash2,
  Edit,
  Send,
  TestTube,
  Users,
  Layout,
  Eye,
  Sparkles,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEmailCampaigns,
  useCreateEmailCampaign,
  useUpdateEmailCampaign,
  useDeleteEmailCampaign,
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  useCampaignRecipients,
  MarketingEmailCampaign,
  EmailTemplate,
  CampaignAudience,
  useMarketingLists,
} from "@/hooks/useMarketingData";

import { marketingApi } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusBadgeColors: Record<
  string,
  "outline" | "secondary" | "default" | "destructive"
> = {
  Draft: "outline",
  Scheduled: "secondary",
  Running: "default",
  Paused: "secondary",
  Completed: "secondary",
  Cancelled: "destructive",
};

function stripHtml(html: string) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

function IframePreview({ html }: { html: string }) {
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            color: #0f172a;
            background-color: #ffffff;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }
          .canva-embed-container {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
          }
        </style>
      </head>
      <body>
        ${html || "<p style='color: #64748b; font-size: 14px;'>No HTML preview available.</p>"}
      </body>
    </html>
  `;
  return (
    <iframe
      srcDoc={srcDoc}
      title="Email Preview"
      className="w-full min-h-[400px] border rounded-lg bg-white shadow-sm"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
    />
  );
}

import { useMarketingRealtime } from "@/hooks/useRealtime";

export default function CampaignsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  useMarketingRealtime();
  const activeTab = location.pathname.includes("/templates") ? "templates" : "campaigns";

  const handleTabChange = (value: string) => {
    if (value === "templates") {
      navigate("/marketing/templates");
    } else {
      navigate("/marketing/campaigns");
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Email Campaigns Hook (New Specs Table)
  const { data: campaigns = [], isLoading: loadingCampaigns } =
    useEmailCampaigns({
      status: statusFilter === "all" ? undefined : statusFilter,
    });
  const createEmailCampaign = useCreateEmailCampaign();
  const updateEmailCampaign = useUpdateEmailCampaign();
  const deleteEmailCampaign = useDeleteEmailCampaign();

  // Email Templates Hook
  const { data: templates = [], isLoading: loadingTemplates } =
    useEmailTemplates();
  const { data: lists = [] } = useMarketingLists();
  const createEmailTemplate = useCreateEmailTemplate();
  const deleteEmailTemplate = useDeleteEmailTemplate();

  // Modals state
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<MarketingEmailCampaign | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [showRecipientsCampaign, setShowRecipientsCampaign] = useState<any>(null);
  const [recipientsSearch, setRecipientsSearch] = useState("");

  // Campaign Form State
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    subject: "",
    preview_text: "",
    from_name: "",
    from_email: "",
    reply_to: "",
    status: "Draft" as const,
    campaign_type: "email",
    template_id: "",
    scheduled_at: "",
  });

  // Audience Builder state
  const [audiences, setAudiences] = useState<CampaignAudience[]>([]);
  const [audType, setAudType] =
    useState<any>("Contact");
  const [audValue, setAudValue] = useState("");

  // Template Form State
  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "Newsletter",
    subject: "",
    html_content: "",
    plain_text: "",
  });

  const [rawHtmlMode, setRawHtmlMode] = useState(false);

  const quillModules = {
    toolbar: [
      [
        { header: [1, 2, 3, false] },
        { size: ["small", false, "large", "huge"] },
      ],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const filteredCampaigns = campaigns.filter((c: MarketingEmailCampaign) => {
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.subject && c.subject.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const handleAddAudience = () => {
    if (!audValue) return;
    const newAud: CampaignAudience = { audience_type: audType === "List" ? "Segment" : audType };
    if (audType === "Manual Email") newAud.email = audValue;
    else if (audType === "Contact") newAud.contact_id = audValue;
    else if (audType === "Lead") newAud.lead_id = audValue;
    else if (audType === "Customer") newAud.customer_id = audValue;
    else if (audType === "Segment" || audType === "List") newAud.segment_id = audValue;

    setAudiences([...audiences, newAud]);
    setAudValue("");
  };

  const handleRemoveAudience = (index: number) => {
    setAudiences(audiences.filter((_, i) => i !== index));
  };

  const handleSaveCampaign = () => {
    if (!campaignForm.name.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    let finalAudiences = [...audiences];
    if (finalAudiences.length === 0 && audValue) {
      const newAud: CampaignAudience = { audience_type: audType === "List" ? "Segment" : audType };
      if (audType === "Manual Email") newAud.email = audValue;
      else if (audType === "Contact") newAud.contact_id = audValue;
      else if (audType === "Lead") newAud.lead_id = audValue;
      else if (audType === "Customer") newAud.customer_id = audValue;
      else if (audType === "Segment" || audType === "List") newAud.segment_id = audValue;
      finalAudiences.push(newAud);
    }

    if (editingCampaign) {
      updateEmailCampaign.mutate(
        {
          id: editingCampaign.id,
          ...campaignForm,
          template_id: campaignForm.template_id || null,
          audiences: finalAudiences,
        },
        {
          onSuccess: () => {
            setShowCreateCampaign(false);
            setEditingCampaign(null);
            resetCampaignForm();
          },
        },
      );
    } else {
      createEmailCampaign.mutate(
        {
          ...campaignForm,
          template_id: campaignForm.template_id || null,
          audiences: finalAudiences,
        },
        {
          onSuccess: () => {
            setShowCreateCampaign(false);
            resetCampaignForm();
          },
        },
      );
    }
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      name: "",
      description: "",
      subject: "",
      preview_text: "",
      from_name: "",
      from_email: "",
      reply_to: "",
      status: "Draft",
      campaign_type: "email",
      template_id: "",
      scheduled_at: "",
    });
    setAudiences([]);
  };

  const handleEditCampaign = (c: MarketingEmailCampaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name || "",
      description: c.description || "",
      subject: c.subject || "",
      preview_text: c.preview_text || "",
      from_name: c.from_name || "",
      from_email: c.from_email || "",
      reply_to: c.reply_to || "",
      status: (c.status as any) || "Draft",

      campaign_type: c.campaign_type || "email",
      template_id: c.template_id || "",
      scheduled_at: c.scheduled_at
        ? (() => {
            const d = new Date(c.scheduled_at);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${y}-${m}-${day}T${h}:${min}`;
          })()
        : "",
    });
    setAudiences(c.audiences || []);
    setShowCreateCampaign(true);
  };

  const updateEmailTemplate = useUpdateEmailTemplate();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [showPreviewTemplate, setShowPreviewTemplate] =
    useState<EmailTemplate | null>(null);

  const handleEditTemplate = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl);
    setTemplateForm({
      name: tpl.name || "",
      category: tpl.category || "Newsletter",
      subject: tpl.subject || "",
      html_content: tpl.html_content || "",
      plain_text: tpl.plain_text || "",
    });
    setRawHtmlMode(
      !!tpl.html_content &&
        (tpl.html_content.includes("<iframe") ||
          tpl.html_content.includes("<div") ||
          tpl.html_content.includes("<table") ||
          tpl.html_content.includes("<a")),
    );
    setShowCreateTemplate(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      category: "Newsletter",
      subject: "",
      html_content: "",
      plain_text: "",
    });
    setRawHtmlMode(false);
    setShowCreateTemplate(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (editingTemplate) {
      updateEmailTemplate.mutate(
        { id: editingTemplate.id, ...templateForm },
        {
          onSuccess: () => {
            setShowCreateTemplate(false);
            setEditingTemplate(null);
            setTemplateForm({
              name: "",
              category: "Newsletter",
              subject: "",
              html_content: "",
              plain_text: "",
            });
            setRawHtmlMode(false);
          },
        },
      );
    } else {
      createEmailTemplate.mutate(templateForm, {
        onSuccess: () => {
          setShowCreateTemplate(false);
          setTemplateForm({
            name: "",
            category: "Newsletter",
            subject: "",
            html_content: "",
            plain_text: "",
          });
          setRawHtmlMode(false);
        },
      });
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    setSending(true);
    try {
      await marketingApi.sendTestEmail(selectedCampaign.id, testEmail);
      toast.success(`Test email sent to ${testEmail}`);
      setShowTestEmail(false);
      setTestEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {activeTab === "campaigns" ? "Marketing Email Campaigns" : "Email Templates"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "campaigns"
              ? "Manage your email campaigns and track sending results."
              : "Create and customize reusable templates for your campaigns."}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "campaigns" && (
            <Button
              onClick={() => navigate("/marketing/campaigns/create")}
              variant="outline"
              className="gap-2"
            >
              <Mail className="h-4 w-4" /> Full Campaign Designer
            </Button>
          )}
          {activeTab === "campaigns" ? (
            <Button
              onClick={() => {
                setEditingCampaign(null);
                resetCampaignForm();
                setShowCreateCampaign(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Quick Campaign
            </Button>
          ) : (
            <Button onClick={handleNewTemplate} className="gap-2">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          )}
        </div>
      </div>

      {activeTab === "campaigns" ? (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingCampaigns ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading campaigns...
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>
                  No email campaigns found. Create your first email campaign to
                  start sending.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead>Scheduled / Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {c.from_email && (
                            <p className="text-xs text-muted-foreground">
                              {c.from_name
                                ? `${c.from_name} <${c.from_email}>`
                                : c.from_email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {c.subject || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusBadgeColors[c.status] || "outline"}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{c.template_name || "-"}</span>
                          {c.template_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                const tpl = templates.find((t: any) => t.id === c.template_id);
                                if (tpl) {
                                  setShowPreviewTemplate(tpl);
                                } else {
                                  toast.error("Template details not found");
                                }
                              }}
                              title="Preview Template"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.total_recipients || c.audience_count || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.total_sent || 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.scheduled_at
                          ? (() => {
                              const d = new Date(c.scheduled_at);
                              return format(d, "MMM d, yyyy h:mm a");
                            })()
                          : format(new Date(c.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => handleEditCampaign(c)}
                            >
                              <Edit className="h-4 w-4 mr-2" /> Edit Campaign
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setSelectedCampaign(c);
                                setShowTestEmail(true);
                              }}
                            >
                              <TestTube className="h-4 w-4 mr-2" /> Send Test
                              Email
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setShowRecipientsCampaign(c);
                                setRecipientsSearch("");
                              }}
                            >
                              <Users className="h-4 w-4 mr-2" /> View Recipients
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={async () => {
                                if (c.status === "Running") {
                                  updateEmailCampaign.mutate({ id: c.id, status: "Paused" });
                                } else {
                                  try {
                                    updateEmailCampaign.mutate({ id: c.id, status: "Running" });
                                    await marketingApi.sendCampaign(c.id);
                                    toast.success(`Campaign "${c.name}" is now sending!`);
                                  } catch (err: any) {
                                    toast.error(err.message || "Failed to run campaign");
                                  }
                                }
                              }}
                            >
                              {c.status === "Running"
                                ? "⏸ Pause Campaign"
                                : "🚀 Run Campaign Now"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => deleteEmailCampaign.mutate(c.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-4">
          {loadingTemplates ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Layout className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>
                  No email templates found. Create reusable templates for your
                  campaigns.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((tpl: EmailTemplate) => (
                <Card
                  key={tpl.id}
                  className="relative flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-base">{tpl.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {tpl.category || "General"}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {tpl.is_default ? "Default" : "Custom"}
                      </Badge>
                    </div>
                    {tpl.subject && (
                      <p className="text-xs text-muted-foreground font-medium">
                        Subject: {tpl.subject}
                      </p>
                    )}
                    <div className="p-2 border rounded bg-muted/30 text-xs truncate max-h-20 text-muted-foreground">
                      {tpl.plain_text || (tpl.html_content ? stripHtml(tpl.html_content) : "No content preview") || "HTML Design Template"}
                    </div>
                  </CardContent>
                  <div className="p-4 pt-0 flex justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => setShowPreviewTemplate(tpl)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => handleEditTemplate(tpl)}
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => deleteEmailTemplate.mutate(tpl.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Campaign Dialog */}
      <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign
                ? "Edit Email Campaign"
                : "Create Email Campaign"}
            </DialogTitle>
            <DialogDescription>
              Fill out the email campaign details and select target audiences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input
                value={campaignForm.name}
                onChange={(e) =>
                  setCampaignForm({ ...campaignForm, name: e.target.value })
                }
                placeholder="e.g., Summer Discount Blast"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={campaignForm.status}
                  onValueChange={(v: any) =>
                    setCampaignForm({ ...campaignForm, status: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Running">Running</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <Label>Email Template</Label>
                  {campaignForm.template_id && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => {
                        const tpl = templates.find((t: any) => t.id === campaignForm.template_id);
                        if (tpl) {
                          setShowPreviewTemplate(tpl);
                        } else {
                          toast.error("Template details not found");
                        }
                      }}
                    >
                      <Eye className="h-3 w-3" /> Preview Selected
                    </button>
                  )}
                </div>
                <Select
                  value={campaignForm.template_id}
                  onValueChange={(v) =>
                    setCampaignForm({ ...campaignForm, template_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t: EmailTemplate) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={campaignForm.subject}
                onChange={(e) =>
                  setCampaignForm({ ...campaignForm, subject: e.target.value })
                }
                placeholder="Exclusive Offer Inside!"
              />
            </div>

            <div className="space-y-2">
              <Label>Preview Text</Label>
              <Input
                value={campaignForm.preview_text}
                onChange={(e) =>
                  setCampaignForm({
                    ...campaignForm,
                    preview_text: e.target.value,
                  })
                }
                placeholder="Don't miss out on our special discounts."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>From Name</Label>
                <Input
                  value={campaignForm.from_name}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      from_name: e.target.value,
                    })
                  }
                  placeholder="Sales Team"
                />
              </div>
              <div className="space-y-2">
                <Label>From Email</Label>
                <Input
                  value={campaignForm.from_email}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      from_email: e.target.value,
                    })
                  }
                  placeholder="sales@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Reply-To Email</Label>
                <Input
                  value={campaignForm.reply_to}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      reply_to: e.target.value,
                    })
                  }
                  placeholder="support@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date & Time</Label>
              <Input
                type="datetime-local"
                value={campaignForm.scheduled_at}
                onChange={(e) =>
                  setCampaignForm({
                    ...campaignForm,
                    scheduled_at: e.target.value,
                  })
                }
              />
            </div>

            {/* Campaign Audience Section */}
            <div className="border p-3 rounded-md space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Target Audience
                </Label>
                <span className="text-xs text-muted-foreground">
                  {audiences.length} added
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={audType}
                  onValueChange={(v: any) => {
                    setAudType(v);
                    setAudValue("");
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Segment">Segment (Dynamic)</SelectItem>
                    <SelectItem value="List">Marketing List (Static)</SelectItem>
                    <SelectItem value="Contact">Contact ID</SelectItem>
                    <SelectItem value="Lead">Lead ID</SelectItem>
                    <SelectItem value="Customer">Customer ID</SelectItem>
                    <SelectItem value="Manual Email">Manual Email</SelectItem>
                  </SelectContent>
                </Select>
                {(audType === "Segment" || audType === "List") ? (
                  <Select
                    value={audValue}
                    onValueChange={(v) => setAudValue(v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={`Choose ${audType === "Segment" ? "segment" : "list"}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {lists
                        .filter((l: any) => (l.list_type || "static") === (audType === "Segment" ? "dynamic" : "static"))
                        .map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name} ({l.member_count || 0} members)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder={
                      audType === "Manual Email"
                        ? "email@domain.com"
                        : "Enter ID..."
                    }
                    value={audValue}
                    onChange={(e) => setAudValue(e.target.value)}
                    className="flex-1"
                  />
                )}
                <Button type="button" size="sm" onClick={handleAddAudience}>
                  Add
                </Button>
                {audValue && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAudValue("")}>
                    Cancel
                  </Button>
                )}
              </div>

              {audiences.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                  {audiences.map((aud, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-card border px-3 py-1.5 rounded text-xs"
                    >
                      <span>
                        <Badge variant="outline" className="mr-2">
                          {aud.audience_type === "Segment" ? "Target Group" : aud.audience_type}
                        </Badge>
                        {aud.audience_type === "Segment" ? (
                          (() => {
                            const found = lists.find((l: any) => l.id === aud.segment_id);
                            return found ? `${found.name} (${found.list_type === "dynamic" ? "Segment" : "List"})` : (aud.segment_id || "N/A");
                          })()
                        ) : (
                          aud.email ||
                          aud.contact_id ||
                          aud.lead_id ||
                          aud.customer_id ||
                          "All List"
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleRemoveAudience(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={campaignForm.description}
                onChange={(e) =>
                  setCampaignForm({
                    ...campaignForm,
                    description: e.target.value,
                  })
                }
                placeholder="Campaign notes and description..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateCampaign(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCampaign}>Save Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Template Dialog */}
      <Dialog
        open={showCreateTemplate}
        onOpenChange={(open) => {
          setShowCreateTemplate(open);
          if (!open) setEditingTemplate(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Email Template" : "New Email Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update your template details and HTML design."
                : "Create a template to reuse across campaigns."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, name: e.target.value })
                }
                placeholder="e.g., Weekly Newsletter Template"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={templateForm.category}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      category: e.target.value,
                    })
                  }
                  placeholder="e.g., Promotional, Newsletter"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Subject</Label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      subject: e.target.value,
                    })
                  }
                  placeholder="Default subject text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template Content *</Label>
                <div className="flex gap-1 bg-muted p-0.5 rounded text-xs">
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded ${
                      !rawHtmlMode
                        ? "bg-background shadow font-medium"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setRawHtmlMode(false)}
                  >
                    Visual Editor
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded ${
                      rawHtmlMode
                        ? "bg-background shadow font-medium"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setRawHtmlMode(true)}
                  >
                    HTML / Canva View
                  </button>
                </div>
              </div>

              {rawHtmlMode ||
              (templateForm.html_content &&
                templateForm.html_content.includes("<iframe")) ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-4 bg-background min-h-[300px]">
                    <div
                      className="canva-embed-container animate-fade-in"
                      dangerouslySetInnerHTML={{
                        __html:
                          templateForm.html_content ||
                          "<p className='text-muted-foreground text-xs'>No content pasted yet.</p>",
                      }}
                    />
                  </div>
                  <Textarea
                    value={templateForm.html_content}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        html_content: e.target.value,
                      })
                    }
                    placeholder="Paste your Canva HTML code or edit HTML here..."
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden w-full max-w-full">
                  <ReactQuill
                    theme="snow"
                    value={templateForm.html_content}
                    onChange={(value) =>
                      setTemplateForm({ ...templateForm, html_content: value })
                    }
                    modules={quillModules}
                    placeholder="Write your template content here..."
                    style={{ minHeight: "350px" }}
                  />
                </div>
              )}
            </div>

            {/* Canva Design Integration Option */}
            <div className="border border-dashed border-primary/40 p-3 rounded-md bg-primary/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                    Canva
                  </div>
                  <span className="text-xs font-semibold">
                    Import / Embed Canva Template
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-primary/30 hover:bg-primary/10"
                  onClick={() => window.open("https://www.canva.com", "_blank")}
                >
                  Open Canva ↗
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paste your Canva Design Embed HTML code or Canva View Link to
                use design in this template.
              </p>
              <div className="flex gap-2">
                <Input
                  id="canvaTemplateInput"
                  placeholder="Paste Canva HTML Embed code or Link..."
                  className="text-xs flex-1 h-8 bg-background"
                />
                <Button
                  size="sm"
                  type="button"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  onClick={() => {
                    const inputEl = document.getElementById(
                      "canvaTemplateInput",
                    ) as HTMLInputElement;
                    const val = (inputEl?.value || "").trim();
                    if (!val) {
                      toast.error("Please paste a Canva link or embed code");
                      return;
                    }
                    let finalHtml = "";
                    if (val.includes("<iframe") || val.includes("<a href")) {
                      finalHtml = val;
                    } else if (val.includes("canva.com/design/")) {
                      const cleanUrl = val
                        .split("?")[0]
                        .replace(/\/watch|\/view/, "");
                      const embedUrl = `${cleanUrl}/view?embed`;
                      finalHtml = `<div style="position: relative; width: 100%; height: 0; padding-top: 100%;"><iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none;" src="${embedUrl}" allowfullscreen="allowfullscreen"></iframe></div>`;
                    } else if (val.startsWith("http")) {
                      finalHtml = `<div style="text-align:center;"><img src="${val}" alt="Canva Design" style="max-width:100%;height:auto;border-radius:8px;" /></div>`;
                    } else {
                      finalHtml = val;
                    }
                    setTemplateForm({
                      ...templateForm,
                      html_content: finalHtml,
                    });
                    toast.success("Canva template applied successfully!");
                    if (inputEl) inputEl.value = "";
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateTemplate(false);
                setEditingTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editingTemplate ? "Update Template" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Template Modal */}
      <Dialog
        open={!!showPreviewTemplate}
        onOpenChange={() => setShowPreviewTemplate(null)}
      >
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Template Preview: {showPreviewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Category: {showPreviewTemplate?.category || "General"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {showPreviewTemplate?.subject && (
              <div className="p-2 border rounded bg-muted/20 text-xs">
                <span className="font-semibold">Subject: </span>{" "}
                {showPreviewTemplate.subject}
              </div>
            )}
            <IframePreview html={showPreviewTemplate?.html_content || showPreviewTemplate?.plain_text || ""} />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreviewTemplate(null)}
            >
              Close
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => {
                const tplToEdit = showPreviewTemplate;
                setShowPreviewTemplate(null);
                if (tplToEdit) handleEditTemplate(tplToEdit);
              }}
            >
              <Edit className="h-4 w-4" /> Edit Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={showTestEmail} onOpenChange={setShowTestEmail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email to verify your campaign before sending to your
              entire list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Test Email Address</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            {selectedCampaign && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">
                  Campaign: {selectedCampaign.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Subject: {selectedCampaign.subject || "No subject"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestEmail(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={sending || !testEmail}
            >
              {sending ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipients List Dialog */}
      <Dialog
        open={!!showRecipientsCampaign}
        onOpenChange={(open) => {
          if (!open) setShowRecipientsCampaign(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Campaign Recipients: {showRecipientsCampaign?.name}
            </DialogTitle>
            <DialogDescription>
              Track delivery and interaction statuses for each recipient in this campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={recipientsSearch}
                onChange={(e) => setRecipientsSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <RecipientsList campaignId={showRecipientsCampaign?.id} search={recipientsSearch} />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRecipientsCampaign(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RecipientsList = ({ campaignId, search }: { campaignId: string; search: string }) => {
  const { data: recipients = [], isLoading } = useCampaignRecipients(campaignId, { search });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading recipients...</div>;
  }

  if (recipients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
        No recipients found for this campaign.
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent At</TableHead>
            <TableHead>Opened At</TableHead>
            <TableHead>Clicked At</TableHead>
            <TableHead>Bounced At</TableHead>
            <TableHead>Unsubscribed At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipients.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-xs">{r.email}</TableCell>
              <TableCell className="text-xs">
                {r.first_name || r.last_name
                  ? `${r.first_name || ""} ${r.last_name || ""}`.trim()
                  : "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    r.status === "Delivered" || r.status === "Opened" || r.status === "Clicked"
                      ? "default"
                      : r.status === "Bounce" || r.status === "Failed"
                      ? "destructive"
                      : "outline"
                  }
                  className="text-[10px] px-1.5 py-0.5"
                >
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.sent_at ? format(new Date(r.sent_at), "MMM d, h:mm a") : "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.opened_at ? format(new Date(r.opened_at), "MMM d, h:mm a") : "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.clicked_at ? format(new Date(r.clicked_at), "MMM d, h:mm a") : "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.bounced_at ? format(new Date(r.bounced_at), "MMM d, h:mm a") : "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.unsubscribed_at ? format(new Date(r.unsubscribed_at), "MMM d, h:mm a") : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
