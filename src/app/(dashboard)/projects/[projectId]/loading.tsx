import { LoadingState } from "@/components/shared/LoadingState";

export default function ProjectDetailLoading() {
  return (
    <div className="p-6">
      <LoadingState type="detail" />
    </div>
  );
}
