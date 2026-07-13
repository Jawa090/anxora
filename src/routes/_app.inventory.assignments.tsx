import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/inventory/assignments")({ component: () => <ModulePlaceholder moduleKey="inventory" subSlug="assignments" /> });
