import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, MoreHorizontal, MessageSquare, Paperclip, Clock, 
  Calendar, User, Flag, Hash, Eye, Activity, CheckCircle2, 
  AlertCircle, Plus, Send, Edit3, Trash2, Link2, Copy, Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Mock data - replace with actual API calls
const mockIssue = {
  id: "TSK-1234",
  title: "Implement user authentication system",
  description: "We need to build a comprehensive authentication system that supports email/password login, social login (Google, GitHub), and proper session management.",
  status: "in_progress",
  priority: "high",
  type: "feature",
  assignee: {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    avatar: null
  },
  reporter: {
    id: "2", 
    name: "Jane Smith",
    email: "jane@example.com"
  },
  project: {
    id: "proj-1",
    name: "Web App",
    color: "bg-blue-500"
  },
  labels: ["authentication", "security", "backend"],
  dueDate: "2024-02-15",
  createdAt: "2024-01-20T10:00:00Z",
  updatedAt: "2024-01-25T15:30:00Z",
  timeEstimate: "8h",
  timeSpent: "3h 30m",
  comments: [
    {
      id: "1",
      author: { name: "John Doe", avatar: null },
      content: "Started working on the OAuth integration. Google login is almost ready.",
      createdAt: "2024-01-22T14:20:00Z"
    },
    {
      id: "2", 
      author: { name: "Jane Smith", avatar: null },
      content: "Great progress! Don't forget to add proper error handling for failed login attempts.",
      createdAt: "2024-01-23T09:15:00Z"
    }
  ],
  activity: [
    {
      id: "1",
      type: "status_change",
      author: "John Doe",
      from: "todo",
      to: "in_progress", 
      timestamp: "2024-01-22T10:00:00Z"
    },
    {
      id: "2",
      type: "comment",
      author: "John Doe",
      timestamp: "2024-01-22T14:20:00Z"
    }
  ]
};

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog", icon: Circle, color: "text-slate-400" },
  { value: "todo", label: "To Do", icon: Circle, color: "text-slate-500" },
  { value: "in_progress", label: "In Progress", icon: Activity, color: "text-blue-500" },
  { value: "in_review", label: "In Review", icon: Eye, color: "text-amber-500" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-green-500" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-green-500", dot: "bg-green-400" },
  { value: "medium", label: "Medium", color: "text-yellow-500", dot: "bg-yellow-400" },
  { value: "high", label: "High", color: "text-orange-500", dot: "bg-orange-400" },
  { value: "urgent", label: "Urgent", color: "text-red-500", dot: "bg-red-500" },
];

export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(mockIssue);
  const [newComment, setNewComment] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const statusOption = STATUS_OPTIONS.find(s => s.value === issue.status);
  const priorityOption = PRIORITY_OPTIONS.find(p => p.value === issue.priority);
  const StatusIcon = statusOption?.icon || Circle;

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment = {
      id: Date.now().toString(),
      author: { name: "Current User", avatar: null },
      content: newComment,
      createdAt: new Date().toISOString()
    };
    
    setIssue(prev => ({
      ...prev,
      comments: [...prev.comments, comment]
    }));
    setNewComment("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/tasks")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Issues
              </Button>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {issue.id}
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {issue.project.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Link2 className="h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <StatusIcon className={cn("h-5 w-5 mt-1", statusOption?.color)} />
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-foreground leading-tight">
                    {issue.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <span>Created {format(new Date(issue.createdAt), "MMM d, yyyy")}</span>
                    <span>•</span>
                    <span>Updated {format(new Date(issue.updatedAt), "MMM d")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Description</h3>
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground leading-relaxed">
                  {issue.description}
                </p>
              </div>
            </div>

            <Separator />

            {/* Comments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({issue.comments.length})
                </h3>
              </div>

              <div className="space-y-4">
                {issue.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {comment.author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {comment.author.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="text-sm text-foreground bg-muted/30 rounded-lg p-3 border">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Comment */}
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      CU
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px] resize-none border-border focus:border-primary focus:ring-primary/20"
                    />
                    <div className="flex justify-end">
                      <Button 
                        size="sm" 
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="gap-2"
                      >
                        <Send className="h-3 w-3" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Properties */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
              <h3 className="text-sm font-semibold text-foreground">Properties</h3>
              
              <div className="space-y-3">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
                  <Badge variant="outline" className={cn("gap-1", statusOption?.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {statusOption?.label}
                  </Badge>
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Priority</span>
                  <Badge variant="outline" className="gap-1">
                    <span className={cn("h-2 w-2 rounded-full", priorityOption?.dot)} />
                    {priorityOption?.label}
                  </Badge>
                </div>

                {/* Assignee */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Assignee</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {issue.assignee.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{issue.assignee.name}</span>
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Due Date</span>
                  <span className="text-sm text-foreground">
                    {format(new Date(issue.dueDate), "MMM d, yyyy")}
                  </span>
                </div>

                {/* Time Tracking */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Time</span>
                  <div className="text-right">
                    <div className="text-sm text-foreground">{issue.timeSpent} / {issue.timeEstimate}</div>
                    <div className="text-xs text-muted-foreground">spent / estimated</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Labels */}
            <div className="space-y-3 p-4 border border-border rounded-lg bg-card">
              <h3 className="text-sm font-semibold text-foreground">Labels</h3>
              <div className="flex flex-wrap gap-2">
                {issue.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="space-y-3 p-4 border border-border rounded-lg bg-card">
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
              <div className="space-y-2">
                {issue.activity.map((activity) => (
                  <div key={activity.id} className="text-xs text-muted-foreground">
                    <span className="font-medium">{activity.author}</span>
                    {activity.type === 'status_change' && (
                      <span> changed status from {activity.from} to {activity.to}</span>
                    )}
                    {activity.type === 'comment' && (
                      <span> added a comment</span>
                    )}
                    <div className="text-muted-foreground/60">
                      {format(new Date(activity.timestamp), "MMM d, h:mm a")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}