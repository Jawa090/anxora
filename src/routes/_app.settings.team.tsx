import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/settings/team")({ component: () => <ModulePlaceholder moduleKey="settings" subSlug="team" /> });
