import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";

const SizeStyle = Quill.import('attributors/style/size');
SizeStyle.whitelist = ['small', 'large', 'huge'];
Quill.register(SizeStyle, true);

const AlignStyle = Quill.import('attributors/style/align');
Quill.register(AlignStyle, true);

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Paperclip, ChevronDown, ChevronUp, X, FileText } from "lucide-react";
import { api } from '@/lib/api';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxes: any[];
  replyTo?: any;
  forwardEmail?: any;
  initialTo?: string;
  entityType?: string;
  entityId?: string;
  onSent?: (to: string, subject: string) => void;
}

export function EmailComposer({ open, onOpenChange, mailboxes, replyTo, forwardEmail, initialTo, entityType, entityId, onSent }: EmailComposerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const draftIdRef = useRef<string | null>(null);
  const sentRef = useRef(false);

  const [form, setForm] = useState({
    mailbox_id: mailboxes[0]?.id || "",
    to: replyTo?.from_email || initialTo || "",
    cc: "",
    bcc: "",
    subject: replyTo
      ? `Re: ${replyTo.subject}`
      : forwardEmail
        ? `Fwd: ${forwardEmail.subject}`
        : "",
    body: forwardEmail
      ? `\n\n---------- Forwarded message ----------\nFrom: ${forwardEmail.from_email}\nSubject: ${forwardEmail.subject}\n\n${forwardEmail.body || ""}`
      : "",

  });

  const [attachments, setAttachments] = useState<File[]>([]);

  // Reset form each time the dialog opens with new data
  useEffect(() => {
    if (open) {
      setForm({
        mailbox_id: mailboxes[0]?.id || "",
        to: replyTo?.from_email || initialTo || "",
        cc: "",
        bcc: "",
        subject: replyTo
          ? `Re: ${replyTo.subject}`
          : forwardEmail
            ? `Fwd: ${forwardEmail.subject}`
            : "",
        body: forwardEmail
          ? `\n\n---------- Forwarded message ----------\nFrom: ${forwardEmail.from_email}\nSubject: ${forwardEmail.subject}\n\n${forwardEmail.body || ""}`
          : "",
      });
      setAttachments([]);
      setShowCcBcc(false);
      draftIdRef.current = null;
      sentRef.current = false;
    }
  }, [open, initialTo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<{ filename: string, content: string, type: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({
          filename: file.name,
          content: base64String,
          type: file.type
        });
      };
      reader.onerror = error => reject(error);
    });
  };

  const hasContent = () =>
    form.to.trim() !== "" || form.subject.trim() !== "" || form.body.trim() !== "";

  const saveDraft = async (silent = false) => {
    if (!hasContent()) return;
    setSavingDraft(true);
    try {
      const payload = {
        mailbox_id: form.mailbox_id,
        to: form.to,
        cc: form.cc,
        bcc: form.bcc,
        subject: form.subject,
        body: form.body.replace(/<[^>]*>?/gm, ''), // store plain text
        html_body: form.body,
        draft_id: draftIdRef.current ?? undefined,
      };
      const url = draftIdRef.current
        ? `/email/drafts/${draftIdRef.current}`
        : "/email/drafts";
      const method = draftIdRef.current ? "patch" : "post";
      const res = await api[method]<{ id: string }>(url, payload);
      if (res?.id) draftIdRef.current = res.id;
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-counts"] });
      if (!silent) toast.success("Draft saved");
    } catch {
      if (!silent) toast.error("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleClose = (open: boolean) => {
    sentRef.current = false;
    onOpenChange(open);
  };

  const handleSend = async () => {
    if (!user) return;
    if (!form.to || !form.subject) {
      toast.error("To and Subject are required");
      return;
    }

    setSending(true);
    try {
      const base64Attachments = await Promise.all(attachments.map(fileToBase64));

      // Send via edge function (real Gmail API / Graph API)
      const data = await api.post<any>('/email/send', {
        mailbox_id: form.mailbox_id,
        to: form.to,
        cc: form.cc || undefined,
        bcc: form.bcc || undefined,
        subject: form.subject,
        body: form.body.replace(/<[^>]*>?/gm, ''),
        html_body: form.body,
        attachments: base64Attachments,
        in_reply_to: replyTo?.message_id || undefined,
        thread_id: replyTo?.thread_id || undefined,
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
      });
      if (data?.error) throw new Error(data.error);

      // Delete draft from DB if it was saved
      if (draftIdRef.current) {
        api.delete(`/email/messages/${draftIdRef.current}`).catch(() => { });
      }
      toast.success("Email sent successfully");
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-counts"] });
      if (entityType && entityId) {
        queryClient.invalidateQueries({ queryKey: ["activities", entityType, entityId] });
      }
      onSent?.(form.to, form.subject);
      sentRef.current = true;
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{replyTo ? "Reply" : forwardEmail ? "Forward" : "New Email"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {mailboxes.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Select value={form.mailbox_id} onValueChange={(v) => setForm({ ...form, mailbox_id: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mailboxes.map((mb) => (
                    <SelectItem key={mb.id} value={mb.id}>
                      {mb.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">To</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowCcBcc(!showCcBcc)}>
                {showCcBcc ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                CC/BCC
              </Button>
            </div>
            <Input
              placeholder="recipient@example.com"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </div>

          {showCcBcc && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">CC</Label>
                <Input
                  placeholder="cc@example.com"
                  value={form.cc}
                  onChange={(e) => setForm({ ...form, cc: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">BCC</Label>
                <Input
                  placeholder="bcc@example.com"
                  value={form.bcc}
                  onChange={(e) => setForm({ ...form, bcc: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input
              placeholder="Email subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>

          <div className="space-y-1 mb-12">
            <ReactQuill
              theme="snow"
              value={form.body}
              onChange={(val) => setForm({ ...form, body: val })}
              className="min-h-[200px]"
              placeholder="Write your message..."
              modules={{
                toolbar: [
                  [{ 'size': ['small', false, 'large', 'huge'] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                  ['link', 'image'],
                  ['clean']
                ],
              }}
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {attachments.map((file, i) => (
                <Badge key={i} variant="secondary" className="pl-2 flex items-center gap-1 group">
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="hover:text-destructive p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-6 border-t">
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="file-upload"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
              onClick={() => document.getElementById('file-upload')?.click()}
              title="Attach files"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleClose(false)}
              className="rounded-full px-6"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await saveDraft(false);
                onOpenChange(false);
              }}
              disabled={savingDraft || !hasContent()}
              className="rounded-full px-5"
            >
              <FileText className="mr-2 h-4 w-4" />
              {savingDraft ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 shadow-lg hover:shadow-xl transition-all"
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
