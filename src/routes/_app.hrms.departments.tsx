import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/hrms/departments")({ component: () => <ModulePlaceholder moduleKey="hrms" subSlug="departments" /> });
