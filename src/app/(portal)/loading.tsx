export default function Loading() {
  return (
    <div className="h-full px-5 pb-6 sm:px-8" aria-busy="true">
      <div className="h-full min-h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
    </div>
  );
}
