import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/marketing/funnels")({ component: () => <ModulePlaceholder moduleKey="marketing" subSlug="funnels" /> });
