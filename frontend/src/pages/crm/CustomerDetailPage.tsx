import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, Save, Phone, Mail, Building2, User,
  Calendar, DollarSign, Tag, FileText, Activity, MessageSquare,
  Clock, Star, MoreHorizontal, ExternalLink, CheckCircle,
  AlertCircle, ChevronRight, TrendingUp, Users, Target, Award,
  Briefcase, History, Plus, Edit3, Send, BarChart3,
  Search, Settings, X, Check, ArrowUp, Zap, MapPin,
  Globe, PhoneCall, History as HistoryIcon, PieChart,
  TrendingDown, Eye, Filter, Share2, MoreVertical, Printer, Download
} from "lucide-react";
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
import { InteractionPanel } from "@/components/crm/InteractionPanel";
import { EntityFilesSection } from "@/components/crm/EntityFilesSection";
import { useCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/useCrmData";
import { useAuth } from "@/contexts/AuthContext";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

// Professional Field component for enterprise-level forms
interface FieldProps {
  label: string;
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  editing: boolean;
  icon?: React.ReactNode;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

function Field({ label, value, onChange, editing, icon, multiline, type = "text", placeholder, required }: FieldProps) {
  if (!editing && !value && value !== 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
          {icon}
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/30 flex items-center">
          <span className="text-muted-foreground/60 italic">Not specified</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {editing ? (
        multiline ? (
          <Textarea
            value={value?.toString() || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-lg"
          />
        ) : (
          <Input
            type={type}
            value={value?.toString() || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-lg"
          />
        )
      ) : (
        <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/30 flex items-center overflow-hidden">
          {type === "tel" ? (
            <ClickToCall 
              phoneNumber={value?.toString() || ""} 
              entityType="customer" 
              entityId={useParams().id} 
              className="font-medium break-words w-full text-sm" 
            />
          ) : type === "email" ? (
            <span 
              className="text-primary hover:underline font-medium break-words w-full text-sm cursor-pointer"
              onClick={() => navigate("/collaboration/mail", { state: { composeTo: value } })}
            >
              {value}
            </span>
          ) : (
            <span className="text-foreground font-medium break-words w-full text-sm">{value}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: customer, isLoading } = useCustomer(id!);
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
    if (!customer) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customer, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `customer_${customer.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Customer data exported successfully");
  };

  useEffect(() => {
    if (customer) setForm({ ...customer });
  }, [customer]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted-foreground font-medium animate-pulse">Loading experience...</p>
        </div>
      </div>
    );
  }

  if (!customer && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl shadow-xl border border-border max-w-md bg-card">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Customer Not Found</h2>
          <p className="text-muted-foreground mb-6">The customer you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => navigate('/crm/customers')} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portfolio
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    updateCustomer.mutate({ id: customer.id, ...form }, {
      onSuccess: () => setEditing(false)
    });
  };

  const handleDelete = () => {
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        toast.success("Client archived successfully");
        navigate('/crm/customers');
      },
      onError: () => toast.error("Failed to archive client")
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
      case 'onboarding': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
      case 'churned': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      case 'inactive': return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
      default: return 'bg-primary/5 text-primary border-primary/20 dark:bg-primary/10 dark:text-primary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'onboarding': return <Zap className="h-4 w-4" />;
      case 'churned': return <XCircle className="h-4 w-4" />;
      case 'inactive': return <Clock className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="min-h-screen">
      {/* Enterprise Header with Breadcrumb Navigation */}
      <div className="border-b border-border bg-card/95 backdrop-blur shadow-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          {/* Professional Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <span className="hover:text-foreground cursor-pointer" onClick={() => navigate('/crm')}>CRM</span>
            <ChevronRight className="h-4 w-4" />
            <span className="hover:text-foreground cursor-pointer" onClick={() => navigate('/crm/customers')}>Customers</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{customer.name}</span>
          </nav>
 
          {/* Header Content */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/crm/customers")}
                className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted self-start md:self-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Portfolio
              </Button>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative">
                  <Avatar className="h-14 w-14 ring-4 ring-background shadow-lg">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${customer.name}`} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-bold text-lg">
                      {customer.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-background rounded-full"></div>
                </div>
 
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground break-words max-w-[200px] sm:max-w-none">{customer.name}</h1>
                    <Badge className={cn("gap-1 px-3 py-1 font-medium whitespace-nowrap", getStatusColor(customer.status))}>
                      {getStatusIcon(customer.status)}
                      {customer.status || 'Active Client'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">{customer.industry || 'No Industry Specified'}</span>
                    </div>
                    {customer.total_revenue && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        <span>${Number(customer.total_revenue).toLocaleString()} Revenue</span>
                      </div>
                    )}
                    {customer.created_at && (
                      <div className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Onboarded {format(new Date(customer.created_at), 'MMM d, yyyy')}</span>
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
                    onClick={() => { setEditing(false); setForm({ ...customer }); }}
                    className="gap-2 border-input text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={updateCustomer.isPending}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                  >
                    <Save className="h-4 w-4" />
                    {updateCustomer.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  {/* Quick Action Buttons */}
                  {customer.phone && (
                    <ClickToCall 
                      phoneNumber={customer.phone} 
                      entityType="customer" 
                      entityId={customer.id} 
                      variant="outline"
                      className="gap-2 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800/30"
                    />
                  )}
                  {customer.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-primary border-primary/20 dark:text-primary-foreground"
                      onClick={() => navigate("/collaboration/mail", { state: { composeTo: customer.email } })}
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="gap-2 border-input text-muted-foreground hover:text-foreground"
                  >
                    <Edit3 className="h-4 w-4 mr-2 text-muted-foreground/60" />
                    Edit Details
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 border-input hover:bg-muted transition-all duration-200 rounded-lg shadow-sm hover:shadow-md"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-xl shadow-xl border-border bg-popover text-popover-foreground z-[100]  pointer-events-auto max-h-[450px] overflow-y-auto">
                      <DropdownMenuLabel className="px-3 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Communication</DropdownMenuLabel>
                      {customer.email && (
                        <DropdownMenuItem onSelect={() => copyToClipboard(customer.email, 'Email')} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-md">
                            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground">Copy Email Address</p>
                            <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                          </div>
                        </DropdownMenuItem>
                      )}
                      {customer.phone && (
                        <DropdownMenuItem onSelect={() => copyToClipboard(customer.phone, 'Phone')} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-md">
                            <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground">Copy Phone Number</p>
                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                          </div>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="my-2 bg-border" />

                      <DropdownMenuLabel className="px-3 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Jump</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => handleScrollToActivity("activity")} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-md">
                          <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">View Activity Timeline</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleScrollToActivity("activity", "booking")} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="p-2 bg-orange-50 dark:bg-orange-950/50 rounded-md">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Schedule Review</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-md">
                          <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Send Message</p>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-2 bg-border" />

                      <DropdownMenuLabel className="px-3 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Reports & Data</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={handlePrint} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="p-2 bg-orange-50 dark:bg-orange-950/50 rounded-md">
                          <Printer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Print Client Details</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExport} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-md">
                          <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="font-semibold text-sm text-foreground">Export as JSON</p>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-2 bg-border" />

                      <DropdownMenuItem onSelect={() => setShowDeleteDialog(true)} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-destructive/10 group transition-colors">
                        <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-md group-hover:bg-red-100 transition-colors">
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="font-semibold text-sm text-red-600 dark:text-red-400">Delete Customer</p>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2 bg-border" />
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30 group transition-colors"
                        onSelect={() => {
                          updateCustomer.mutate({ id: customer.id, status: 'unqualified' }, {
                            onSuccess: () => {
                              toast.success("Customer marked as unqualified");
                            }
                          });
                        }}
                      >
                        <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded-md group-hover:bg-orange-100 transition-colors">
                          <XCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <p className="font-semibold text-sm text-orange-600 dark:text-orange-400">Mark as Unqualified</p>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-7 space-y-8">
            {/* Enterprise Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg shadow-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary font-medium uppercase tracking-wide truncate">Total Revenue</p>
                      <p className="text-2xl font-bold text-foreground">${Number(customer.total_revenue || 0).toLocaleString()}</p>
                      <p className="text-xs text-primary truncate">Portfolio Contribution</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800/30 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 rounded-lg shadow-lg">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide truncate">Lifetime Value</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">${Number(customer.lifetime_value || 0).toLocaleString()}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">Strategic Account</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800/30 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500 rounded-lg shadow-lg">
                      <HistoryIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase tracking-wide truncate">Tenure</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                        {customer.created_at ? Math.floor((new Date().getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                      </p>
                      <p className="text-xs text-purple-700 dark:text-purple-400 truncate">Days as Client</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content Tabs Refined - Only Overview here now */}
            <Card className="shadow-xl border overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-indigo-50 dark:to-indigo-950/10 border-b border-border">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-primary rounded-lg">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  Portfolio Intelligence
                </CardTitle>
                <CardDescription>Core business and relational data points for this client</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field
                    label="Client Name"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    editing={editing}
                    icon={<User className="h-4 w-4" />}
                    required
                  />
                  <Field
                    label="Client Ecosystem"
                    value={form.industry}
                    onChange={(v) => setForm({ ...form, industry: v })}
                    editing={editing}
                    icon={<Building2 className="h-4 w-4" />}
                  />
                  <Field
                    label="Primary Email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    editing={editing}
                    type="email"
                    icon={<Mail className="h-4 w-4" />}
                  />
                  <Field
                    label="Primary Phone"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    editing={editing}
                    type="tel"
                    icon={<Phone className="h-4 w-4" />}
                  />
                  <Field
                    label="Account Tier"
                    value={form.tier}
                    onChange={(v) => setForm({ ...form, tier: v })}
                    editing={editing}
                    icon={<Award className="h-4 w-4" />}
                  />
                  <Field
                    label="Relationship Status"
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    editing={editing}
                    icon={<Activity className="h-4 w-4" />}
                  />
                </div>

                <div className="mt-12">
                  <Field
                    label="Executive Summaries & Strategic Goals"
                    value={form.notes}
                    onChange={(v) => setForm({ ...form, notes: v })}
                    editing={editing}
                    multiline
                    icon={<FileText className="h-4 w-4" />}
                    placeholder="Detailed background, preferences, and strategic goals for this client account..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-5 space-y-6 sticky top-24">
            {/* Quick Actions Card */}
            <Card className="shadow-lg border bg-background/60 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 gap-3">
                {customer.phone && (
                  <ClickToCall
                    phoneNumber={customer.phone}
                    entityType="customer"
                    entityId={customer.id}
                    className="w-full"
                    customTrigger={
                      <Button variant="outline" className="w-full justify-start gap-2 h-10 border hover:bg-muted/50">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">Call</span>
                      </Button>
                    }
                  />
                )}
                {customer.email && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                    onClick={() => navigate("/collaboration/mail", { state: { composeTo: customer.email } })}
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
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Export</span>
                </Button>
              </CardContent>
            </Card>


            {/* Activity & Documents Section - Moved to Sidebar */}
            <Card ref={activitySectionRef} className="shadow-lg border overflow-hidden flex flex-col h-[650px]">
              <CardHeader className="pb-0 border-b bg-muted/20">
                <div className="flex items-center justify-between pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Timeline & Files
                  </CardTitle>
                </div>
                <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full h-10 bg-muted/40 p-1">
                    <TabsTrigger value="activity" className="text-xs font-semibold">Activity</TabsTrigger>
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
                        entityType="customer"
                        entityId={customer.id}
                        activeTab={interactionTab}
                        onTabChange={setInteractionTab}
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
                      <EntityFilesSection entityType="customer" entityId={customer.id} />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
    </div>
  );
}

const XCircle = (props: any) => <X {...props} />;
const CalendarIcon = (props: any) => <Calendar {...props} />;
const Copy = (props: any) => <ExternalLink {...props} />;

