import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary",
        className
      )}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-full items-center justify-center py-24">
      <Spinner className="h-7 w-7 border-[3px]" />
    </div>
  );
}
