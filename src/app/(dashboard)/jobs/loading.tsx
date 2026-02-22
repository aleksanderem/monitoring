import { LoadingState } from "@/components/shared/LoadingState";

export default function JobsLoading() {
  return (
    <div className="p-6">
      <LoadingState type="table" rows={8} />
    </div>
  );
}
