import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableSectionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  editing?: boolean;
}

export function DroppableSection({ id, children, className, editing }: DroppableSectionProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        "relative transition-all duration-200",
        editing && !children && "min-h-[60px] border-2 border-dashed border-muted-foreground/20 rounded-xl flex items-center justify-center bg-muted/5 group-hover:bg-muted/10",
        isOver && editing && "ring-2 ring-primary ring-offset-4 bg-primary/5 rounded-xl z-10 scale-[1.01]"
      )}
    >
      {editing && !children && (
        <div className="flex flex-col items-center gap-1 opacity-40">
          <p className="text-xs font-medium">Drop fields here</p>
        </div>
      )}
      {children}
    </div>
  );
}
