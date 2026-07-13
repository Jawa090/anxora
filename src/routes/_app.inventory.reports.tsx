import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/inventory/reports")({ component: () => <ModulePlaceholder moduleKey="inventory" subSlug="reports" /> });
