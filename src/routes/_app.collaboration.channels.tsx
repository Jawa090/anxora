import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, PageHeader, Card, SectionTitle, Pill, Avatar } from "@/components/page";
import { 
  Plus, Hash, Users, Lock, Globe, Settings, Search, Pin, 
  MessageSquare, MoreVertical, Bell, BellOff, Star, Archive
} from "lucide-react";

export const Route = createFileRoute("/_app/collaboration/channels")({
  component: ChannelsPage,
  head: () => ({
    meta: [
      { title: "Channels — Collaboration" },
      { name: "description", content: "Browse and manage team channels and workgroups." },
    ],
  }),
});

const channelCategories = [
  {
    name: "Core Teams",
    channels: [
      { name: "general", desc: "Company-wide discussions", members: 42, unread: 0, type: "public", pinned: true },
      { name: "announcements", desc: "Official company updates", members: 42, unread: 1, type: "public", pinned: true },
      { name: "random", desc: "Off-topic conversations", members: 38, unread: 5, type: "public", pinned: false },
      { name: "core-team", desc: "Core team coordination", members: 18, unread: 3, type: "private", pinned: false },
    ]
  },
  {
    name: "Development",
    channels: [
      { name: "dev-general", desc: "Development discussions", members: 22, unread: 12, type: "public", pinned: false },
      { name: "devs-testing", desc: "Testing coordination", members: 12, unread: 2, type: "public", pinned: false },
      { name: "code-reviews", desc: "Code review requests", members: 15, unread: 8, type: "public", pinned: false },
      { name: "deployments", desc: "Deployment notifications", members: 10, unread: 0, type: "private", pinned: false },
    ]
  },
  {
    name: "Projects",
    channels: [
      { name: "crm-improvements", desc: "CRM Issues & Improvements", members: 8, unread: 5, type: "public", pinned: false },
      { name: "data-acquisition", desc: "Data pipeline discussions", members: 6, unread: 0, type: "public", pinned: false },
      { name: "project-discovery", desc: "Project Discovery phase", members: 15, unread: 1, type: "public", pinned: false },
      { name: "ai-engineering", desc: "AI model development", members: 9, unread: 7, type: "private", pinned: false },
    ]
  },
  {
    name: "Operations",
    channels: [
      { name: "contractors", desc: "External contractor coordination", members: 4, unread: 0, type: "private", pinned: false },
      { name: "hr-updates", desc: "HR announcements and updates", members: 42, unread: 2, type: "public", pinned: false },
      { name: "finance", desc: "Finance team discussions", members: 6, unread: 0, type: "private", pinned: false },
    ]
  }
];

function ChannelsPage() {
  return (
    <Page>
      <PageHeader
        title="Team Channels"
        description="Browse all channels and workgroups. Stay connected with your team."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted">
              <Search className="h-4 w-4" /> Search Channels
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl grad-primary px-3.5 text-sm font-medium text-white shadow-glow hover:opacity-95">
              <Plus className="h-4 w-4" /> Create Channel
            </button>
          </>
        }
      />

      {/* Channel Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Total Channels</span>
          </div>
          <div className="text-2xl font-semibold">24</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Active Members</span>
          </div>
          <div className="text-2xl font-semibold">42</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Unread Messages</span>
          </div>
          <div className="text-2xl font-semibold">41</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Pin className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Pinned Channels</span>
          </div>
          <div className="text-2xl font-semibold">2</div>
        </Card>
      </div>

      {/* Channel Categories */}
      <div className="space-y-6">
        {channelCategories.map((category) => (
          <Card key={category.name}>
            <SectionTitle sub={`${category.channels.length} channels`}>
              {category.name}
            </SectionTitle>
            <div className="space-y-1">
              {category.channels.map((channel) => (
                <Link
                  key={channel.name}
                  to="/collaboration/messages"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  {/* Channel Icon */}
                  <div className="flex items-center gap-2">
                    {channel.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                    {channel.type === "private" ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Channel Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">#{channel.name}</span>
                      {channel.type === "private" && (
                        <Pill tone="muted" className="text-xs">Private</Pill>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {channel.desc}
                    </p>
                  </div>

                  {/* Members Count */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{channel.members}</span>
                  </div>

                  {/* Unread Badge */}
                  {channel.unread > 0 && (
                    <div className="h-5 w-5 rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center">
                      {channel.unread}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 rounded-md hover:bg-muted">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Channel Actions */}
      <Card className="mt-6">
        <SectionTitle>Channel Management</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="font-medium text-sm">Create Channel</div>
              <div className="text-xs text-muted-foreground">Start a new team channel</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
              <Globe className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="font-medium text-sm">Browse Public</div>
              <div className="text-xs text-muted-foreground">Discover public channels</div>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/60 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Archive className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="font-medium text-sm">Archived</div>
              <div className="text-xs text-muted-foreground">View archived channels</div>
            </div>
          </button>
        </div>
      </Card>
    </Page>
  );
}
