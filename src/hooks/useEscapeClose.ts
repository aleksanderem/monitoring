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

        // Lock body scroll while modal is open
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = prev;
        };
    }, [onClose, enabled]);
}
