import type { ComponentProps } from "svelte";
import Input from "./Input.svelte";
import { buttonVariants } from "./button";

buttonVariants({ variant: "outline", size: "sm" });
// @ts-expect-error variants are the owned semantic choices, not arbitrary colors
buttonVariants({ variant: "blue" });
// @ts-expect-error the filled action is Studio's `default`, not `primary`
buttonVariants({ variant: "primary" });
// @ts-expect-error sizes are constrained
buttonVariants({ size: "huge" });
// @ts-expect-error the standard height is Studio's `default`, not `md`
buttonVariants({ size: "md" });
const valid: ComponentProps<typeof Input> = { type: "email", value: "" };
// @ts-expect-error input sizes are constrained
const size: ComponentProps<typeof Input> = { size: "lg" };
void [valid, size];
