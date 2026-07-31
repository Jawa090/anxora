import { useState } from "react";
import { Check, ChevronsUpDown, FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Project } from "@/hooks/useTasks";

interface ProjectSearchSelectProps {
    projects: Project[];
    value: string; // selected project id, "" = none
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ProjectSearchSelect({
    projects,
    value,
    onChange,
    disabled = false,
    placeholder = "None",
}: ProjectSearchSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = projects.find((p) => p.id === value);

    const filtered = projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (id: string) => {
        onChange(id === value ? "" : id);
        setOpen(false);
        setSearch("");
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
                    className="w-full justify-between font-normal h-10 px-3"
                >
                    <span className="flex items-center gap-2 truncate">
                        {selected ? (
                            <>
                                <div
                                    className={cn(
                                        "h-3 w-3 rounded-full shrink-0",
                                        selected.color || "bg-primary"
                                    )}
                                />
                                <span className="truncate">{selected.name}</span>
                            </>
                        ) : (
                            <>
                                <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">{placeholder}</span>
                            </>
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
                        placeholder="Search project..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-7 border-0 p-0 focus-visible:ring-0 bg-transparent text-sm"
                        autoFocus
                    />
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto py-1">
                    {/* None option */}
                    <button
                        onClick={() => handleSelect("")}
                        className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                            !value && "bg-primary/5 text-primary font-medium"
                        )}
                    >
                        <Check
                            className={cn(
                                "h-4 w-4 shrink-0",
                                !value ? "opacity-100 text-primary" : "opacity-0"
                            )}
                        />
                        <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>None</span>
                    </button>

                    {filtered.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            No projects found
                        </div>
                    ) : (
                        filtered.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => handleSelect(project.id)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                                    value === project.id && "bg-primary/5 text-primary font-medium"
                                )}
                            >
                                <Check
                                    className={cn(
                                        "h-4 w-4 shrink-0",
                                        value === project.id ? "opacity-100 text-primary" : "opacity-0"
                                    )}
                                />
                                <div
                                    className={cn(
                                        "h-3 w-3 rounded-full shrink-0",
                                        project.color || "bg-primary"
                                    )}
                                />
                                <span className="truncate">{project.name}</span>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
