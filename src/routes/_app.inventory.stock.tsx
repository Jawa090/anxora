import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/inventory/stock")({ component: () => <ModulePlaceholder moduleKey="inventory" subSlug="stock" /> });
