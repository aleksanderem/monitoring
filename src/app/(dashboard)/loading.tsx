import { LoadingState } from "@/components/shared/LoadingState";

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <LoadingState type="detail" />
    </div>
  );
}
