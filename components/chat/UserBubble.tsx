import { ChatBubble } from "./ChatBubble";
import NLPBadges from "./NLPBadges";

export default function UserBubble({ m }: any) {
  return (
    <ChatBubble role="user">
      <p className="whitespace-pre-wrap text-sm">{m.content}</p>
      <NLPBadges message={m} />
    </ChatBubble>
  );
}
