import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/marketing/analytics")({ component: () => <ModulePlaceholder moduleKey="marketing" subSlug="analytics" /> });
