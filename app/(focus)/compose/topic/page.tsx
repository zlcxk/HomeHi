import { requireContext } from "@/lib/auth";
import { TopicComposer } from "@/components/compose/TopicComposer";

export default async function ComposeTopicPage() {
  await requireContext();
  return <TopicComposer />;
}
