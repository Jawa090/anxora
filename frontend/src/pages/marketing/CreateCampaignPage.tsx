import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";

const SizeStyle = Quill.import("attributors/style/size") as any;
SizeStyle.whitelist = ["small", "large", "huge"];
Quill.register(SizeStyle, true);

const AlignStyle = Quill.import("attributors/style/align") as any;
Quill.register(AlignStyle, true);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Send, Eye, Save, Sparkles, Mail } from "lucide-react";
import {
  useCreateCampaign,
  useCreateEmailCampaign,
  useMarketingLists,
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from "@/hooks/useMarketingData";
import { emailTemplates, personalizationTokens } from "@/data/emailTemplates";
import { toast } from "sonner";
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
        ${html || "<p style='color: #64748b; font-size: 14px;'>Your email content will appear here...</p>"}
      </body>
    </html>
  `;
  return (
    <iframe
      srcDoc={srcDoc}
      title="Email Preview"
      className="w-full min-h-[450px] border rounded-lg bg-white shadow-sm"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
    />
  );
}

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const createEmailCampaign = useCreateEmailCampaign();
  const createEmailTemplate = useCreateEmailTemplate();
  const updateEmailTemplate = useUpdateEmailTemplate();
  const { data: lists = [] } = useMarketingLists();
  const { data: dbTemplates = [] } = useEmailTemplates();

  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(
    null,
  );
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(
    null,
  );
  const [currentStep, setCurrentStep] = useState(1);

  const [form, setForm] = useState({
    name: "",
    description: "",
    channel: "email",
    campaign_type: "email",
    subject: "",
    from_name: "",
    from_email: "",
    list_id: "",
    content: "",
    audience_type: "list",
    manual_emails: "",
    canva_input: "",
    raw_html_mode: false,
    scheduled_at: "",
  });

  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

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

  const handleTemplateSelect = (template: (typeof emailTemplates)[0]) => {
    setForm({
      ...form,
      subject: template.subject,
      content: template.htmlContent,
    });
    setAppliedTemplateId(null);
    setAppliedTemplateName(template.name);
    setShowTemplates(false);
    toast.success(`Template "${template.name}" applied`);
  };

  const insertToken = (token: string) => {
    setForm({ ...form, subject: form.subject + token });
    setShowTokens(false);
  };

  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: "",
    category: "Newsletter",
  });

  const handleSaveTemplate = async (mode: "update" | "create") => {
    if (mode === "update" && appliedTemplateId) {
      try {
        await updateEmailTemplate.mutateAsync({
          id: appliedTemplateId,
          html_content: form.content,
          subject: form.subject,
        });
        setShowSaveTemplateDialog(false);
        toast.success("Template updated successfully");
      } catch (e) {
        console.error(e);
      }
    } else {
      if (!newTemplateForm.name.trim()) {
        toast.error("Template name is required");
        return;
      }
      try {
        const result: any = await createEmailTemplate.mutateAsync({
          name: newTemplateForm.name,
          category: newTemplateForm.category,
          subject: form.subject,
          html_content: form.content,
        });

        if (result && result.data) {
          setAppliedTemplateId(result.data.id);
          setAppliedTemplateName(result.data.name);
        }
        setShowSaveTemplateDialog(false);
        toast.success(
          `Template "${newTemplateForm.name}" created successfully`,
        );
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSave = async (status: "draft" | "scheduled") => {
    if (!form.name || !form.subject || !form.content) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (status === "scheduled" && !form.scheduled_at) {
      toast.error("Please set a Scheduled Date & Time in Step 1 before scheduling.");
      return;
    }

    try {
      const mappedStatus = status === "draft" ? "Draft" : "Scheduled";

      let finalTemplateId = appliedTemplateId;
      if (!finalTemplateId && appliedTemplateName) {
        // Look up if this built-in template has already been copied to db
        const existing = dbTemplates.find((t: any) => t.name === appliedTemplateName);
        if (existing) {
          finalTemplateId = existing.id;
        } else {
          try {
            const newTpl: any = await createEmailTemplate.mutateAsync({
              name: appliedTemplateName,
              category: "Newsletter",
              subject: form.subject,
              html_content: form.content,
            });
            if (newTpl && newTpl.data) {
              finalTemplateId = newTpl.data.id;
              setAppliedTemplateId(finalTemplateId);
            }
          } catch (e) {
            console.error("Failed to auto-create built-in template in db", e);
          }
        }
      }

      await createEmailCampaign.mutateAsync({
        name: form.name,
        description: form.description,
        subject: form.subject,
        preview_text: form.description,
        from_name: form.from_name,
        from_email: form.from_email,
        status: mappedStatus as any,
        campaign_type: form.campaign_type,
        template_id: finalTemplateId || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        audiences: form.audience_type === "manual"
          ? form.manual_emails.split(",").filter(Boolean).map(email => ({
              audience_type: "Manual Email",
              email: email.trim(),
            }))
          : form.list_id
            ? [{
                audience_type: "Segment",
                segment_id: form.list_id,
              }]
            : [],
      });

      toast.success(
        `Campaign ${status === "draft" ? "saved as Draft" : "scheduled"} successfully`,
      );

      // Navigate immediately - cache will auto-refresh
      navigate("/marketing/campaigns");
    } catch (error) {
      toast.error("Failed to create campaign");
      console.error("Campaign creation error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep(currentStep - 1);
              } else {
                navigate("/marketing/campaigns");
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {currentStep === 1 && "Campaign Details"}
              {currentStep === 2 && "Select Target Audience"}
              {currentStep === 3 && "Design Email Content"}
              {currentStep === 4 && "Review & Schedule Send"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of 4 — {currentStep === 1 && "Configure settings and naming"}
              {currentStep === 2 && "Choose which contacts will receive this email"}
              {currentStep === 3 && "Write subject line and build layout"}
              {currentStep === 4 && "Verify details and launch campaign"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" /> Live Preview
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
        {[
          { step: 1, label: "Campaign Details" },
          { step: 2, label: "Target Audience" },
          { step: 3, label: "Design Content" },
          { step: 4, label: "Review & Send" },
        ].map((item, idx, arr) => (
          <div key={item.step} className="flex items-center flex-1 last:flex-none">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => {
                if (item.step < currentStep) {
                  setCurrentStep(item.step);
                } else if (item.step === 2 && form.name.trim()) {
                  setCurrentStep(2);
                } else if (item.step === 3 && form.name.trim() && (form.audience_type !== "list" || form.list_id)) {
                  setCurrentStep(3);
                }
              }}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                currentStep === item.step
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : currentStep > item.step
                  ? "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}>
                {currentStep > item.step ? "✓" : item.step}
              </div>
              <span className={`text-sm font-medium hidden md:inline ${
                currentStep === item.step ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}>
                {item.label}
              </span>
            </div>
            {idx < arr.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 transition-colors ${
                currentStep > item.step ? "bg-green-600" : "bg-muted"
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[450px]">
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Campaign Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campaign Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g., Summer Newsletter 2026"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Internal description for your team"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From Name</Label>
                      <Input
                        value={form.from_name}
                        onChange={(e) =>
                          setForm({ ...form, from_name: e.target.value })
                        }
                        placeholder="Your Company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>From Email</Label>
                      <Input
                        type="email"
                        value={form.from_email}
                        onChange={(e) =>
                          setForm({ ...form, from_email: e.target.value })
                        }
                        placeholder="hello@company.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select
                      value={form.channel}
                      onValueChange={(v) => setForm({ ...form, channel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="social">Social Media</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Campaign Type</Label>
                    <Select
                      value={form.campaign_type}
                      onValueChange={(v) => setForm({ ...form, campaign_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Regular Email</SelectItem>
                        <SelectItem value="newsletter">Newsletter</SelectItem>
                        <SelectItem value="promotional">Promotional</SelectItem>
                        <SelectItem value="transactional">Transactional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Scheduled Date & Time (Optional)</Label>
                    <Input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) =>
                        setForm({ ...form, scheduled_at: e.target.value })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Leave blank to send immediately upon launch.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Audience Selection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Audience Type</Label>
                    <Select
                      value={form.audience_type || "list"}
                      onValueChange={(v) => setForm({ ...form, audience_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="list">Marketing List</SelectItem>
                        <SelectItem value="segment">Segment</SelectItem>
                        <SelectItem value="leads">All Active Leads</SelectItem>
                        <SelectItem value="contacts">All Contacts</SelectItem>
                        <SelectItem value="customers">All Customers</SelectItem>
                        <SelectItem value="manual">Manual Emails</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(form.audience_type === "list" || form.audience_type === "segment") && (() => {
                    const targetType = form.audience_type === "list" ? "static" : "dynamic";
                    const filteredLists = lists.filter((l: any) => (l.list_type || "static") === targetType);
                    return (
                      <div className="space-y-2">
                        <Label>Select {form.audience_type === "list" ? "Marketing List" : "Segment"}</Label>
                        <Select
                          value={form.list_id}
                          onValueChange={(v) => setForm({ ...form, list_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Choose a ${form.audience_type === "list" ? "list" : "segment"}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredLists.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No {form.audience_type === "list" ? "static lists" : "dynamic segments"} available (Create under Lists & Segments)
                              </SelectItem>
                            ) : (
                              filteredLists.map((list: any) => (
                                <SelectItem key={list.id} value={list.id}>
                                  {list.name} ({list.member_count || 0} members)
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}

                  {form.audience_type === "manual" && (
                    <div className="space-y-2">
                      <Label>Manual Email Addresses</Label>
                      <Textarea
                        placeholder="Enter emails separated by commas..."
                        value={form.manual_emails || ""}
                        onChange={(e) =>
                          setForm({ ...form, manual_emails: e.target.value })
                        }
                        rows={4}
                        className="text-xs"
                      />
                    </div>
                  )}

                  {form.list_id && form.audience_type === "list" && (
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Target Recipients
                        </p>
                        <p className="text-xl font-bold">
                          {lists.find((l: any) => l.id === form.list_id)
                            ?.member_count || 0}{" "}
                          Contacts
                        </p>
                      </div>
                      <Badge variant="outline">List Selected</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-900">Email Best Practices</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-800 space-y-2">
                  <p>• Keep subject lines under 50 characters</p>
                  <p>• Personalize with recipient's name</p>
                  <p>• Include a clear call-to-action</p>
                  <p>• Test on mobile devices</p>
                  <p>• Always include unsubscribe link</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-base">Email Content & Layout</CardTitle>
                <div className="flex flex-wrap gap-2 items-center">
                  {appliedTemplateName && (
                    <Badge
                      variant="outline"
                      className="text-xs border-primary/30 text-primary bg-primary/5 mr-2"
                    >
                      Template: {appliedTemplateName}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveTemplateDialog(true)}
                    className="bg-primary/5 hover:bg-primary/10 border-primary/20"
                  >
                    <Save className="h-4 w-4 mr-2" /> Save Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplates(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" /> Use Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTokens(true)}
                  >
                    Add Token
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject Line *</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    placeholder="Your compelling subject line..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Use personalization tokens like {`{{first_name}}`} for better
                    engagement
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Email Body *</Label>
                    <div className="flex gap-1 bg-muted p-0.5 rounded text-xs">
                      <button
                        type="button"
                        className={`px-2 py-0.5 rounded ${!form.raw_html_mode ? "bg-background shadow font-medium" : "text-muted-foreground"}`}
                        onClick={() => setForm({ ...form, raw_html_mode: false })}
                      >
                        Visual Editor
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 rounded ${form.raw_html_mode ? "bg-background shadow font-medium" : "text-muted-foreground"}`}
                        onClick={() => setForm({ ...form, raw_html_mode: true })}
                      >
                        HTML / Canva View
                      </button>
                    </div>
                  </div>

                  {form.raw_html_mode || form.content.includes("<iframe") ? (
                    <div className="space-y-3">
                      <div className="border rounded-lg p-4 bg-background min-h-[350px]">
                        <div
                          className="canva-embed-container"
                          dangerouslySetInnerHTML={{
                            __html:
                              form.content ||
                              "<p className='text-muted-foreground text-xs'>No content pasted yet.</p>",
                          }}
                        />
                      </div>
                      <Textarea
                        value={form.content}
                        onChange={(e) =>
                          setForm({ ...form, content: e.target.value })
                        }
                        placeholder="Paste your Canva HTML code or edit HTML here..."
                        rows={6}
                        className="font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <ReactQuill
                        theme="snow"
                        value={form.content}
                        onChange={(value) => setForm({ ...form, content: value })}
                        modules={quillModules}
                        placeholder="Write your email content here..."
                        style={{ minHeight: "350px" }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Campaign Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Campaign Name</p>
                    <p className="font-semibold text-base">{form.name}</p>
                  </div>
                  {form.description && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-muted-foreground">{form.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Channel</p>
                      <Badge variant="outline" className="capitalize">{form.channel}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <Badge variant="outline" className="capitalize">{form.campaign_type}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Sender Settings</p>
                    <p className="font-medium text-xs">
                      {form.from_name || "Your Company"} &lt;{form.from_email || "hello@company.com"}&gt;
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Target Audience</p>
                    <p className="font-semibold">
                      {form.audience_type === "list" ? (
                        `Marketing List: ${lists.find((l: any) => l.id === form.list_id)?.name || "N/A"}`
                      ) : form.audience_type === "manual" ? (
                        `Manual Emails (${form.manual_emails.split(",").filter(Boolean).length})`
                      ) : (
                        `All ${form.audience_type}`
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Email Content Live Preview</span>
                    <Badge variant="secondary">Subject: {form.subject}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <IframePreview html={form.content} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center border-t pt-6 mt-6">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep > 1) {
              setCurrentStep(currentStep - 1);
            } else {
              navigate("/marketing/campaigns");
            }
          }}
        >
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>

        <div className="flex gap-2">
          {currentStep < 4 ? (
            <Button
              onClick={() => {
                if (currentStep === 1) {
                  if (!form.name.trim()) {
                    toast.error("Campaign Name is required");
                    return;
                  }
                }
                if (currentStep === 2) {
                  if (form.audience_type === "list" && !form.list_id) {
                    toast.error("Please select a target Marketing List");
                    return;
                  }
                  if (form.audience_type === "segment" && !form.list_id) {
                    toast.error("Please select a target Segment");
                    return;
                  }
                  if (form.audience_type === "manual" && !form.manual_emails.trim()) {
                    toast.error("Please enter email addresses");
                    return;
                  }
                }
                if (currentStep === 3) {
                  if (!form.subject.trim()) {
                    toast.error("Subject Line is required");
                    return;
                  }
                  if (!form.content.trim()) {
                    toast.error("Email Content is required");
                    return;
                  }
                }
                setCurrentStep(currentStep + 1);
              }}
            >
              Next Step
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleSave("draft")}>
                <Save className="h-4 w-4 mr-2" /> Save Draft
              </Button>
              <Button onClick={() => handleSave("scheduled")}>
                <Send className="h-4 w-4 mr-2" /> Schedule Send
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Template Library Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Email Template</DialogTitle>
            <DialogDescription>
              Select a professionally designed template, a custom saved
              template, or embed from Canva
            </DialogDescription>
          </DialogHeader>

          {/* Canva Quick Import Bar */}
          <div className="border border-dashed border-purple-500/40 p-3 rounded-lg bg-purple-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white text-[11px] font-bold">
                Canva
              </div>
              <div>
                <p className="text-xs font-semibold">Import from Canva</p>
                <p className="text-[11px] text-muted-foreground">
                  Paste Canva HTML embed code, view link, or image URL
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-1 max-w-md">
              <Input
                placeholder="Paste Canva link or HTML embed..."
                className="text-xs h-8 bg-background flex-1"
                value={form.canva_input || ""}
                onChange={(e) =>
                  setForm({ ...form, canva_input: e.target.value })
                }
              />
              <Button
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  const val = (form.canva_input || "").trim();
                  if (!val) {
                    toast.error("Please paste a Canva link or embed code");
                    return;
                  }

                  let finalHtml = "";
                  if (val.includes("<iframe") || val.includes("<a href")) {
                    finalHtml = val;
                  } else if (val.includes("canva.com/design/")) {
                    // Convert design link to embed view URL
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

                  setForm({ ...form, content: finalHtml });
                  setShowTemplates(false);
                  toast.success("Canva template imported successfully!");
                }}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => window.open("https://www.canva.com", "_blank")}
              >
                Canva ↗
              </Button>
            </div>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Built-in</TabsTrigger>
              <TabsTrigger value="custom">
                My Saved Templates ({dbTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="Onboarding">Onboarding</TabsTrigger>
              <TabsTrigger value="Newsletter">Newsletter</TabsTrigger>
              <TabsTrigger value="Promotion">Promotion</TabsTrigger>
              <TabsTrigger value="Event">Event</TabsTrigger>
            </TabsList>

            <TabsContent value="custom" className="space-y-4 pt-2">
              {dbTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  No custom saved templates. Create templates in Templates Tab
                  to reuse them.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {dbTemplates.map((template: any) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow border-muted hover:border-primary"
                      onClick={() => {
                        setForm({
                          ...form,
                          subject: template.subject || form.subject,
                          content:
                            template.html_content || template.plain_text || "",
                        });
                        setAppliedTemplateId(template.id);
                        setAppliedTemplateName(template.name);
                        setShowTemplates(false);
                        toast.success(
                          `Custom template "${template.name}" applied`,
                        );
                      }}
                    >
                      <CardContent className="pt-6">
                        <div className="text-2xl mb-2 font-bold">📄</div>
                        <h3 className="font-semibold mb-1">{template.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2 truncate">
                          {template.subject
                            ? `Subject: ${template.subject}`
                            : "No subject"}
                        </p>
                        <Badge variant="outline">
                          {template.category || "Custom"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {["all", "Onboarding", "Newsletter", "Promotion", "Event"].map(
              (category) => (
                <TabsContent
                  key={category}
                  value={category}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    {emailTemplates
                      .filter(
                        (t) => category === "all" || t.category === category,
                      )
                      .map((template) => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:shadow-lg transition-shadow border-muted hover:border-primary"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardContent className="pt-6">
                            <div className="text-4xl mb-3">
                              {template.thumbnail}
                            </div>
                            <h3 className="font-semibold mb-1">
                              {template.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {template.description}
                            </p>
                            <Badge variant="secondary">
                              {template.category}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
              ),
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Personalization Tokens Dialog */}
      <Dialog open={showTokens} onOpenChange={setShowTokens}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personalization Tokens</DialogTitle>
            <DialogDescription>
              Click on any token to insert it into your subject line
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {personalizationTokens.map((item) => (
              <div
                key={item.token}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => insertToken(item.token)}
              >
                <div>
                  <p className="font-mono text-sm font-medium">{item.token}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <Button size="sm" variant="ghost">
                  Insert
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">From</p>
              <p className="font-medium">
                {form.from_name || "Your Company"} &lt;
                {form.from_email || "hello@company.com"}&gt;
              </p>
            </div>
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-medium">
                {form.subject || "Your subject line"}
              </p>
            </div>
            <IframePreview html={form.content} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Save Email Template</DialogTitle>
            <DialogDescription>
              Save the current email content and subject line as a template to
              reuse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {appliedTemplateId ? (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground">
                    Currently applied template:
                  </p>
                  <p className="font-medium text-foreground">
                    {appliedTemplateName}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 h-auto flex flex-col items-center justify-center gap-1"
                    onClick={() => handleSaveTemplate("update")}
                  >
                    <span>Update Current</span>
                    <span className="text-[10px] opacity-80 font-normal">
                      Overwrite template
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs py-2 h-auto flex flex-col items-center justify-center gap-1 border-dashed"
                    onClick={() => {
                      setAppliedTemplateId(null);
                    }}
                  >
                    <span>Save as New</span>
                    <span className="text-[10px] opacity-80 font-normal">
                      Create a separate template
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    value={newTemplateForm.name}
                    onChange={(e) =>
                      setNewTemplateForm({
                        ...newTemplateForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g., Summer Promotion Template"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={newTemplateForm.category}
                    onChange={(e) =>
                      setNewTemplateForm({
                        ...newTemplateForm,
                        category: e.target.value,
                      })
                    }
                    placeholder="e.g., Promotional, Newsletter"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSaveTemplateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => handleSaveTemplate("create")}>
                    Save Template
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
