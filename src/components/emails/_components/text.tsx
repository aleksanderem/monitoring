import type { TextProps } from "@react-email/components";
import { Text as EmailText } from "@react-email/components";
import { cx } from "@/lib/utils/cx";

export const Text = (props: TextProps) => {
    return (
        <EmailText {...props} className={cx("mt-0 mb-0", props.className)}>
            {props.children}
        </EmailText>
    );
};
