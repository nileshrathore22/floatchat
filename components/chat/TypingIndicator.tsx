export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Assistant is thinking</span>
      <span className="flex gap-1">
        <span className="animate-bounce">•</span>
        <span className="animate-bounce delay-150">•</span>
        <span className="animate-bounce delay-300">•</span>
      </span>
    </div>
  );
}
