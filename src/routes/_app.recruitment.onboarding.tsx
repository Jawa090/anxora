import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
export const Route = createFileRoute("/_app/recruitment/onboarding")({ component: () => <ModulePlaceholder moduleKey="recruitment" subSlug="onboarding" /> });
