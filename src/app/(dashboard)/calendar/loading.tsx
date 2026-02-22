import { LoadingState } from "@/components/shared/LoadingState";

export default function CalendarLoading() {
  return (
    <div className="p-6">
      <LoadingState type="card" rows={3} />
    </div>
  );
}
