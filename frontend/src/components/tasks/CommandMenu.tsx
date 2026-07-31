import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Plus, Search, LayoutGrid, List, Calendar,
  FolderKanban, Inbox, Star, TrendingUp, CheckCircle2,
} from "lucide-react";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: () => void;
  onCreateProject: () => void;
  onChangeView: (view: "list" | "board" | "calendar") => void;
  onChangeFilter: (filter: "inbox" | "today" | "upcoming" | "starred") => void;
}

export function CommandMenu({
  open,
  onOpenChange,
  onCreateTask,
  onCreateProject,
  onChangeView,
  onChangeFilter,
}: CommandMenuProps) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(onCreateTask)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New Task</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>N
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onCreateProject)}>
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Create New Project</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>P
            </kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Views">
          <CommandItem onSelect={() => runCommand(() => onChangeView("list"))}>
            <List className="mr-2 h-4 w-4" />
            <span>List View</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              1
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onChangeView("board"))}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Board View</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              2
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onChangeView("calendar"))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Calendar View</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              3
            </kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Filters">
          <CommandItem onSelect={() => runCommand(() => onChangeFilter("inbox"))}>
            <Inbox className="mr-2 h-4 w-4" />
            <span>Inbox</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onChangeFilter("today"))}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>Today</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onChangeFilter("upcoming"))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Upcoming</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onChangeFilter("starred"))}>
            <Star className="mr-2 h-4 w-4" />
            <span>Starred</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
