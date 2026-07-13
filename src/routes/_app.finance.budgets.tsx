import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/finance/budgets")({ component: () => <ModulePlaceholder moduleKey="finance" subSlug="budgets" /> });
