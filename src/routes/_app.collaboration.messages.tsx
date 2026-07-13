import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, PageHeader, Card, SectionTitle, Pill, Avatar } from "@/components/page";
import { 
  Plus, MessageSquare, Search, Phone, Video, Paperclip, 
  Smile, Send, MoreVertical, Pin, Star, Archive, Clock
} from "lucide-react";

export const Route = createFileRoute("/_app/collaboration/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Messages — Collaboration" },
      { name: "description", content: "Direct messages and team conversations." },
    ],
  }),
});

const conversations = [
  { 
    id: 1,
    name: "Syed Mesum Ali", 
    status: "online", 
    lastMsg: "Sure, let me check the API docs and get back to you with the implementation details",
    time: "2m", 
    unread: 2,
    type: "direct",
    avatar: "SM"
  },
  { 
    id: 2,
    name: "Development Team", 
    status: "active", 
    lastMsg: "The deployment is ready for review. Please check the staging environment",
    time: "15m", 
    unread: 0,
    type: "group",
    avatar: "DT",
    members: 22
  },
  { 
    id: 3,
    name: "Yasir Jafar", 
    status: "online", 
    lastMsg: "Can we schedule the client demo for tomorrow afternoon?",
    time: "1h", 
    unread: 0,
    type: "direct",
    avatar: "YJ"
  },
  { 
    id: 4,
    name: "CRM Team", 
    status: "active", 
    lastMsg: "New feature request from the client - priority discussion needed",
    time: "2h", 
    unread: 5,
    type: "group",
    avatar: "CT",
    members: 8
  },
  { 
    id: 5,
    name: "Muhammad Ziyad", 
    status: "away", 
    lastMsg: "I'll be back in 30 minutes, will review the pull request then",
    time: "3h", 
    unread: 0,
    type: "direct",
    avatar: "MZ"
  },
];

const selectedConversation = conversations[0];

const messages = [
  {
    id: 1,
    sender: "Syed Mesum Ali",
    avatar: "SM",
    content: "Hey! I saw your message about the API integration. Do you have a moment to discuss the implementation approach?",
    time: "10:30 AM",
    isMe: false
  },
  {
    id: 2,
    sender: "You",
    avatar: "ME",
    content: "Yes absolutely! I was thinking we could use the REST endpoints for now and then migrate to GraphQL later. What do you think?",
    time: "10:32 AM",
    isMe: true
  },
  {
    id: 3,
    sender: "Syed Mesum Ali",
    avatar: "SM",
    content: "That sounds like a solid approach. Let me check the API documentation to see what endpoints are available.",
    time: "10:35 AM",
    isMe: false
  },
  {
    id: 4,
    sender: "Syed Mesum Ali",
    avatar: "SM",
    content: "Sure, let me check the API docs and get back to you with the implementation details",
    time: "10:37 AM",
    isMe: false
  },
];

function MessagesPage() {
  return (
    <Page className="!p-0 !max-w-none h-screen">
      <div className="flex h-full">
        {/* Sidebar - Conversations List */}
        <div className="w-80 border-r border-border bg-surface/50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold">Messages</h1>
              <button className="p-2 rounded-lg hover:bg-muted">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                placeholder="Search conversations..." 
                className="w-full h-9 bg-background border border-border rounded-lg pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    conv.id === selectedConversation.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <div className="relative">
                    <Avatar name={conv.name} className="h-10 w-10" />
                    {conv.type === "direct" && (
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                        conv.status === 'online' ? 'bg-green-500' : 
                        conv.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{conv.name}</span>
                      <span className="text-xs text-muted-foreground">{conv.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMsg}</p>
                      {conv.type === "group" && (
                        <span className="text-xs text-muted-foreground ml-2">{conv.members}</span>
                      )}
                    </div>
                  </div>
                  {conv.unread > 0 && (
                    <div className="h-5 w-5 rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center">
                      {conv.unread}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-border bg-background/80 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={selectedConversation.name} className="h-10 w-10" />
                <div>
                  <h2 className="text-lg font-semibold">{selectedConversation.name}</h2>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedConversation.status === "online" ? "🟢 Online" : 
                     selectedConversation.status === "away" ? "🟡 Away" : "⚫ Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-muted">
                  <Phone className="h-4 w-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-muted">
                  <Video className="h-4 w-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-muted">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.isMe ? 'flex-row-reverse' : ''}`}>
                {!message.isMe && <Avatar name={message.sender} className="h-8 w-8" />}
                <div className={`flex flex-col ${message.isMe ? 'items-end' : 'items-start'}`}>
                  {!message.isMe && (
                    <span className="text-xs text-muted-foreground mb-1">{message.sender}</span>
                  )}
                  <div className={`max-w-lg p-3 rounded-lg ${
                    message.isMe 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{message.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-border bg-background/80 backdrop-blur">
            <div className="flex items-end gap-3">
              <button className="p-2 rounded-lg hover:bg-muted">
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex-1 bg-muted/60 rounded-lg border border-border focus-within:border-primary/40">
                <textarea 
                  placeholder="Type a message..."
                  className="w-full p-3 bg-transparent resize-none focus:outline-none text-sm"
                  rows={1}
                />
              </div>
              <button className="p-2 rounded-lg hover:bg-muted">
                <Smile className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
