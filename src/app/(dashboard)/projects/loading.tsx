import { LoadingState } from "@/components/shared/LoadingState";

export default function ProjectsLoading() {
  return (
    <div className="p-6">
      <LoadingState type="table" rows={5} />
    </div>
  );
}
