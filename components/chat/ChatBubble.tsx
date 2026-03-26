import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "p-4 max-w-[80%] transition-all",
        role === "user"
          ? "ml-auto bg-muted"
          : "mr-auto bg-background shadow-sm"
      )}
    >
      {children}
    </Card>
  );
}
