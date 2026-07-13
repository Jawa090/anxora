import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/crm/inbox")({ component: () => <ModulePlaceholder moduleKey="crm" subSlug="inbox" /> });
