import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/knowledge-base/")({ component: () => <ModulePlaceholder moduleKey="knowledge-base" /> });
