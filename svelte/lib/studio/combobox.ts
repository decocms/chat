/** Extra keys are allowed so `renderItem` can draw more than the label. */
export interface ComboboxOption {
  value: string;
  label: string;
  [key: string]: unknown;
}
