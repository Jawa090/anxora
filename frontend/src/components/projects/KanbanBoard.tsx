import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const KANBAN_COLS = [
  { id: "backlog", label: "Backlog", dot: "bg-slate-100", header: "bg-primary/40 border-slate-500/20" },
  { id: "todo", label: "To Do", dot: "bg-blue-400", header: "bg-blue-500/40 border-blue-500/20" },
  { id: "in_progress", label: "In Progress", dot: "bg-amber-400", header: "bg-amber-500/40 border-amber-500/20" },
  { id: "review", label: "In Review", dot: "bg-purple-400", header: "bg-purple-500/40 border-purple-500/20" },
  { id: "testing", label: "QA / Testing", dot: "bg-rose-400", header: "bg-rose-500/40 border-rose-500/20" },
  { id: "done", label: "Done", dot: "bg-emerald-400", header: "bg-emerald-500/40 border-emerald-500/20" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  normal: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function normalizeStatus(status: string): string {
  if (status === "new" || status === "todo") return "todo";
  if (status === "completed") return "done";
  return status;
}

// ─── Draggable Task Card ───────────────────────────────────────────────────────

interface TaskCardProps {
  task: any;
  getMemberName: (uid: string | null) => string;
  onClick: (task: any) => void;
  isDragging?: boolean;
}

function TaskCard({ task, getMemberName, onClick, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.35 : 1,
  };

  const priority = task.priority || "normal";
  const assigneeName = task.assigned_to_name || getMemberName(task.assigned_to);
  const assigneeAvatar = task.assigned_to_avatar;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        onClick={() => onClick(task)}
        className={cn(
          "border-slate-800/70 rounded-xl shadow-md bg-slate-800 dark:bg-[#131B2E] p-3.5 space-y-2.5 cursor-pointer",
          "hover:border-primary-500/40 hover:shadow-primary/10 hover:shadow-lg hover:-translate-y-0.5",
          "transition-all duration-150 select-none h-[160px] flex flex-col",
          isDragging && "shadow-2xl shadow-primary/20 border-primary-500/50 rotate-1 scale-105"
        )}
      >
        {/* Drag handle + priority */}
        <div className="flex items-center justify-between">
          <Badge className={cn("text-[8px] uppercase tracking-wider font-extrabold border px-1.5 py-0.5 ", PRIORITY_COLORS[priority])}>
            {priority}
          </Badge>
          <div
            {...listeners}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-white hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-grab active:cursor-grabbing"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Title */}
        <p className="text-xs font-bold text-slate-100 leading-snug line-clamp-2">
          {task.title}
        </p>

        {/* Description */}
        {task.description && (
          <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/40 mt-auto">
          {task.due_date ? (
            <span className="text-[9.5px] text-slate-400 flex items-center gap-1 font-medium">
              <CalendarDays className="h-3 w-3 opacity-60" />
              {format(new Date(task.due_date), "MMM d")}
            </span>
          ) : <span />}

          {assigneeName && assigneeName !== "Unassigned" ? (
            <Avatar className="h-5 w-5 border border-slate-700">
              {assigneeAvatar && <AvatarImage src={assigneeAvatar} alt={assigneeName} />}
              <AvatarFallback className="text-[7px] font-black bg-blue-500/15 text-blue-400">
                {getInitials(assigneeName)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-5 w-5 rounded-full border border-dashed border-slate-700" />
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

interface ColumnProps {
  col: typeof KANBAN_COLS[0];
  tasks: any[];
  getMemberName: (uid: string | null) => string;
  onTaskClick: (task: any) => void;
  onAddTask: (colId: string) => void;
  isOver?: boolean;
}

function KanbanColumn({ col, tasks, getMemberName, onTaskClick, onAddTask, isOver }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: col.id,
  });
  const taskIds = tasks.map(t => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[288px] flex-shrink-0 rounded-2xl border flex flex-col transition-all duration-150",
        "bg-slate-900/60 dark:bg-[#0f1929]/60 backdrop-blur-sm",
        isOver
          ? "border-white/50 bg-white/20 shadow-lg shadow-white/10"
          : "border-slate-800/50"
      )}
    >
      {/* Column header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-t-2xl border-b", col.header)}>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", col.dot)} />
          <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wide">{col.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] font-black px-2 py-0.5 rounded-full",
            tasks.length > 0 ? "bg-slate-700 text-slate-300" : "text-white"
          )}>
            {tasks.length}
          </span>
          <button
            onClick={() => onAddTask(col.id)}
            className="h-5 w-5 rounded-md flex items-center justify-center text-white hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card list */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={cn(
          "flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px] transition-colors duration-150",
          isOver && tasks.length === 0 && "bg-blue-500/5 rounded-b-2xl"
        )}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              getMemberName={getMemberName}
              onClick={onTaskClick}
            />
          ))}

          {tasks.length === 0 && !isOver && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-8 w-8 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center mb-2">
                <Plus className="h-4 w-4 text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-600 font-medium">Drop tasks here</p>
            </div>
          )}

          {isOver && (
            <div className="h-16 rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-500/5 flex items-center justify-center">
              <p className="text-[10px] text-blue-400 font-bold">Release to drop</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Main KanbanBoard ──────────────────────────────────────────────────────────

interface KanbanBoardProps {
  tasks: any[];
  getMemberName: (uid: string | null) => string;
  onTaskClick: (task: any) => void;
  onAddTask: (initialStatus?: string) => void;
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
}

export function KanbanBoard({
  tasks,
  getMemberName,
  onTaskClick,
  onAddTask,
  onTaskStatusChange,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Optimistic local task list for instant UI feedback
  const [localTasks, setLocalTasks] = useState<any[]>([]);
  const effectiveTasks = localTasks.length ? localTasks : tasks;

  // Sync when server tasks change
  const [prevTasks, setPrevTasks] = useState<any[]>([]);
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setLocalTasks(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  // Group tasks by column
  const tasksByCol = useMemo(() => {
    const map: Record<string, any[]> = {};
    KANBAN_COLS.forEach(c => { map[c.id] = []; });
    effectiveTasks.forEach(task => {
      const status = normalizeStatus(task.status);
      if (map[status]) map[status].push(task);
      else map["backlog"].push(task);
    });
    return map;
  }, [effectiveTasks]);

  // Find which column a task belongs to
  const findColumnOfTask = useCallback((taskId: string): string | null => {
    for (const col of KANBAN_COLS) {
      if (tasksByCol[col.id]?.some(t => t.id === taskId)) return col.id;
    }
    return null;
  }, [tasksByCol]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = effectiveTasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Find source column of the dragged task
    const sourceCol = findColumnOfTask(activeTaskId);

    // Determine target column: overId can be a column ID or a task ID
    let targetCol: string | null = null;
    if (KANBAN_COLS.some(c => c.id === overId)) {
      targetCol = overId;
    } else {
      targetCol = findColumnOfTask(overId);
    }

    if (!targetCol || !sourceCol) return;
    if (sourceCol === targetCol && activeTaskId === overId) return;

    // Map column id back to actual status value
    const newStatus = targetCol === "done" ? "completed" : targetCol;

    // Optimistic update
    setLocalTasks(prev =>
      prev.map(t => t.id === activeTaskId ? { ...t, status: newStatus } : t)
    );

    // Persist to backend
    onTaskStatusChange(activeTaskId, newStatus);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setOverId(null);
    // Revert to server state
    setLocalTasks(tasks);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 pb-4 overflow-x-auto select-none">
        {KANBAN_COLS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={tasksByCol[col.id] || []}
            getMemberName={getMemberName}
            onTaskClick={onTaskClick}
            onAddTask={(colId) => onAddTask(colId)}
            isOver={
              overId === col.id ||
              (!!overId && !!findColumnOfTask(overId) && findColumnOfTask(overId) === col.id && overId !== activeTask?.id)
            }
          />
        ))}
      </div>

      {/* Drag overlay — floats above everything while dragging */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            getMemberName={getMemberName}
            onClick={() => { }}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
