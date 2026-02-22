import { LoadingState } from "@/components/shared/LoadingState";

export default function DashboardPageLoading() {
  return (
    <div className="p-6">
      <LoadingState type="card" rows={6} />
    </div>
  );
}
