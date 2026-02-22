import { LoadingState } from "@/components/shared/LoadingState";

export default function SettingsLoading() {
  return (
    <div className="p-6">
      <LoadingState type="list" rows={6} />
    </div>
  );
}
