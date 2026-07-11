"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiffViewerProps {
  diffHtml?: string | null;
  oldHtml?: string | null;
  newHtml?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export function DiffViewer({
  diffHtml,
  oldHtml,
  newHtml,
  oldValue,
  newValue,
}: DiffViewerProps) {
  return (
    <Tabs defaultValue="diff" className="w-full">
      <TabsList>
        <TabsTrigger value="diff">Word Diff</TabsTrigger>
        <TabsTrigger value="old">Previous</TabsTrigger>
        <TabsTrigger value="new">Current</TabsTrigger>
      </TabsList>

      <TabsContent value="diff">
        <ScrollArea className="h-[min(50dvh,400px)] max-w-full rounded-lg border p-3 sm:h-[400px] sm:p-4">
          {diffHtml ? (
            <div
              className="text-sm font-mono leading-relaxed [&_.diff-add]:bg-green-100 [&_.diff-add]:text-green-800 [&_.diff-remove]:bg-red-100 [&_.diff-remove]:text-red-800 [&_.diff-remove]:line-through dark:[&_.diff-add]:bg-green-900/30 dark:[&_.diff-add]:text-green-400 dark:[&_.diff-remove]:bg-red-900/30 dark:[&_.diff-remove]:text-red-400"
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          ) : (
            <div className="space-y-4 text-sm">
              {oldValue && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Previous</p>
                  <p className="text-red-500 line-through">{oldValue}</p>
                </div>
              )}
              {newValue && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current</p>
                  <p className="text-green-600 font-medium">{newValue}</p>
                </div>
              )}
              {!oldValue && !newValue && (
                <p className="text-muted-foreground">No diff available.</p>
              )}
            </div>
          )}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="old">
        <ScrollArea className="h-[min(50dvh,400px)] max-w-full rounded-lg border p-3 sm:h-[400px] sm:p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
            {oldHtml ?? oldValue ?? "No previous content stored."}
          </pre>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="new">
        <ScrollArea className="h-[min(50dvh,400px)] max-w-full rounded-lg border p-3 sm:h-[400px] sm:p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
            {newHtml ?? newValue ?? "No current content stored."}
          </pre>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
