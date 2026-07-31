import { useState, useMemo } from "react";
import { Search, Award } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/hooks/useEmployees";
import { useProjectMilestones } from "@/hooks/useProjectManagement";
import { MilestoneAssignDialog } from "@/components/projects/MilestoneAssignDialog";

interface EmployeeMilestone {
    id: string;
    name: string;
    status: "pending" | "in_progress" | "completed";
    due_date: string | null;
    project_id: string;
    project_name?: string;
}

export default function MilestonesMarksPage() {
    const { data: employees = [] } = useEmployees();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    // Get all projects to fetch milestones
    const projectIds = ["all"]; // You might need to fetch all projects first

    // For now, we'll create a component that can be used in different contexts
    const filteredEmployees = useMemo(() => {
        return employees.filter(
            (emp: any) =>
                emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [employees, searchQuery]);

    const getInitials = (name: string) =>
        name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-success/20 text-success border-success";
            case "in_progress":
                return "bg-chart-1/20 text-chart-1 border-chart-1";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    };

    const getStatusLabel = (status: string) => {
        return status.replace(/_/g, " ");
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Award className="h-6 w-6 text-primary" />
                        <h1 className="text-3xl font-bold">Milestones & Marks</h1>
                    </div>
                    <p className="text-muted-foreground">
                        View and manage employee milestone assignments
                    </p>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search employees by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Employees Grid */}
                <div className="grid gap-4">
                    {filteredEmployees.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No employees found</p>
                        </div>
                    ) : (
                        filteredEmployees.map((employee: any) => (
                            <div
                                key={employee.id}
                                className="border border-border rounded-lg bg-card p-4 hover:shadow-md transition"
                            >
                                {/* Employee Header */}
                                <div className="flex items-center gap-4 mb-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={employee.avatar_url} />
                                        <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-base">
                                            {employee.full_name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {employee.email}
                                        </p>
                                    </div>
                                    <Badge variant="outline">{employee.designation || "Employee"}</Badge>
                                </div>

                                {/* Employee Milestones */}
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <p className="text-xs font-medium text-muted-foreground mb-3">
                                        Assigned Milestones
                                    </p>

                                    <div className="space-y-2">
                                        {!employee.assignedMilestones ||
                                            employee.assignedMilestones.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">
                                                No milestones assigned
                                            </p>
                                        ) : (
                                            employee.assignedMilestones.map((milestone: EmployeeMilestone) => (
                                                <div
                                                    key={milestone.id}
                                                    className="flex items-center justify-between p-2 rounded bg-background border border-border"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {milestone.name}
                                                        </p>
                                                        {milestone.project_name && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {milestone.project_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-2 shrink-0">
                                                        {milestone.due_date && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(milestone.due_date).toLocaleDateString(
                                                                    "en-US",
                                                                    { month: "short", day: "numeric" }
                                                                )}
                                                            </span>
                                                        )}
                                                        <Badge
                                                            variant="outline"
                                                            className={getStatusColor(milestone.status)}
                                                        >
                                                            {getStatusLabel(milestone.status)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-3 text-xs"
                                        onClick={() => {
                                            setSelectedMilestone({
                                                id: employee.id,
                                                name: employee.full_name,
                                            });
                                            setAssignDialogOpen(true);
                                        }}
                                    >
                                        Manage Milestones
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Assignment Dialog */}
            {selectedMilestone && (
                <MilestoneAssignDialog
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    milestoneId={selectedMilestone.id}
                    milestoneName={selectedMilestone.name}
                />
            )}
        </div>
    );
}
