import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { 
  Pencil, 
  Save, 
  ChevronLeft, 
  Trash2,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  User,
  MoreVertical
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InteractionPanel } from "@/components/crm/InteractionPanel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => api.get<any>(`/contacts/${id}`),
  });

  const updateContact = useMutation({
    mutationFn: (data: any) => api.patch(`/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      setEditing(false);
      toast.success("Contact updated");
    },
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
      navigate("/crm/contacts");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete contact");
    },
  });

  useEffect(() => {
    if (contact) setForm(contact);
  }, [contact]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    updateContact.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contact) return <div className="p-6">Contact not found</div>;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                {contact.first_name} {contact.last_name || ""}
              </h1>
              {contact.position && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {contact.position}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
               <ClickToCall 
                 phoneNumber={contact.phone} 
                 entityType="contact" 
                 entityId={id}
                 className="hover:text-primary transition-colors"
               />
               <span>•</span>
               <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email || "No email"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setForm(contact); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={updateContact.isPending} className="gap-2">
                <Save className="h-4 w-4" /> Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. All interaction history will be lost.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteContact.mutate(id!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-auto">
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1600px] mx-auto">
          <div className="lg:col-span-1 space-y-6">
            <Collapsible defaultOpen>
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">General Info</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Salutation</Label>
                      {editing ? (
                        <Select value={form.salutation as string} onValueChange={(v) => set("salutation", v)}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mr">Mr.</SelectItem>
                            <SelectItem value="mrs">Mrs.</SelectItem>
                            <SelectItem value="ms">Ms.</SelectItem>
                            <SelectItem value="dr">Dr.</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <p className="text-sm capitalize">{(form.salutation as string) || "—"}</p>}
                    </div>
                    <Field label="First Name" value={form.first_name as string} onChange={(v) => set("first_name", v)} editing={editing} />
                    <Field label="Last Name" value={form.last_name as string} onChange={(v) => set("last_name", v)} editing={editing} />
                    <Field label="Position" value={form.position as string} onChange={(v) => set("position", v)} editing={editing} />
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      {editing ? (
                        <Input value={form.phone as string || ""} onChange={(e) => set("phone", e.target.value)} />
                      ) : (
                        <div className="flex items-center gap-2">
                           <ClickToCall phoneNumber={form.phone as string} entityType="contact" entityId={id} className="text-sm font-medium" />
                        </div>
                      )}
                    </div>
                    
                    <Field label="Email" value={form.email as string} onChange={(v) => set("email", v)} editing={editing} />
                    <Field label="Address" value={form.address as string} onChange={(v) => set("address", v)} editing={editing} />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible defaultOpen>
              <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors border-b">
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Additional Details</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Lifecycle Stage</Label>
                      {editing ? (
                        <Select value={(form.lifecycle_stage as string) || (form.lifecycleStage as string) || ""} onValueChange={(v) => { set("lifecycleStage", v); set("lifecycle_stage", v); }}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="subscriber">Subscriber</SelectItem>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="mql">Marketing Qualified Lead</SelectItem>
                            <SelectItem value="sql">Sales Qualified Lead</SelectItem>
                            <SelectItem value="opportunity">Opportunity</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm font-medium">
                          {
                            {
                              subscriber: "Subscriber",
                              lead: "Lead",
                              mql: "Marketing Qualified Lead",
                              sql: "Sales Qualified Lead",
                              opportunity: "Opportunity",
                              customer: "Customer",
                            }[form.lifecycle_stage as string] || (form.lifecycle_stage as string) || "—"
                          }
                        </p>
                      )}
                    </div>
                    <Field label="Contact Type" value={form.contact_type as string} onChange={(v) => set("contact_type", v)} editing={editing} />
                    <Field label="Source" value={form.source as string} onChange={(v) => set("source", v)} editing={editing} />
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      {editing ? (
                        <Textarea value={form.notes as string || ""} onChange={(e) => set("notes", e.target.value)} rows={4} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{(form.notes as string) || "—"}</p>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          <div className="lg:col-span-2">
             <InteractionPanel entityType="contact" entityId={id!} />
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, editing }: {
  label: string; value: string | undefined | null; onChange: (v: string) => void; editing: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <p className="text-sm font-medium">{value || "—"}</p>
      )}
    </div>
  );
}
