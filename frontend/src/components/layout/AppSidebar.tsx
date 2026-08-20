import { useState, useMemo, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkgroups, useDeleteWorkgroup } from "@/hooks/useWorkgroups";
import { UniboxCampaignSidebar } from "@/components/unibox/UniboxCampaignSidebar";
import { useUniboxPermission } from "@/hooks/useUniboxPermission";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/useRealtime";
import {
  LayoutDashboard,
  LayoutGrid,
  Layout,
  Users,
  UserPlus,
  Handshake,
  Package,
  Warehouse,
  Calendar,
  Clock,
  Mail,
  Mailbox,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  Briefcase,
  DollarSign,
  UserCheck,
  TrendingUp,
  ShoppingCart,
  Truck,
  BarChart3,
  FolderOpen,
  UsersRound,
  ClipboardList,
  FileText,
  Bell,
  Shield,
  Lock,
  LogIn,
  Phone,
  CheckSquare,
  Zap,
  UserPlus2,
  FolderKanban,
  Megaphone,
  Target,
  ListFilter,
  UserCog,
  CheckCircle,
  MessageSquare,
  Building,
  ArrowRight,
  ArrowLeft,
  LogOut,
  HelpCircle,
  Trash2,
  GripVertical,
  X,
  Laptop,
  Star,
  LayoutList,
  Kanban as KanbanIcon,
  CalendarDays,
  Paperclip,
  Activity as ActivityIcon,
  BarChart2,
  Receipt,
  Milestone,
  ChevronsLeft,
  ChevronsRight,
  List,
  Grid,
  Smartphone,
  XSquare,
  GanttChartIcon,
} from "lucide-react";
import { useProject } from "@/hooks/useProjectManagement";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";
import { cn, getAvatarUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NestedChild {
  title: string;
  href: string;
  hasNested?: boolean;
}

interface NavSubItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  nestedChildren?: NestedChild[];
  roles?: string[];
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavSubItem[];
  roles?: string[];
}

const navigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },

  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
    children: [
      { title: "Overview", href: "/projects", icon: LayoutDashboard },
      { title: "Active Tasks", href: "/projects?tab=tasks", icon: CheckSquare },
      {
        title: "Milestones",
        href: "/projects?tab=milestones",
        icon: Milestone,
      },
      { title: "After Due Date", href: "/projects?tab=overdue", icon: Clock },
    ],
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    children: [
      { title: "Overview", href: "/tasks", icon: LayoutDashboard },
      { title: "Kanban", href: "/tasks?tab=kanban", icon: KanbanIcon },
      { title: "Gantt", href: "/tasks?tab=gantt", icon: GanttChartIcon },
    ],
  },
  {
    title: "Collaboration",
    icon: UsersRound,
    children: [
      { title: "Calendar", href: "/collaboration/calendar", icon: Calendar },
      { title: "Drive", href: "/collaboration/drive", icon: FolderOpen },
      { title: "Mail", href: "/collaboration/mail", icon: Mail },
      { title: "Workgroups", href: "/collaboration/workgroups", icon: Users },
    ],
  },
  // {
  //   title: "CRM",
  //   icon: TrendingUp,
  //   children: [
  //     { title: "Dashboard", href: "/crm/dashboard", icon: LayoutDashboard },
  //     { title: "Unibox", href: "/crm/unibox", icon: Mailbox },
  //     { title: "Leads", href: "/crm/leads", icon: UserPlus },
  //     { title: "Deals", href: "/crm/deals", icon: Handshake },
  //     { title: "Unqualified", href: "/crm/unqualified", icon: ListFilter },
  //     {
  //       title: "Customers",
  //       href: "/crm/customers",
  //       icon: Building2,
  //       nestedChildren: [
  //         { title: "Overview", href: "/crm/customers" },
  //         { title: "Contacts", href: "/crm/customers/contacts" },
  //         { title: "Companies", href: "/crm/customers/companies" },
  //         {
  //           title: "Signing parties",
  //           href: "/crm/customers/signing-parties",
  //           hasNested: true,
  //         },
  //         // { title: "Vendors", href: "/inventory/vendors", hasNested: false },
  //       ],
  //     },
  //     // { title: "Sales", href: "/crm/sales", icon: DollarSign },
  //     // { title: "Analytics", href: "/crm/analytics", icon: BarChart3 },
  //     { title: "Communications", href: "/crm/communications", icon: Phone },
  //   ],
  // },
  {
    title: "HRMS",
    icon: Briefcase,
    children: [
      { title: "Dashboard", href: "/hrms", icon: BarChart3 },
      { title: "Attendance", href: "/hrms/attendance", icon: ClipboardList },
      {
        title: "Employees",
        href: "/hrms/employees",
        icon: UserCheck,
        roles: ["super_admin", "admin", "manager"],
      },
      { title: "Leave Management", href: "/hrms/leave", icon: Calendar },
      {
        title: "Payroll",
        href: "/hrms/payroll",
        icon: DollarSign,
        roles: ["super_admin", "admin", "manager"],
      },
      { title: "Notifications", href: "/hrms/notifications", icon: Bell },
    ],
  },
  // {
  //   title: "Recruitment",
  //   icon: UserCog,
  //   roles: ["super_admin", "admin", "manager", "team_lead"],
  //   children: [
  //     { title: "Dashboard", href: "/recruitment", icon: LayoutDashboard },
  //     {
  //       title: "Requisitions",
  //       href: "/recruitment/requisitions",
  //       icon: FileText,
  //     },
  //     { title: "Approvals", href: "/recruitment/approvals", icon: CheckCircle },
  //     {
  //       title: "Candidates",
  //       href: "/recruitment/candidates",
  //       icon: Users,
  //       roles: ["super_admin", "admin", "manager"],
  //     },
  //     {
  //       title: "Interviews",
  //       href: "/recruitment/interviews",
  //       icon: MessageSquare,
  //       roles: ["super_admin", "admin", "manager"],
  //     },
  //     // { title: "Scoring", href: "/recruitment/scoring", icon: Target },
  //     {
  //       title: "Offers",
  //       href: "/recruitment/offers",
  //       icon: DollarSign,
  //       roles: ["super_admin", "admin", "manager"],
  //     },
  //     // { title: "Talent Pool", href: "/recruitment/talent-pool", icon: UsersRound },
  //     // { title: "Analytics", href: "/recruitment/analytics", icon: BarChart3 },
  //   ],
  // },
  // {
  //   title: "Inventory",
  //   icon: Package,
  //   roles: ["super_admin", "admin"],
  //   children: [
  //     { title: "Dashboard", href: "/inventory", icon: BarChart3 },
  //     { title: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
  //     { title: "Vendors", href: "/inventory/vendors", icon: Truck },
  //     { title: "Products", href: "/inventory/products", icon: ShoppingCart },
  //     { title: "Stock Tracking", href: "/inventory/stock", icon: Package },
  //     {
  //       title: "Purchase Orders",
  //       href: "/inventory/purchase-orders",
  //       icon: FileText,
  //     },
  //     {
  //       title: "Product Assignments",
  //       href: "/inventory/assignments",
  //       icon: Users,
  //     },
  //   ],
  // },
  // {
  //   title: "Finance",
  //   icon: DollarSign,
  //   roles: ["super_admin", "admin"],
  //   children: [
  //     { title: "Dashboard", href: "/finance/dashboard", icon: LayoutDashboard },
  //     {
  //       title: "General Ledger",
  //       href: "/finance/general-ledger",
  //       icon: FileText,
  //     },
  //     {
  //       title: "Accounts Receivable",
  //       href: "/finance/accounts-receivable",
  //       icon: TrendingUp,
  //     },
  //     {
  //       title: "Accounts Payable",
  //       href: "/finance/accounts-payable",
  //       icon: ShoppingCart,
  //     },
  //     {
  //       title: "Banking & Cash",
  //       href: "/finance/banking-cash",
  //       icon: Building,
  //     },
  //     { title: "Expense Management", href: "/finance/expenses", icon: Receipt },
  //     { title: "Payroll Accounting", href: "/finance/payroll", icon: DollarSign },
  //     { title: "Budgeting", href: "/finance/budgeting", icon: Target },
  //     { title: "Reports", href: "/finance/reports", icon: BarChart3 },
  //     { title: "Setup", href: "/finance/setup", icon: Settings },
  //   ],
  // },
  // {
  //   title: "Marketing",
  //   icon: Megaphone,
  //   children: [
  //     { title: "Dashboard", href: "/marketing", icon: LayoutDashboard },
  //     { title: "Lists & Segments", href: "/marketing/lists", icon: ListFilter },
  //     { title: "Templates", href: "/marketing/templates", icon: Layout },
  //     { title: "Campaigns", href: "/marketing/campaigns", icon: Mail },
  //     { title: "Forms", href: "/marketing/forms", icon: FileText },
  //     { title: "Sequences", href: "/marketing/sequences", icon: Zap },
  //     { title: "Automation", href: "/marketing/automation", icon: Zap },
  //     { title: "Analytics", href: "/marketing/analytics", icon: BarChart3 },
  //   ],
  // },

  // {
  //   title: "Admin Portal",
  //   icon: Shield,
  //   children: [
  //     { title: "User Management", href: "/admin/users", icon: Users },
  //     { title: "Role Assignments", href: "/admin/roles", icon: UserCheck },
  //     { title: "Permissions", href: "/admin/permissions", icon: Lock },
  //     { title: "Join Requests", href: "/admin/join-requests", icon: UserPlus2 },
  //     { title: "Settings", href: "/admin/settings", icon: Settings },
  //   ],
  // },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({
  width = 256,
  onWidthChange,
  isMobile,
  isOpen,
  onClose,
}: {
  width?: number;
  onWidthChange?: (width: number) => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, profile, hasPermission } = useAuth();
  const { data: workgroups = [] } = useWorkgroups();
  const projectMatch = location.pathname.match(/\/projects\/([a-zA-Z0-9\-]+)/);
  const activeProjectId =
    projectMatch && projectMatch[1] !== "new" ? projectMatch[1] : null;
  const { data: activeProject } = useProject(activeProjectId || "");
  const {
    isOwner: isUniboxOwner,
    hasFullAccess: hasFullUniboxAccess,
    canManageFolders: canManageUniboxFolders,
  } = useUniboxPermission();
  const isElectron =
    typeof window !== "undefined" &&
    Boolean((window as any).electronAPI?.isElectron);
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<string[]>([
    "Collaboration",
    "CRM",
  ]);
  const [openCollaborationSections, setOpenCollaborationSections] = useState<
    string[]
  >(["Direct Messages", "Team Groups", "Broadcasts"]);
  const [expandedSubItems, setExpandedSubItems] = useState<string[]>([]);
  const [expandedNestedItems, setExpandedNestedItems] = useState<string[]>([]);
  const getModuleFromPath = (path: string): string | null => {
    if (path.startsWith("/projects")) return "Projects";
    if (path.startsWith("/collaboration")) return "Collaboration";
    if (path.startsWith("/crm")) return "CRM";
    if (path.startsWith("/hrms")) return "HRMS";
    if (path.startsWith("/recruitment")) return "Recruitment";
    if (path.startsWith("/inventory")) return "Inventory";
    if (path.startsWith("/finance")) return "Finance";
    if (path.startsWith("/marketing")) return "Marketing";
    return null;
  };

  const [focusedModule, setFocusedModule] = useState<string | null>(() =>
    getModuleFromPath(location.pathname),
  );

  useEffect(() => {
    const matched = getModuleFromPath(location.pathname);
    if (matched) {
      setFocusedModule(matched);
    } else if (
      location.pathname === "/" ||
      location.pathname === "/dashboard"
    ) {
      setFocusedModule(null);
    }
  }, [location.pathname]);

  const dynamicNavigation = useMemo(() => {
    return navigation.map((item) => {
      if (item.title === "Projects" && activeProjectId) {
        return {
          ...item,
          children: [
            {
              title: "Overview",
              href: `/projects/${activeProjectId}?tab=overview`,
              icon: LayoutList,
            },
            {
              title: "Tasks Table",
              href: `/projects/${activeProjectId}?tab=tasks`,
              icon: CheckSquare,
            },
            {
              title: "Kanban Board",
              href: `/projects/${activeProjectId}?tab=kanban`,
              icon: KanbanIcon,
            },
            {
              title: "Gantt Timeline",
              href: `/projects/${activeProjectId}?tab=timeline`,
              icon: CalendarDays,
            },
            {
              title: "Milestones",
              href: `/projects/${activeProjectId}?tab=milestones`,
              icon: Milestone,
            },
            {
              title: "Files Vault",
              href: `/projects/${activeProjectId}?tab=files`,
              icon: FolderOpen,
            },
            {
              title: "Slack Chat",
              href: `/projects/${activeProjectId}?tab=discussions`,
              icon: MessageSquare,
            },
            {
              title: "Reports",
              href: `/projects/${activeProjectId}?tab=reports`,
              icon: BarChart3,
            },
            {
              title: "Settings",
              href: `/projects/${activeProjectId}?tab=settings`,
              icon: Settings,
            },
          ] as NavSubItem[],
        };
      }
      return item;
    });
  }, [activeProjectId]);

  const deleteWg = useDeleteWorkgroup();
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const { on: onRealtime, off: offRealtime } = useRealtime();
  const [orderedNavigation, setOrderedNavigation] = useState<NavItem[]>(() => {
    const savedOrder =
      typeof window !== "undefined"
        ? localStorage.getItem("sidebar_module_order")
        : null;
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        const reordered = parsedOrder
          .map((title: string) => navigation.find((n) => n.title === title))
          .filter(Boolean) as NavItem[];

        const missingItems = navigation.filter(
          (item) => !parsedOrder.includes(item.title),
        );

        return [...reordered, ...missingItems];
      } catch (e) {
        return navigation;
      }
    }
    return navigation;
  });

  const finalOrderedNavigation = useMemo(() => {
    return (orderedNavigation || [])
      .filter(Boolean)
      .map((item) => {
        if (!item || !item.title) return item;
        const dynamicItem = (dynamicNavigation || []).find(
          (d) => d && d.title === item.title,
        );
        return dynamicItem || item;
      })
      .filter(Boolean);
  }, [orderedNavigation, dynamicNavigation]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Avoid accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedNavigation((items) => {
        const oldIndex = items.findIndex((i) => i.title === active.id);
        const newIndex = items.findIndex((i) => i.title === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Save only titles to localStorage for persistence
        localStorage.setItem(
          "sidebar_module_order",
          JSON.stringify(newOrder.map((item) => item.title)),
        );

        return newOrder;
      });
    }
  };

  useEffect(() => {
    const handleWorkgroupUpdated = (payload: any) => {
      // Invalidate queries to refresh the list for all actions (created, updated, deleted)
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    const handleNewNotification = (payload: any) => {
      // Refresh workgroups whenever a new message notification arrives
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    onRealtime("workgroup:notification", handleNewNotification);
    onRealtime("workgroup_post:new", handleWorkgroupUpdated);

    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
      offRealtime("workgroup:notification", handleNewNotification);
      offRealtime("workgroup_post:new", handleWorkgroupUpdated);
    };
  }, [onRealtime, offRealtime, queryClient]);

  // Auto-expand Unibox when navigating to the Unibox page
  useEffect(() => {
    if (location.pathname.startsWith("/crm/unibox")) {
      setExpandedSubItems((prev) => {
        if (!prev.includes("Unibox")) return [...prev, "Unibox"];
        return prev;
      });
    }
  }, [location.pathname]);

  const isAdmin =
    userRole?.role === "super_admin" || userRole?.role === "admin";

  const toggleStarChat = async (workgroupId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const workgroup = workgroups.find((wg: any) => wg.id === workgroupId);
    if (!workgroup) return;

    const newStarredState = !workgroup.is_starred;

    try {
      await api.put(`/workgroups/${workgroupId}/star`, {
        is_starred: newStarredState,
      });
      // Invalidate and refetch workgroups to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  };

  // Direct Messages from workgroups - show starred first, then recent, max 5
  const directMessages = useMemo(() => {
    const dms = workgroups.filter(
      (wg: any) =>
        wg.type === "private" && Boolean(wg.settings?.is_direct_chat),
    );

    // Separate starred and non-starred
    const starred = dms.filter((wg: any) => wg.is_starred);
    const nonStarred = dms.filter((wg: any) => !wg.is_starred);

    // Sort both by recent activity
    const sortByRecent = (a: any, b: any) => {
      const ta = new Date(
        a.last_message_at || a.updated_at || a.created_at,
      ).getTime();
      const tb = new Date(
        b.last_message_at || b.updated_at || b.created_at,
      ).getTime();
      return tb - ta;
    };

    starred.sort(sortByRecent);
    nonStarred.sort(sortByRecent);

    // Combine starred first, then non-starred, limit to 5 total
    return [...starred, ...nonStarred].slice(0, 5);
  }, [workgroups]);

  // Team Workgroups (non-DM, non-Broadcast)
  const teamWorkgroups = useMemo(
    () =>
      workgroups
        .filter(
          (wg: any) =>
            !(wg.type === "private" && Boolean(wg.settings?.is_direct_chat)) &&
            !Boolean(wg.settings?.is_broadcast),
        )
        .sort((a: any, b: any) => {
          const ta = new Date(
            a.last_message_at || a.updated_at || a.created_at,
          ).getTime();
          const tb = new Date(
            b.last_message_at || b.updated_at || b.created_at,
          ).getTime();
          return tb - ta;
        }),
    [workgroups],
  );

  // Broadcasts
  const broadcasts = useMemo(
    () =>
      workgroups.filter(
        (wg: any) =>
          wg.type === "private" && Boolean(wg.settings?.is_broadcast),
      ),
    [workgroups],
  );

  const totalBroadcastUnread = useMemo(
    () =>
      broadcasts.reduce(
        (sum: number, wg: any) => sum + Number(wg?.unread_count || 0),
        0,
      ),
    [broadcasts],
  );

  const totalDMUnread = useMemo(
    () =>
      workgroups
        .filter(
          (wg: any) =>
            wg.type === "private" && Boolean(wg.settings?.is_direct_chat),
        )
        .reduce(
          (sum: number, wg: any) => sum + Number(wg?.unread_count || 0),
          0,
        ),
    [workgroups],
  );

  const filteredNavigation = useMemo(() => {
    // Permissions removed — all sidebar items visible to all users
    // Only Admin Portal is restricted to admin/super_admin roles

    const role = userRole?.role;
    const isSuperOrAdmin = role === "super_admin" || role === "admin";
    const isMarketingDept = profile?.department?.toLowerCase() === "marketing";
    const hasMarketingAccess =
      isSuperOrAdmin ||
      (["manager", "team_lead", "employee"].includes(role ?? "") &&
        isMarketingDept);
    const hasAutomationAccess = hasMarketingAccess;

    const allItems = (dynamicNavigation || [])
      .filter(Boolean)
      .map((item) => {
        if (!item || !item.title) return null;
        if (item.title === "Admin Portal" && !isAdmin) return null;
        if (item.title === "Marketing" && !hasMarketingAccess) return null;
        if (item.title === "Automation" && !hasAutomationAccess) return null;
        if (item.roles && !item.roles.includes(userRole?.role ?? ""))
          return null;
        return item;
      })
      .filter(Boolean) as NavItem[];

    // Separate bottom items (Admin Portal and Settings)
    const bottomItems = allItems.filter(
      (item) =>
        item && (item.title === "Admin Portal" || item.title === "Settings"),
    );
    const mainItems = allItems.filter(
      (item) =>
        item && item.title !== "Admin Portal" && item.title !== "Settings",
    );

    return { mainItems, bottomItems };
  }, [isAdmin, userRole, profile, dynamicNavigation]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const toggleSubItem = (title: string) => {
    setExpandedSubItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const isActive = (href: string) => {
    const [path, search] = href.split("?");
    if (search) {
      // For URLs with query params, check both path and exact search match
      return location.pathname === path && location.search === `?${search}`;
    }
    // For URLs without query params, only match if no search params in location
    return location.pathname === path && !location.search;
  };
  const isSectionActive = (children?: { href: string }[]) =>
    children?.some((child) => location.pathname.startsWith(child.href));
  const totalWorkgroupUnread = useMemo(
    () =>
      workgroups
        .filter(
          (wg: any) =>
            !(wg.type === "private" && Boolean(wg.settings?.is_direct_chat)) &&
            !Boolean(wg.settings?.is_broadcast),
        )
        .reduce(
          (sum: number, wg: any) => sum + Number(wg?.unread_count || 0),
          0,
        ),
    [workgroups],
  );

  const totalCollaborationUnread = useMemo(
    () => totalWorkgroupUnread + totalBroadcastUnread + totalDMUnread,
    [totalWorkgroupUnread, totalBroadcastUnread, totalDMUnread],
  );

  const toggleCollaborationSection = (title: string) => {
    setOpenCollaborationSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  // Define nested submenus for items that have hasNested flag
  const getDeepNestedItems = (title: string): NestedChild[] => {
    switch (title) {
      case "Signing parties":
        return [
          {
            title: "Contacts",
            href: "/crm/customers/signing-parties/contacts",
          },
        ];
      case "Vendors":
        // Redirect to main inventory vendors page instead of non-existent CRM routes
        return [
          { title: "All Vendors", href: "/inventory/vendors" },
          { title: "Companies", href: "/crm/companies" },
          { title: "Contacts", href: "/crm/contacts" },
        ];
      default:
        return [];
    }
  };

  const toggleNestedItem = (title: string) => {
    setExpandedNestedItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = Math.max(200, Math.min(480, e.clientX));
    onWidthChange?.(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const renderSubItem = (child: NavSubItem, parentTitle?: string) => {
    if (isCollapsed) {
      return (
        <NavLink
          key={child.href}
          to={child.href}
          onClick={() => isMobile && onClose?.()}
          className={cn(
            "flex items-center justify-center rounded-xl h-10 w-10 mx-auto transition-all duration-200",
            isActive(child.href)
              ? "bg-primary/10 text-white"
              : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
          )}
          title={child.title}
        >
          {child.icon && (
            <child.icon
              className={cn(
                "h-5 w-5",
                isActive(child.href)
                  ? "text-primary"
                  : "text-slate-500 group-hover:text-slate-300",
              )}
            />
          )}
        </NavLink>
      );
    }

    const hasNestedChildren =
      child.nestedChildren && child.nestedChildren.length > 0;
    const isExpanded = expandedSubItems.includes(child.title);

    // Special rendering for Workgroups - add Direct Messages below it
    if (child.title === "Workgroups" && parentTitle === "Collaboration") {
      const isDMOpen = openCollaborationSections.includes("Direct Messages");
      const isTeamOpen = openCollaborationSections.includes("Team Groups");
      const isBroadcastOpen = openCollaborationSections.includes("Broadcasts");

      return (
        <div key={child.href}>
          {/* Workgroups Link */}
          <NavLink
            to={child.href}
            onClick={() => isMobile && onClose?.()}
            className={cn(
              "flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-[12px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group",
              isActive(child.href)
                ? "bg-transparent text-white font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            )}
          >
            {child.icon && (
              <div
                className={cn(
                  "grid size-6 place-items-center rounded-md transition-all duration-200 shrink-0",
                  isActive(child.href)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "bg-sidebar-accent/40 text-sidebar-primary group-hover:bg-sidebar-primary/30",
                )}
              >
                <child.icon className="h-3.5 w-3.5" />
              </div>
            )}
            <span className="flex items-center gap-2">
              {child.title}
              {totalWorkgroupUnread + totalBroadcastUnread + totalDMUnread >
                0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-bold text-white ml-auto flex-shrink-0">
                  {totalWorkgroupUnread + totalBroadcastUnread + totalDMUnread}
                </span>
              )}
              {isActive(child.href) && (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary flex-shrink-0" />
              )}
            </span>
          </NavLink>

          {/* Direct Messages Section */}
          <div className="mt-4 mb-2">
            <button
              onClick={() => toggleCollaborationSection("Direct Messages")}
              className="flex w-full items-center justify-between px-9 mb-2.5 group/header focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200",
                    isDMOpen
                      ? "text-primary"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  Direct Chats
                </span>
                {totalDMUnread > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[9px] font-bold text-white">
                    {totalDMUnread}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isDMOpen
                    ? "text-primary"
                    : "text-slate-500 dark:text-slate-600 group-hover/header:text-slate-800 dark:group-hover/header:text-slate-400",
                  !isDMOpen && "-rotate-90",
                )}
              />
            </button>

            {isDMOpen && directMessages.length > 0 && (
              <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {directMessages.map((dm: any) => {
                  const dmPath = `/collaboration/direct-chats?chat=${dm.id}`;
                  const isDMActive =
                    location.pathname === "/collaboration/direct-chats" &&
                    location.search.includes(dm.id);
                  const unreadCount = Number(dm.unread_count || 0);
                  const isOnline = Boolean(dm.is_online);
                  const isStarred = Boolean(dm.is_starred);

                  return (
                    <div key={dm.id} className="group/dm relative">
                      <NavLink
                        to={dmPath}
                        onClick={() => isMobile && onClose?.()}
                        className={cn(
                          "flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-14 text-[13px] transition-all duration-200",
                          isDMActive
                            ? "bg-primary/10 text-white font-medium"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-5 w-5">
                            <AvatarImage
                              src={
                                getAvatarUrl(
                                  dm.avatar_url ||
                                    dm.direct_peer_avatar_url ||
                                    dm.avatar,
                                ) || undefined
                              }
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-[10px]">
                              {(dm.display_name || dm.name || "DM")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-[#0c111d]",
                              isOnline ? "bg-green-500" : "bg-slate-600",
                            )}
                          />
                        </div>
                        <span className="flex-1 truncate">
                          {dm.display_name || dm.name}
                        </span>
                        {unreadCount > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </NavLink>
                      <button
                        onClick={(e) => toggleStarChat(dm.id, e)}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all",
                          isStarred
                            ? "text-yellow-500 opacity-100"
                            : "text-slate-600 opacity-0 group-hover/dm:opacity-100 hover:text-yellow-500",
                        )}
                        title={isStarred ? "Unstar chat" : "Star chat"}
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            isStarred && "fill-yellow-500",
                          )}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteChatId(dm.id);
                        }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded transition-all text-slate-600 opacity-0 group-hover/dm:opacity-100 hover:text-destructive"
                        title="Delete chat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View All Direct Chats Link */}
            {isDMOpen && directMessages.length > 0 && (
              <NavLink
                to="/collaboration/direct-chats"
                onClick={() => isMobile && onClose?.()}
                className={cn(
                  "flex items-center gap-2 rounded-lg py-2 pl-9 pr-3 mt-1 text-[12px] transition-all duration-200",
                  location.pathname === "/collaboration/direct-chats" &&
                    !location.search
                    ? "text-primary font-medium"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>All Chats</span>
                <ArrowRight className="h-3 w-3 ml-auto" />
              </NavLink>
            )}
          </div>

          {/* Team Workgroups Section */}
          <div className="mt-6 mb-2">
            <button
              onClick={() => toggleCollaborationSection("Team Groups")}
              className="flex w-full items-center justify-between px-9 mb-2.5 group/header focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200",
                    isTeamOpen
                      ? "text-primary"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  Team Groups
                </span>
                {totalWorkgroupUnread > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[9px] font-bold text-white">
                    {totalWorkgroupUnread}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isTeamOpen
                    ? "text-primary"
                    : "text-slate-500 dark:text-slate-600 group-hover/header:text-slate-800 dark:group-hover/header:text-slate-400",
                  !isTeamOpen && "-rotate-90",
                )}
              />
            </button>

            {isTeamOpen && teamWorkgroups.length > 0 && (
              <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {teamWorkgroups.slice(0, 8).map((wg: any) => {
                  const wgPath = `/collaboration/workgroups?team=${wg.id}`;
                  const isWGActive =
                    location.pathname === "/collaboration/workgroups" &&
                    location.search.includes(`team=${wg.id}`);
                  const unreadCount = Number(wg.unread_count || 0);
                  const isStarred = Boolean(wg.is_starred);

                  return (
                    <div key={wg.id} className="group/wg relative">
                      <NavLink
                        to={wgPath}
                        onClick={() => isMobile && onClose?.()}
                        className={cn(
                          "flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-8 text-[13px] transition-all duration-200",
                          isWGActive
                            ? "bg-primary/10 text-white font-medium"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-5 w-5">
                            <AvatarImage
                              src={getAvatarUrl(wg.avatar_url) || undefined}
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-[10px]">
                              {(wg.display_name || wg.name)
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {wg.type === "public" && (
                            <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-green-500 border border-[#0c111d]" />
                          )}
                        </div>
                        <span className="flex-1 truncate">
                          {wg.display_name || wg.name}
                        </span>
                        {unreadCount > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </NavLink>
                      <button
                        onClick={(e) => toggleStarChat(wg.id, e)}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all",
                          isStarred
                            ? "text-yellow-500 opacity-100"
                            : "text-slate-600 opacity-0 group-hover/wg:opacity-100 hover:text-yellow-500",
                        )}
                        title={
                          isStarred ? "Unstar workgroup" : "Star workgroup"
                        }
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            isStarred && "fill-yellow-500",
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View All Workgroups Link */}
            {isTeamOpen && teamWorkgroups.length > 0 && (
              <NavLink
                to="/collaboration/workgroups"
                onClick={() => isMobile && onClose?.()}
                className={cn(
                  "flex items-center gap-2 rounded-lg py-2 pl-9 pr-3 mt-1 text-[12px] transition-all duration-200",
                  location.pathname === "/collaboration/workgroups" &&
                    !location.pathname.includes("/workgroups/")
                    ? "text-primary font-medium"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span>All Teams</span>
                <ArrowRight className="h-3 w-3 ml-auto" />
              </NavLink>
            )}
          </div>

          {/* Broadcasts Section */}
          <div className="mt-6 mb-2">
            <button
              onClick={() => toggleCollaborationSection("Broadcasts")}
              className="flex w-full items-center justify-between px-9 mb-2.5 group/header focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200",
                    isBroadcastOpen
                      ? "text-primary"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  Broadcasts
                </span>
                {totalBroadcastUnread > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[9px] font-bold text-white">
                    {totalBroadcastUnread}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isBroadcastOpen
                    ? "text-primary"
                    : "text-slate-500 dark:text-slate-600 group-hover/header:text-slate-800 dark:group-hover/header:text-slate-400",
                  !isBroadcastOpen && "-rotate-90",
                )}
              />
            </button>

            {isBroadcastOpen && (
              <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                {broadcasts.length > 0 ? (
                  broadcasts.map((bc: any) => {
                    const bcPath = `/collaboration/broadcast?team=${bc.id}`;
                    const isBCActive =
                      location.pathname === "/collaboration/broadcast" &&
                      location.search.includes(`team=${bc.id}`);
                    const unreadCount = Number(bc.unread_count || 0);

                    return (
                      <div key={bc.id} className="group/bc relative">
                        <NavLink
                          to={bcPath}
                          onClick={() => isMobile && onClose?.()}
                          className={cn(
                            "flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-8 text-[13px] transition-all duration-200",
                            isBCActive
                              ? "bg-primary/10 text-white font-medium"
                              : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                          )}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage
                              src={getAvatarUrl(bc.avatar_url) || undefined}
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-[10px]">
                              {(bc.display_name || bc.name)
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">
                            {bc.display_name || bc.name}
                          </span>
                          {unreadCount > 0 && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </NavLink>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-9 py-2 text-[11px] text-slate-600 italic">
                    No active broadcasts
                  </p>
                )}

                <NavLink
                  to="/collaboration/broadcast"
                  onClick={() => isMobile && onClose?.()}
                  className={cn(
                    "flex items-center gap-2 rounded-lg py-2 pl-9 pr-3 mt-1 text-[12px] transition-all duration-200",
                    location.pathname === "/collaboration/broadcast" &&
                      !location.search
                      ? "text-primary font-medium"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  <span>All Broadcasts</span>
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </NavLink>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── Unibox campaigns in sidebar ──
    if (child.title === "Unibox" && parentTitle === "CRM") {
      const isUniboxExpanded = expandedSubItems.includes("Unibox");

      return (
        <div key={child.href} className="group/submenu">
          <button
            onClick={(e) => {
              e.preventDefault();
              const isCurrentlyExpanded = expandedSubItems.includes("Unibox");
              toggleSubItem("Unibox");
              // Navigate to All Emails when expanding, or when already on unibox with campaign selected
              if (
                !isCurrentlyExpanded ||
                location.search.includes("campaign_id")
              ) {
                if (hasFullUniboxAccess) {
                  navigate("/crm/unibox");
                }
              }
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-xl py-2 pl-9 pr-3 text-[13px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              location.pathname.startsWith("/crm/unibox")
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]",
            )}
          >
            <div className="flex items-center gap-3">
              {child.icon && (
                <child.icon
                  className={cn(
                    "h-4 w-4",
                    location.pathname.startsWith("/crm/unibox")
                      ? "text-primary"
                      : "text-slate-500",
                  )}
                />
              )}
              <span>Unibox</span>
            </div>
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform duration-300 text-slate-600",
                isUniboxExpanded && "rotate-90 text-white",
              )}
            />
          </button>

          {isUniboxExpanded && (
            <div className="ml-6 mt-1.5 space-y-1.5 border-l border-white/5 pl-4 animate-in slide-in-from-left-2 duration-300">
              {hasFullUniboxAccess && (
                <NavLink
                  to="/crm/unibox"
                  onClick={() => isMobile && onClose?.()}
                  className={cn(
                    "flex items-center rounded-lg py-1.5 pl-3 pr-2 text-[12px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    location.pathname === "/crm/unibox" &&
                      !location.search.includes("campaign_id")
                      ? "text-primary font-bold bg-primary/5"
                      : "text-slate-600 dark:text-slate-500 hover:text-primary dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.02]",
                  )}
                >
                  All Emails
                </NavLink>
              )}

              <UniboxCampaignSidebar
                onMobileClose={isMobile ? onClose : undefined}
                isOwner={canManageUniboxFolders}
                hasFullAccess={hasFullUniboxAccess}
              />
            </div>
          )}
        </div>
      );
    }

    if (hasNestedChildren) {
      return (
        <div key={child.href} className="group/submenu">
          <NavLink
            to={child.href}
            onClick={(e) => {
              if (hasNestedChildren) {
                e.preventDefault();
                toggleSubItem(child.title);
              }
            }}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl py-2 pl-9 pr-3 text-[13px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive(child.href) || location.pathname.startsWith(child.href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]",
            )}
          >
            <div className="flex items-center gap-3">
              {child.icon && (
                <child.icon
                  className={cn(
                    "h-4 w-4",
                    isActive(child.href) ||
                      location.pathname.startsWith(child.href)
                      ? "text-primary"
                      : "text-slate-500",
                  )}
                />
              )}
              <span>{child.title}</span>
            </div>
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform duration-300 text-slate-600",
                isExpanded && "rotate-90 text-white",
              )}
            />
          </NavLink>

          {isExpanded && (
            <div className="ml-6 mt-1.5 space-y-1.5 border-l border-white/5 pl-4 animate-in slide-in-from-left-2 duration-300">
              {child.nestedChildren!.map((nested) => {
                const deepNested = nested.hasNested
                  ? getDeepNestedItems(nested.title)
                  : [];
                const hasDeepNested = deepNested.length > 0;
                const isNestedExpanded = expandedNestedItems.includes(
                  nested.title,
                );

                if (hasDeepNested) {
                  return (
                    <div key={nested.href}>
                      <button
                        onClick={() => toggleNestedItem(nested.title)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg py-1.5 pl-3 pr-2 text-[12px] font-medium transition-all",
                          isActive(nested.href)
                            ? "text-primary bg-primary/10"
                            : "text-slate-600 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5",
                        )}
                      >
                        <span>{nested.title}</span>
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform duration-300",
                            isNestedExpanded && "rotate-90",
                          )}
                        />
                      </button>

                      {isNestedExpanded && (
                        <div className="ml-3 mt-1.5 space-y-1 border-l border-slate-200 dark:border-white/5 pl-3 animate-in fade-in duration-300">
                          {deepNested.map((deep) => (
                            <NavLink
                              key={deep.href}
                              to={deep.href}
                              className={cn(
                                "flex items-center rounded-lg py-1.5 pl-3 pr-2 text-[11px] transition-all",
                                isActive(deep.href)
                                  ? "text-primary dark:text-white font-bold"
                                  : "text-slate-600 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-300",
                              )}
                            >
                              {deep.title}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={nested.href}
                    to={nested.href}
                    className={cn(
                      "flex items-center rounded-lg py-1.5 pr-2 text-[12px] transition-all",
                      isActive(nested.href)
                        ? "text-primary font-bold bg-primary/5 border-l-2 border-primary pl-2.5"
                        : "pl-3 text-slate-600 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.02]",
                    )}
                  >
                    {nested.title}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={child.href}
        to={child.href}
        onClick={() => isMobile && onClose?.()}
        className={cn(
          "flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-[12px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group",
          isActive(child.href)
            ? "bg-transparent text-white font-medium"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
        )}
      >
        {child.icon && (
          <div
            className={cn(
              "grid size-6 place-items-center rounded-md transition-all duration-200 shrink-0",
              isActive(child.href)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-sidebar-accent/40 text-sidebar-primary group-hover:bg-sidebar-primary/30",
            )}
          >
            <child.icon className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="truncate">{child.title}</span>
          {child.title === "Workgroups" && totalWorkgroupUnread > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-bold text-white ml-auto flex-shrink-0">
              {totalWorkgroupUnread}
            </span>
          )}
          {isActive(child.href) && (
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary flex-shrink-0" />
          )}
        </span>
      </NavLink>
    );
  };

  const isCollapsed = !isMobile && width <= 80;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out",
        "light:bg-[#F1F6F6] light:text-[#032124] light:border-[#2DD4BF]/15",
        isMobile
          ? isOpen
            ? "translate-x-0"
            : "-translate-x-full"
          : "translate-x-0",
      )}
      style={{ width: `${width}px` }}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "p-4 border-b border-sidebar-primary/20",
          isCollapsed &&
            "px-2 py-3 flex flex-col items-center justify-center ml-5",
        )}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 focus-outline-none">
            <Logo className="h-9 w-9 text-sidebar-primary shrink-0 bg-transparent" />
            {!isCollapsed && (
              <div className="flex flex-col font-serif">
                <span className="text-base font-bold tracking-widest text-white leading-none uppercase">
                  ELINA
                </span>
                <span className="text-[9px] text-sidebar-primary font-sans font-semibold mt-1 tracking-[0.2em] leading-none uppercase">
                  SMART
                </span>
              </div>
            )}
          </div>
          {!isMobile && (
            <button
              onClick={() => onWidthChange?.(isCollapsed ? 256 : 80)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c111d] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-md active:scale-95 transition-all",
                isCollapsed && "mt-3",
              )}
            >
              {isCollapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        )}

        {!isCollapsed && (
          <div className="h-px w-full bg-gradient-to-r from-sidebar-primary/20 to-transparent mt-4" />
        )}
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 pb-4 space-y-6 pt-10">
        {/* Back to Dashboard Button - Show when a module is focused */}
        {focusedModule && (
          <Button
            className={cn(
              "w-full justify-start gap-2 mb-2  bg-transparent border-2 border-sidebar-primary text-white hover:bg-sidebar-accent/30 hover:border-sidebar-primary rounded-full px-3 py-2",
              isCollapsed &&
                "w-10 h-10 ml-5 p-0 justify-center rounded-lg mb-1 border-sidebar-primary bg-transparent",
            )}
            onClick={() => {
              navigate("/");
              setFocusedModule(null);
            }}
            title="Back to Dashboard"
          >
            <ArrowLeft
              className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")}
            />
            {!isCollapsed && (
              <span className="text-[12px] font-bold ">Back to Dashboard</span>
            )}
          </Button>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        >
          <SortableContext
            items={(orderedNavigation || [])
              .filter(
                (item) =>
                  item &&
                  filteredNavigation.mainItems.some(
                    (fi) => fi && fi.title === item.title,
                  ),
              )
              .map((item) => item.title)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {(finalOrderedNavigation || [])
                .filter(
                  (item) =>
                    item &&
                    filteredNavigation.mainItems.some(
                      (fi) => fi && fi.title === item.title,
                    ),
                )
                .map((item) => {
                  // If a module is focused, only show that module's children
                  if (focusedModule && item.title !== focusedModule) {
                    return null;
                  }

                  // If focused on this module, show its children directly
                  if (focusedModule === item.title && item.children) {
                    return (
                      <div key={item.title} className="space-y-1">
                        {/* Module Header - with border and rounded styling - FRONTEND-ELINA STYLE */}
                        <div
                          className={cn(
                            "flex items-center justify-between rounded-full border-2 border-sidebar-primary px-3 py-2 bg-sidebar-primary text-sidebar-primary-foreground shadow-md light:border-[#2DD4BF]",
                            isCollapsed &&
                              "px-2 py-1.5 justify-center rounded-lg",
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 min-w-0",
                              isCollapsed && "flex-col gap-1",
                            )}
                          >
                            <div className="grid size-5 place-items-center rounded-md text-sidebar-primary-foreground shrink-0">
                              <item.icon className="size-3.5" />
                            </div>
                            {!isCollapsed && (
                              <span className="text-[12px] font-bold text-sidebar-primary-foreground truncate max-w-[120px]">
                                {item.title === "Projects" && activeProject
                                  ? activeProject.name
                                  : item.title}
                              </span>
                            )}
                          </div>
                          {!isCollapsed && (
                            <>
                              {item.title === "Collaboration" &&
                                totalCollaborationUnread > 0 && (
                                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-lg shadow-red-600/20">
                                    {totalCollaborationUnread}
                                  </span>
                                )}
                              <ChevronRight className="h-3.5 w-3.5 text-sidebar-primary-foreground shrink-0" />
                            </>
                          )}
                        </div>
                        {/* Sub-modules */}
                        {item.children
                          .filter((child) => {
                            if (
                              child.roles &&
                              !child.roles.includes(userRole?.role ?? "")
                            ) {
                              return false;
                            }
                            if (child.title === "Communications") {
                              const role = userRole?.role;
                              const dept = profile?.department?.toLowerCase();
                              return (
                                role === "super_admin" ||
                                role === "admin" ||
                                dept === "sales" ||
                                dept === "marketing"
                              );
                            }
                            return true;
                          })
                          .map((child) => renderSubItem(child, item.title))}
                      </div>
                    );
                  }

                  // Default view - show all modules as sortable items
                  return (
                    <SortableNavItem
                      key={item.title}
                      item={item}
                      isActive={isActive}
                      isSectionActive={isSectionActive}
                      openSections={openSections}
                      toggleSection={setFocusedModule}
                      renderSubItem={renderSubItem}
                      isMobile={isMobile}
                      onClose={onClose}
                      isCollapsed={isCollapsed}
                      onWidthChange={onWidthChange}
                      badge={
                        item.title === "Collaboration"
                          ? totalCollaborationUnread > 0
                            ? totalCollaborationUnread.toString()
                            : undefined
                          : item.badge
                      }
                    />
                  );
                })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Bottom Fixed Items - Admin Portal & Settings */}
      {!focusedModule && (
        <div className="border-t border-white/5 px-4 py-3 space-y-1">
          {/* {!isElectron &&
            !(
              typeof window !== "undefined" &&
              (window as any).Capacitor?.isNative
            ) && (
              <NavLink
                to="/desktop-app"
                onClick={() => isMobile && onClose?.()}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 mb-1",
                  isActive("/desktop-app")
                    ? "bg-primary/10 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                )}
              >
                <div className="flex items-center gap-3">
                  <Laptop
                    className={cn(
                      "h-4 w-4",
                      isActive("/desktop-app")
                        ? "text-primary"
                        : "text-slate-500",
                    )}
                  />
                  <span>Try our new Desktop & Mobile apps</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              </NavLink>
            )} */}

          {filteredNavigation.bottomItems.map((item) => {
            if (isCollapsed) {
              if (item.children) {
                const sectionActive = isSectionActive(item.children);
                return (
                  <button
                    key={item.title}
                    onClick={() => {
                      setFocusedModule(item.title);
                      onWidthChange?.(256);
                    }}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
                      sectionActive
                        ? "bg-primary/10 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                    )}
                    title={item.title}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5",
                        sectionActive ? "text-primary" : "text-slate-500",
                      )}
                    />
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.href}
                  to={item.href!}
                  onClick={() => isMobile && onClose?.()}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
                    isActive(item.href!)
                      ? "bg-primary/10 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                  )}
                  title={item.title}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive(item.href!) ? "text-primary" : "text-slate-500",
                    )}
                  />
                </NavLink>
              );
            }

            if (item.children) {
              const sectionActive = isSectionActive(item.children);

              return (
                <button
                  key={item.title}
                  onClick={() => setFocusedModule(item.title)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group",
                    sectionActive
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-colors duration-200",
                        sectionActive
                          ? "text-primary"
                          : "text-slate-500 group-hover:text-primary dark:group-hover:text-slate-300",
                      )}
                    />
                    <span>{item.title}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              );
            }

            return (
              <NavLink
                key={item.href}
                to={item.href!}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group",
                  isActive(item.href!)
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]",
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "h-4 w-4 transition-colors duration-200",
                      isActive(item.href!)
                        ? "text-primary"
                        : "text-slate-500 group-hover:text-primary dark:group-hover:text-slate-300",
                    )}
                  />
                  <span>{item.title}</span>
                </div>
              </NavLink>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!deleteChatId}
        onOpenChange={(open) => !open && setDeleteChatId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteChatId) {
                  deleteWg.mutate(deleteChatId, {
                    onSuccess: () => setDeleteChatId(null),
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteWg.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resize Handle - Only for desktop */}
      {!isMobile && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute right-0 top-0 w-1 h-full cursor-col-resize transition-all duration-200 group-hover:bg-primary/20",
            isResizing
              ? "bg-primary w-1.5 opacity-100"
              : "opacity-0 hover:opacity-100 hover:bg-primary/40",
          )}
        />
      )}
    </aside>
  );
}

function SortableNavItem({
  item,
  isActive,
  isSectionActive,
  openSections,
  toggleSection,
  renderSubItem,
  isMobile,
  onClose,
  isCollapsed,
  onWidthChange,
  badge,
}: {
  item: NavItem;
  isActive: (href: string) => boolean;
  isSectionActive: (children?: { href: string }[]) => boolean | undefined;
  openSections: string[];
  toggleSection: (title: string) => void;
  renderSubItem: (child: NavSubItem, parentTitle?: string) => React.ReactNode;
  isMobile?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onWidthChange?: (width: number) => void;
  badge?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.title });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isCollapsed) {
    if (item.children) {
      const sectionActive = isSectionActive(item.children);
      return (
        <div ref={setNodeRef} style={style}>
          <button
            onClick={() => {
              toggleSection(item.title);
              onWidthChange?.(256);
            }}
            className={cn(
              "flex size-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
              sectionActive
                ? "bg-primary/10 text-primary"
                : "text-slate-400 hover:text-white hover:bg-white/5",
            )}
            title={item.title}
          >
            <item.icon
              className={cn(
                "h-5 w-5",
                sectionActive ? "text-primary" : "text-slate-500",
              )}
            />
          </button>
        </div>
      );
    }

    return (
      <div ref={setNodeRef} style={style}>
        <NavLink
          to={item.href!}
          onClick={() => isMobile && onClose?.()}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
            isActive(item.href!)
              ? "bg-primary/10 text-primary"
              : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
          )}
          title={item.title}
        >
          <item.icon
            className={cn(
              "h-5 w-5",
              isActive(item.href!) ? "text-primary" : "text-slate-500",
            )}
          />
        </NavLink>
      </div>
    );
  }

  if (item.children) {
    const sectionActive = isSectionActive(item.children);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn("group/sortable", isDragging && "pointer-events-none")}
      >
        <div className="flex items-center group">
          <button
            {...attributes}
            {...listeners}
            className="p-1 opacity-0 group-hover/sortable:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => toggleSection(item.title)}
            className={cn(
              "flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group",
              sectionActive
                ? "bg-transparent text-white"
                : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/30",
            )}
          >
            <div className="flex flex-1 items-center justify-between mr-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-lg transition-all duration-200",
                    sectionActive
                      ? "bg-sidebar-primary/80 text-sidebar-primary-foreground"
                      : "bg-sidebar-accent/40 text-sidebar-primary group-hover:bg-sidebar-primary/30",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                </div>
                <span>{item.title}</span>
              </div>
              {badge && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-bold text-white shadow-lg shadow-red-600/20">
                  {badge}
                </span>
              )}
            </div>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group/sortable", isDragging && "pointer-events-none")}
    >
      <div className="flex items-center group">
        <button
          {...attributes}
          {...listeners}
          className="p-1 opacity-0 group-hover/sortable:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <NavLink
          to={item.href!}
          onClick={() => isMobile && onClose?.()}
          className={cn(
            "flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group",
            isActive(item.href!)
              ? "bg-primary/10 text-primary"
              : "text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]",
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon
              className={cn(
                "h-4 w-4 transition-colors duration-200",
                isActive(item.href!)
                  ? "text-primary"
                  : "text-slate-500 group-hover:text-primary dark:group-hover:text-slate-300",
              )}
            />
            <span>{item.title}</span>
          </div>
          {item.badge && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[9px] font-black text-white shadow-lg shadow-primary/20">
              {item.badge}
            </span>
          )}
        </NavLink>
      </div>
    </div>
  );
}
