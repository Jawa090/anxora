import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, Award, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Milestone {
    id: string;
    name: string;
    status?: string;
}

interface MilestoneMultiSelectProps {
    milestones: Milestone[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function MilestoneMultiSelect({
    milestones,
    selectedIds,
    onChange,
    disabled = false,
    placeholder = "Select milestones...",
}: MilestoneMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = useMemo(
        () => milestones.filter((m) => selectedIds.includes(m.id)),
        [milestones, selectedIds]
    );

    const filtered = useMemo(
        () =>
            milestones.filter(
                (m) =>
                    m.name.toLowerCase().includes(search.toLowerCase()) &&
                    !selectedIds.includes(m.id)
            ),
        [milestones, search, selectedIds]
    );

    const handleToggle = (id: string) => {
        onChange(
            selectedIds.includes(id)
                ? selectedIds.filter((sid) => sid !== id)
                : [...selectedIds, id]
        );
    };

    const handleRemove = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selectedIds.filter((sid) => sid !== id));
    };

    return (
        <Popover
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) setSearch("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className="w-full justify-between font-normal h-auto min-h-10 px-3 py-2"
                >
                    <span className="flex items-center gap-2 flex-wrap">
                        {selected.length > 0 ? (
                            selected.map((m) => (
                                <Badge
                                    key={m.id}
                                    variant="secondary"
                                    className="gap-1"
                                >
                                    <Award className="h-3 w-3" />
                                    {m.name}
                                    <button
                                        onClick={(e) => handleRemove(m.id, e)}
                                        className="ml-1 hover:opacity-70"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                {/* Search Input */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                        placeholder="Search milestone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-7 border-0 p-0 focus-visible:ring-0 bg-transparent text-sm"
                        autoFocus
                    />
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto py-1">
                    {milestones.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No milestones available
                        </div>
                    ) : filtered.length === 0 && selectedIds.length < milestones.length ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No matching milestones
                        </div>
                    ) : (
                        filtered.map((milestone) => (
                            <button
                                key={milestone.id}
                                onClick={() => handleToggle(milestone.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(milestone.id)}
                                    onChange={() => handleToggle(milestone.id)}
                                    className="h-4 w-4"
                                />
                                <Award className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate text-left">
                                    {milestone.name}
                                </span>
                                {milestone.status && (
                                    <span className="text-xs text-muted-foreground capitalize">
                                        {milestone.status.replace(/_/g, " ")}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
