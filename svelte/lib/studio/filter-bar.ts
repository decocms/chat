export type FilterOperator =
  | "contains"
  | "does_not_contain"
  | "is"
  | "is_not"
  | "in_last"
  | "before"
  | "after"
  | "between";

export type FilterColumn =
  | "name"
  | "description"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "updated_by";

export interface Filter {
  id: string;
  column: FilterColumn;
  operator: FilterOperator;
  value: string;
}

export interface FilterBarUser {
  id: string;
  name?: string;
}
