import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Info, User, Building2, Phone, Globe, MapPin, Mail, Tag } from "lucide-react";
import type { UniboxEmail } from "@/hooks/useUniboxEmails";

interface ConvertToLeadDialogProps {
  email: UniboxEmail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvert: (data: {
    title: string;
    company_name: string;
    company_email: string;
    company_phone: string;
    website: string;
    address: string;
    interaction_notes: string;
  }) => void;
  isConverting: boolean;
  instantlyInfo?: {
    companyName?: string;
    website?: string;
    phone?: string;
    location?: string;
    address?: string;
    profile?: string;
    facebook?: string;
    rating?: string;
    campaign?: string;
    campaign_id?: string;
    payload?: Record<string, any>;
  } | null;
}

function extractCompanyFromDomain(email: string): string {
  const domain = email.split("@")[1];
  if (!domain) return "";
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function extractPhone(text: string | null): string {
  if (!text) return "";
  const match = text.match(/(\+?\d[\d\s\-()]{8,}\d)/);
  return match ? match[0].trim() : "";
}

// Extract first/last name from sender_name
function splitName(fullName: string): { first: string; last: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" ") || "",
  };
}

// Clean RE:/FW: prefixes from subject
function cleanSubject(subject: string): string {
  return (subject || "Untitled Lead")
    .replace(/^((re|fw|fwd)\s*:\s*)+/i, "")
    .trim();
}

export function ConvertToLeadDialog({
  email,
  open,
  onOpenChange,
  onConvert,
  isConverting,
  instantlyInfo,
}: ConvertToLeadDialogProps) {
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Prefill all fields whenever dialog opens or email/instantlyInfo changes
  useEffect(() => {
    if (!open || !email) return;

    // ── Lead Name from subject ──
    setTitle(cleanSubject(email.subject));

    // ── Company Name ──
    const payload = instantlyInfo?.payload || {};
    const company =
      instantlyInfo?.companyName ||
      payload.companyName ||
      payload.company_name ||
      payload.Company ||
      email.sender_name ||
      extractCompanyFromDomain(email.sender_email);
    setCompanyName(company);

    // ── Email ──
    setCompanyEmail(email.sender_email);

    // ── Phone ──
    const phone =
      instantlyInfo?.phone ||
      payload.phone ||
      payload.Myphone ||
      payload.Phone ||
      (email as any).phone ||
      extractPhone(email.body_text);
    setCompanyPhone(phone);

    // ── Website ──
    const site =
      instantlyInfo?.website ||
      payload.website ||
      payload.Website ||
      "";
    setWebsite(site);

    // ── Address / Location ──
    const loc =
      instantlyInfo?.location ||
      instantlyInfo?.address ||
      payload.location ||
      payload.Location ||
      payload.address ||
      payload.Address ||
      "";
    setAddress(loc);

    // ── Interaction Notes ──
    const bodyText = (email.body_text || "").trim();
    const firstPara = bodyText.split(/\n\s*\n/)[0].trim();
    const timestamp = new Date(email.received_at).toLocaleString();
    setNotes(
      `[${timestamp}] Email received via Unibox:\n\nSubject: ${email.subject || ""}\nFrom: ${email.sender_name || ""} <${email.sender_email}>\n\n${firstPara}`
    );
  }, [open, email, instantlyInfo]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  // Auto-fetched fields summary for display
  const autoFetchedFields = email
    ? [
      instantlyInfo?.companyName && { label: "Company", value: instantlyInfo.companyName },
      instantlyInfo?.phone && { label: "Phone", value: instantlyInfo.phone },
      instantlyInfo?.website && { label: "Website", value: instantlyInfo.website },
      instantlyInfo?.location && { label: "Location", value: instantlyInfo.location },
      instantlyInfo?.rating && { label: "Rating", value: `${instantlyInfo.rating} / 5` },
      instantlyInfo?.profile && { label: "Profile", value: instantlyInfo.profile },
      instantlyInfo?.facebook && { label: "Facebook", value: instantlyInfo.facebook },
    ].filter(Boolean)
    : [];

  // Extra payload fields (not already mapped)
  const skipKeys = new Set([
    "companyName", "company_name", "company", "Company",
    "phone", "Myphone", "Phone", "phoneNumber",
    "website", "Website",
    "location", "Location", "address", "Address",
    "firstName", "first_name", "lastName", "last_name", "name",
    "email", "Email",
  ]);
  const extraPayload = Object.entries(instantlyInfo?.payload || {}).filter(
    ([k, v]) => !skipKeys.has(k) && v !== null && v !== undefined && String(v).trim() !== ""
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Convert to Lead
          </DialogTitle>
          <DialogDescription>
            Fields auto-filled from email & Instantly data. Review and edit before creating.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Auto-fetched info banner */}
          {autoFetchedFields.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Auto-fetched from Instantly
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(autoFetchedFields as { label: string; value: string }[]).map((f) => (
                  <Badge key={f.label} variant="secondary" className="text-[10px] gap-1 font-normal">
                    <span className="text-muted-foreground">{f.label}:</span>
                    <span className="truncate max-w-[120px]">{f.value}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lead Name */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              Lead Name
              <span className="text-[10px] text-primary font-normal ml-1">(from email subject)</span>
            </Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
          </div>

          <Separator />

          {/* Company + Website */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Company Name
              </Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Website
              </Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="e.g. www.company.com" className="h-10" />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Contact Email
              </Label>
              <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone
              </Label>
              <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="Optional" className="h-10" />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Address / Location
            </Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Company address or location" className="h-10" />
          </div>

          {/* Extra payload fields read-only */}
          {extraPayload.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" />
                Additional Info (will be saved as custom fields)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {extraPayload.map(([k, v]) => (
                  <div key={k} className="flex items-start gap-1 text-[11px]">
                    <span className="text-muted-foreground shrink-0 capitalize">{k.replace(/_/g, " ")}:</span>
                    <span className="text-foreground font-medium truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interaction Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Interaction Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-xs" />
          </div>

          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5">
            Auto-set: Stage → First Engagement &nbsp;|&nbsp; Source → Instantly &nbsp;|&nbsp; Priority → Medium
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConvert({
                title,
                company_name: companyName,
                company_email: companyEmail,
                company_phone: companyPhone,
                website,
                address,
                interaction_notes: notes,
              })
            }
            disabled={isConverting || !title.trim()}
          >
            {isConverting ? "Converting..." : "Create Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
