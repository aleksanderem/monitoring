import { useEffect } from "react";

export function useEscapeClose(onClose: () => void, enabled: boolean = true) {
    useEffect(() => {
        if (!enabled) return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                onClose();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose, enabled]);
}
