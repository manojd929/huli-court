"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAssignablePersonLabel } from "@/lib/format-assignable-person-label";
import type { AssignablePerson } from "@/types/assignable-person";
import { cn } from "@/lib/utils";

export type { AssignablePerson };

const NONE_VALUE = "__none__";

interface OwnerPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (userId: string) => void;
  people: AssignablePerson[];
  className?: string;
  /** When true, only the select is rendered; pair with a sibling Label that uses the same `id`. */
  hideLabel?: boolean;
}

export function OwnerPicker({
  id,
  label,
  value,
  onChange,
  people,
  className,
  hideLabel = false,
}: OwnerPickerProps) {
  const trimmed = value.trim();
  const selectValue = trimmed === "" ? NONE_VALUE : trimmed;
  const selectedPerson =
    trimmed === "" ? undefined : people.find((person) => person.id === trimmed);

  return (
    <div className={cn(!hideLabel && "space-y-2", className)}>
      {hideLabel ? null : <Label htmlFor={id}>{label}</Label>}
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next == null || next === NONE_VALUE) {
            onChange("");
            return;
          }
          onChange(next);
        }}
      >
        <SelectTrigger
          id={id}
          aria-label={hideLabel ? label : undefined}
          className="w-full max-w-full min-w-0"
        >
          <SelectValue placeholder="Choose someone…">
            {selectValue === NONE_VALUE
              ? "No owner yet"
              : selectedPerson
                ? formatAssignablePersonLabel(selectedPerson)
                : "Owner profile unavailable"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>No owner yet</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {formatAssignablePersonLabel(person)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
