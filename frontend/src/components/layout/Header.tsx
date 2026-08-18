import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Plus, ChevronDown, Loader2, ArrowLeft, Menu, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SoftphoneToggleButton } from "@/components/telephony/SoftphoneToggleButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { leadsApi, contactsApi, companiesApi, dealsApi } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";

export function TopBar({ 
  onToggleSidebar, 
  isMobile 
}: { 
  onToggleSidebar?: () => void; 
  isMobile?: boolean; 
}) {
  const navigate = useNavigate();
  const { profile, userRole, signOut } = useAuth();
  const { organization } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleDisplay = (role: string | undefined) => {
    if (!role) return 'User';
    return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["global-search", searchTerm],
    enabled: searchTerm.trim().length > 1,
    queryFn: async () => {
      const term = searchTerm.trim();
      const [leads, contacts, companies, deals] = await Promise.all([
        leadsApi.getAll({ search: term, limit: 5 }),
        contactsApi.getAll({ search: term, limit: 5 }),
        companiesApi.getAll({ search: term, limit: 5 }),
        dealsApi.getAll({ search: term, limit: 5 }),
      ]);
      const toArray = (res: any) => (Array.isArray(res) ? res : res?.data ?? []);
      return {
        leads: toArray(leads),
        contacts: toArray(contacts),
        companies: toArray(companies),
        deals: toArray(deals),
      };
    },
  });

  const resultsVisible = searchFocused && searchTerm.trim().length > 1;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/85 backdrop-blur-md px-3 md:px-6 transition-all duration-300">
      <div className="flex items-center gap-1.5 md:gap-4 flex-1 min-w-0 max-w-xs sm:max-w-md md:max-w-xl">
        {isMobile ? (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleSidebar}
            className="text-muted-foreground hover:text-foreground rounded-xl transition-colors shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="text-primary hover:bg-primary/20 dark:hover:text-white rounded-xl transition-colors shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {organization && !isMobile && (
          <span className="text-sm font-semibold tracking-wide text-foreground hidden lg:block shrink-0">
            {organization.name}
          </span>
        )}
        <div className="relative flex-1 group min-w-[120px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search Any Thing Task, Leads.."
            className="pl-9 h-10 bg-secondary/70 border-transparent hover:bg-secondary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-[#2DD4BF]/25 focus-visible:border-[#2DD4BF] rounded-xl transition-all w-full text-xs sm:text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
          {resultsVisible && (
            <Card className="absolute mt-2 w-full max-w-sm sm:max-w-md md:max-w-xl shadow-xl border border-border/80 bg-popover/95 backdrop-blur-sm z-50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between px-4 py-2.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/40">
                <span>Quick results</span>
                {searching && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                {searchResults && Object.values(searchResults).every((arr) => (arr as any[]).length === 0) && (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">No matches found</div>
                )}
                {searchResults?.leads?.length ? (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-[10px] uppercase text-[#2DD4BF] font-bold tracking-wider px-2">Leads</p>
                    {searchResults.leads.map((lead: any) => (
                      <button
                        key={lead.id}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-muted/80 transition-colors"
                        onMouseDown={() => navigate(`/crm/leads/${lead.id}`)}
                      >
                        <div className="text-sm font-semibold">{lead.name || lead.title || 'Lead'}</div>
                        <div className="text-xs text-muted-foreground">{lead.email || lead.source || ''}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {searchResults?.contacts?.length ? (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-[10px] uppercase text-[#2DD4BF] font-bold tracking-wider px-2">Contacts</p>
                    {searchResults.contacts.map((contact: any) => (
                      <button
                        key={contact.id}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-muted/80 transition-colors"
                        onMouseDown={() => navigate(`/crm/customers/contacts/${contact.id}`)}
                      >
                        <div className="text-sm font-semibold">{`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.full_name || 'Contact'}</div>
                        <div className="text-xs text-muted-foreground">{contact.email || contact.phone || ''}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {searchResults?.companies?.length ? (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-[10px] uppercase text-[#2DD4BF] font-bold tracking-wider px-2">Companies</p>
                    {searchResults.companies.map((company: any) => (
                      <button
                        key={company.id}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-muted/80 transition-colors"
                        onMouseDown={() => navigate(`/crm/customers/companies/${company.id}`)}
                      >
                        <div className="text-sm font-semibold">{company.name || 'Company'}</div>
                        <div className="text-xs text-muted-foreground">{company.industry || company.website || ''}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {searchResults?.deals?.length ? (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-[10px] uppercase text-[#2DD4BF] font-bold tracking-wider px-2">Deals</p>
                    {searchResults.deals.map((deal: any) => (
                      <button
                        key={deal.id}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-muted/80 transition-colors"
                        onMouseDown={() => navigate(`/crm/deals/${deal.id}`)}
                      >
                        <div className="text-sm font-semibold">{deal.title || deal.name || 'Deal'}</div>
                        <div className="text-xs text-muted-foreground">{deal.stage || deal.status || ''}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 sm:gap-3 ml-2 sm:ml-4 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 px-3 sm:px-4 bg-gradient-to-r from-[#003136] to-[#0D646B] text-white font-semibold rounded-xl shadow-md shadow-[#003136]/15 hover:shadow-[#2DD4BF]/25 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Add</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          {/* <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 border border-border/80 shadow-xl">
            <DropdownMenuLabel className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-[#2DD4BF]">Create New</DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/crm/leads/create')}>New Lead</DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/crm/customers/contacts/create')}>New Contact</DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/crm/deals/create')}>New Deal</DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/crm/customers/companies/create')}>New Company</DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/hrms/employees')}>New Employee</DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/inventory/products')}>New Product</DropdownMenuItem>
          </DropdownMenuContent> */}
        </DropdownMenu>

        {/* Softphone Toggle */}
        <SoftphoneToggleButton />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsPopover />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1 md:gap-2.5 p-1 sm:pl-2.5 sm:pr-3 h-10 rounded-xl hover:bg-primary/20 transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                <AvatarImage src={getAvatarUrl(profile?.avatar_url)} />
                <AvatarFallback className="bg-gradient-to-tr from-[#003136] to-[#0D646B] text-white text-xs font-bold">{getInitials(profile?.full_name || 'User')}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold text-black dark:text-white">{profile?.full_name || 'User'}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{getRoleDisplay(userRole?.role)}</span>
              </div>
              <ChevronDown className="hidden sm:inline h-3.5 w-3.5 text-muted-foreground opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 border border-border/80 shadow-xl">
            <DropdownMenuLabel className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/settings')}>Profile Settings</DropdownMenuItem>
            {(userRole?.role === 'super_admin' || userRole?.role === 'admin') && (
              <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium" onClick={() => navigate('/admin-dashboard')}>Admin Dashboard</DropdownMenuItem>
            )}
            {/* <DropdownMenuItem className="rounded-xl px-3 py-2 font-medium">Billing</DropdownMenuItem> */}
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-xl px-3 py-2 font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={handleSignOut}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
