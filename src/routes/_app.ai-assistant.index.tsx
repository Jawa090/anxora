import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/ai-assistant/")({ component: () => <ModulePlaceholder moduleKey="ai-assistant" /> });
