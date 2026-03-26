import { Button } from "@/components/ui/button";

export default function SmartReplies({
  replies,
  onReply,
}: {
  replies: string[];
  onReply: (text: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {replies.map((r) => (
        <Button
          key={r}
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={() => onReply(r)}
        >
          {r}
        </Button>
      ))}
    </div>
  );
}
