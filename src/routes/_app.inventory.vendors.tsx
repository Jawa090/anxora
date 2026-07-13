import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/inventory/vendors")({ component: () => <ModulePlaceholder moduleKey="inventory" subSlug="vendors" /> });
