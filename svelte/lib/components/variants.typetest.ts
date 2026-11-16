import type { ComponentProps } from "svelte";
import IconButton from "../studio/IconButton.svelte";
import Input from "../studio/Input.svelte";
import { buttonVariants } from "../studio/button";

buttonVariants({ variant: "outline", size: "sm" });
// @ts-expect-error variants are the owned semantic choices, not arbitrary colors
buttonVariants({ variant: "blue" });
// @ts-expect-error sizes are constrained
buttonVariants({ size: "huge" });
const valid: ComponentProps<typeof Input> = { type: "email", value: "" };
// @ts-expect-error input sizes are the Studio scale, not the HTML size attribute
const sized: ComponentProps<typeof Input> = { size: 20 };
// @ts-expect-error an icon-only button always says what it does
const unlabeled: ComponentProps<typeof IconButton> = {};
void [valid, sized, unlabeled];
