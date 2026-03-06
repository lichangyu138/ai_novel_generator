/**
 * Streaming Text Component
 * Displays text with streaming animation and cursor
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export default function StreamingText({
  content,
  isStreaming = false,
  className,
}: StreamingTextProps) {
  return (
    <div
      className={cn(
        'whitespace-pre-wrap font-mono text-sm leading-relaxed',
        isStreaming && 'streaming-cursor',
        className
      )}
    >
      {content}
    </div>
  );
}

interface StreamingContainerProps {
  title?: string;
  content: string;
  isStreaming?: boolean;
  onStop?: () => void;
  className?: string;
}

export function StreamingContainer({
  title,
  content,
  isStreaming = false,
  onStop,
  className,
}: StreamingContainerProps) {
  return (
    <div className={cn('scandi-card p-6', className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {isStreaming && onStop && (
            <button
              onClick={onStop}
              className="px-3 py-1 text-sm bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors"
            >
              停止生成
            </button>
          )}
        </div>
      )}
      <div className="min-h-[200px] max-h-[600px] overflow-y-auto">
        <StreamingText content={content} isStreaming={isStreaming} />
      </div>
      {isStreaming && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          正在生成中...
        </div>
      )}
    </div>
  );
}
