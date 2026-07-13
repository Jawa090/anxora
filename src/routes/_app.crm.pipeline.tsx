import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/crm/pipeline")({ component: () => <ModulePlaceholder moduleKey="crm" subSlug="pipeline" /> });
