import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";

export default function ChatHomePage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto" />
        <div>
          <h2 className="font-semibold text-lg">Start a conversation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a conversation from the sidebar or start a new one. Every
            message is provenance-tracked.
          </p>
        </div>
        <Link
          href="/chat/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Link>
      </div>
    </div>
  );
}
