import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/ai-assistant/history")({ component: () => <ModulePlaceholder moduleKey="ai-assistant" subSlug="history" /> });
