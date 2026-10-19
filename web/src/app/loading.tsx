export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-10 w-2/3 animate-pulse rounded-tl-xl rounded-br-xl bg-line motion-reduce:animate-none" />
      <div className="h-5 w-1/2 animate-pulse rounded bg-line motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-tl-3xl rounded-br-3xl bg-line motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}
