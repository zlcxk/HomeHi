export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6 pt-2">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-12 w-2/3" />
      <div className="skeleton h-36 w-full rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      <div className="skeleton h-20 w-full" />
      <div className="skeleton h-20 w-full" />
    </div>
  );
}
