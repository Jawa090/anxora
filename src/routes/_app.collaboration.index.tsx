import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, PageHeader, Card, SectionTitle, Pill, Avatar } from "@/components/page";
import { 
  Plus, MessageSquare, Users, Phone, Video, Hash, AtSign, 
  Bell, Search, MoreVertical, Calendar, Clock, Sparkles
} from "lucide-react";

export const Route = createFileRoute("/_app/collaboration/")({
  component: CollaborationDashboard,
  head: () => ({
    meta: [
      { title: "Collaboration — Anxora OS" },
      { name: "description", content: "Team collaboration hub with channels, messages, meetings and calls." },
    ],
  }),
});

const directMessages = [
  { name: "Syed Mesum Ali", status: "online", lastMsg: "Sure, let me check the API docs", time: "2m", unread: 2 },
  { name: "Yasir Jafar", status: "online", lastMsg: "The deployment is ready for review", time: "15m", unread: 0 },
  { name: "Muhammad Ziyad", status: "away", lastMsg: "I'll be back in 30 minutes", time: "1h", unread: 0 },
  { name: "Muhammad Mohsin Ijaz", status: "offline", lastMsg: "Thanks for the update!", time: "3h", unread: 1 },
  { name: "Haris Rashid", status: "online", lastMsg: "Can we schedule a quick call?", time: "5h", unread: 3 },
];

const teamGroups = [
  { name: "CRM Issues & Improvements", members: 8, lastMsg: "New bug report submitted", time: "10m", unread: 5, tag: "CRM" },
  { name: "Devs testing", members: 12, lastMsg: "Test case #342 passed", time: "25m", unread: 2, tag: "DEV" },
  { name: "Data Acquisition", members: 6, lastMsg: "Pipeline updated successfully", time: "1h", unread: 0, tag: "DATA" },
  { name: "Project Discovery", members: 15, lastMsg: "Meeting notes shared", time: "2h", unread: 1, tag: "PM" },
  { name: "AI Engineering", members: 9, lastMsg: "Model training completed", time: "3h", unread: 7, tag: "AI" },
  { name: "Contractors", members: 4, lastMsg: "Invoice submitted for review", time: "4h", unread: 0, tag: "EXT" },
  { name: "List - Core Team", members: 18, lastMsg: "Sprint planning tomorrow", time: "6h", unread: 3, tag: "CORE" },
  { name: "Software Development Team", members: 22, lastMsg: "Code review ready", time: "1d", unread: 12, tag: "DEV" },
];

const broadcasts = [
  { name: "The Cortex", desc: "Company-wide announcements", lastMsg: "Q4 All-hands meeting scheduled", time: "2h", unread: 1 },
  { name: "Yasir channel", desc: "Leadership updates", lastMsg: "New client onboarding process", time: "1d", unread: 0 },
  { name: "General", desc: "General discussions", lastMsg: "Office lunch menu updated", time: "2d", unread: 0 },
];

const upcomingMeetings = [
  { title: "Daily Standup", time: "09:30", participants: ["Development Team"], type: "recurring" },
  { title: "Client Review Call", time: "14:00", participants: ["Sales", "PM"], type: "client" },
  { title: "Sprint Planning", time: "16:00", participants: ["Core Team"], type: "planning" },
];

function CollaborationDashboard() {
  return (
    <Page>
      <PageHeader
        title="Collaboration Hub"
        description="Stay connected with your team through channels, messages, and meetings."
        badge={<Pill tone="primary"><Bell className="h-3 w-3" /> 14 unread</Pill>}
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted">
              <Search className="h-4 w-4" /> Search
            </button>
            <Link to="/collaboration/meetings" className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow hover:opacity-95">
              <Video className="h-4 w-4" /> Start Meeting
            </Link>
          </>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            <Pill tone="danger">14</Pill>
          </div>
          <div className="text-lg font-semibold">Unread</div>
          <div className="text-xs text-muted-foreground">3 mentions</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            <Pill tone="success">28 online</Pill>
          </div>
          <div className="text-lg font-semibold">Team</div>
          <div className="text-xs text-muted-foreground">42 total members</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Video className="h-5 w-5 text-purple-500" />
            <Pill tone="warning">3 today</Pill>
          </div>
          <div className="text-lg font-semibold">Meetings</div>
          <div className="text-xs text-muted-foreground">Next in 2h</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <Hash className="h-5 w-5 text-cyan-500" />
            <Pill tone="info">15 active</Pill>
          </div>
          <div className="text-lg font-semibold">Channels</div>
          <div className="text-xs text-muted-foreground">8 workgroups</div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Direct Messages */}
        <Card>
          <SectionTitle 
            sub="Private conversations"
            action={<Link to="/collaboration/messages" className="text-xs text-primary hover:underline">View all</Link>}
          >
            Direct Messages
          </SectionTitle>
          <div className="space-y-2">
            {directMessages.map((dm, i) => (
              <Link 
                key={i}
                to="/collaboration/messages"
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60 transition-colors"
              >
                <div className="relative">
                  <Avatar name={dm.name} className="h-8 w-8" />
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                    dm.status === 'online' ? 'bg-green-500' : 
                    dm.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{dm.name}</span>
                    <span className="text-xs text-muted-foreground">{dm.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{dm.lastMsg}</p>
                </div>
                {dm.unread > 0 && (
                  <div className="h-5 w-5 rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center">
                    {dm.unread}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </Card>

        {/* Team Groups */}
        <Card>
          <SectionTitle 
            sub="Project workgroups"
            action={<Link to="/collaboration/channels" className="text-xs text-primary hover:underline">View all</Link>}
          >
            Team Groups
          </SectionTitle>
          <div className="space-y-2">
            {teamGroups.slice(0, 6).map((group, i) => (
              <Link 
                key={i}
                to="/collaboration/channels"
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-xs font-bold">
                  {group.tag}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{group.name}</span>
                    <span className="text-xs text-muted-foreground">{group.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate">{group.lastMsg}</p>
                    <span className="text-xs text-muted-foreground">{group.members} members</span>
                  </div>
                </div>
                {group.unread > 0 && (
                  <div className="h-5 w-5 rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center">
                    {group.unread}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </Card>

        {/* Broadcasts & Meetings */}
        <div className="space-y-4">
          <Card>
            <SectionTitle sub="Company announcements">Broadcasts</SectionTitle>
            <div className="space-y-2">
              {broadcasts.map((broadcast, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{broadcast.name}</span>
                      <span className="text-xs text-muted-foreground">{broadcast.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{broadcast.desc}</p>
                    <p className="text-xs text-muted-foreground mt-1">{broadcast.lastMsg}</p>
                  </div>
                  {broadcast.unread > 0 && (
                    <div className="h-4 w-4 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle sub="Today's schedule">Upcoming Meetings</SectionTitle>
            <div className="space-y-2">
              {upcomingMeetings.map((meeting, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{meeting.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {meeting.time} • {meeting.participants.join(", ")}
                    </div>
                  </div>
                  <Pill tone={meeting.type === 'client' ? 'warning' : meeting.type === 'recurring' ? 'info' : 'muted'}>
                    {meeting.type}
                  </Pill>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <Link to="/collaboration/meetings" className="text-xs text-primary hover:underline">
                View all meetings →
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">New Message</span>
          </button>
          <button className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <Hash className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Create Channel</span>
          </button>
          <button className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Start Meeting</span>
          </button>
          <button className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <Phone className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Quick Call</span>
          </button>
        </div>
      </Card>
    </Page>
  );
}