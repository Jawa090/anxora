import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/reports/exports")({ component: () => <ModulePlaceholder moduleKey="reports" subSlug="exports" /> });
