export default function NLPBadges({ message }: any) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
      {message.sentiment && (
        <span>Sentiment: {message.sentiment}</span>
      )}
      {message.intent && (
        <span>Intent: {message.intent}</span>
      )}
    </div>
  );
}
