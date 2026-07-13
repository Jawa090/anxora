import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/marketing/email")({ component: () => <ModulePlaceholder moduleKey="marketing" subSlug="email" /> });
