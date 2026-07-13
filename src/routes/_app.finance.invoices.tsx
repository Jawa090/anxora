import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/finance/invoices")({ component: () => <ModulePlaceholder moduleKey="finance" subSlug="invoices" /> });
