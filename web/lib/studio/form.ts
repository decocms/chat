import { getContext, setContext } from "svelte";

/** What a field reports when it is invalid: the message itself, or an object carrying it as form libraries do. */
export type FormFieldError = string | { message?: string } | null | undefined;

type FormFieldContext = { name: string; error: FormFieldError };
type FormItemContext = { id: string };

const FIELD = Symbol("studio-form-field");
const ITEM = Symbol("studio-form-item");

export function setFormFieldContext(read: () => FormFieldContext): void {
  setContext(FIELD, read);
}

export function setFormItemContext(read: () => FormItemContext): void {
  setContext(ITEM, read);
}

/** The ids and error of the field around the caller. Read the properties where they are used: they are live getters. */
export function useFormField() {
  const field = getContext<(() => FormFieldContext) | undefined>(FIELD);
  const item = getContext<(() => FormItemContext) | undefined>(ITEM);
  if (!field) {
    throw new Error("useFormField should be used within <FormField>");
  }
  return {
    get id() {
      return item?.().id;
    },
    get name() {
      return field().name;
    },
    get formItemId() {
      return `${item?.().id}-form-item`;
    },
    get formDescriptionId() {
      return `${item?.().id}-form-item-description`;
    },
    get formMessageId() {
      return `${item?.().id}-form-item-message`;
    },
    get error(): { message?: string } | undefined {
      const error = field().error;
      if (error === null || error === undefined || error === "") {
        return undefined;
      }
      return typeof error === "string" ? { message: error } : error;
    },
    get invalid() {
      return this.error !== undefined;
    },
  };
}
