import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/recruitment/reports")({ component: () => <ModulePlaceholder moduleKey="recruitment" subSlug="reports" /> });
