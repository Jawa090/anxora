import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/settings/billing")({ component: () => <ModulePlaceholder moduleKey="settings" subSlug="billing" /> });
