import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/settings/integrations")({ component: () => <ModulePlaceholder moduleKey="settings" subSlug="integrations" /> });
