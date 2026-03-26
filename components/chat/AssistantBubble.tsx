import { ChatBubble } from "./ChatBubble";
import SmartReplies from "./SmartReplies";

export default function AssistantBubble({ m, onReply }: any) {
  return (
    <ChatBubble role="assistant">
      <p className="whitespace-pre-wrap text-sm leading-6">
        {m.content}
      </p>

      {m.smartReplies?.length > 0 && (
        <SmartReplies replies={m.smartReplies} onReply={onReply} />
      )}
    </ChatBubble>
  );
}
