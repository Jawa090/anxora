import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/collaboration/meetings")({ component: () => <ModulePlaceholder moduleKey="collaboration" subSlug="meetings" /> });
