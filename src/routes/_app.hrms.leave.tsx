import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/hrms/leave")({ component: () => <ModulePlaceholder moduleKey="hrms" subSlug="leave" /> });
