export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-8 py-8" aria-busy="true">
      <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
    </div>
  );
}
