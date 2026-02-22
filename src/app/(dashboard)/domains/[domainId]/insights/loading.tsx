import { LoadingState } from "@/components/shared/LoadingState";

export default function InsightsLoading() {
  return (
    <div className="p-6">
      <LoadingState type="card" rows={4} />
    </div>
  );
}
