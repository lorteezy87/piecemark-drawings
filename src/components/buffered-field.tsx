import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Text fields that hold their value locally while focused and commit on blur.
 *
 * The PM tracker lists re-sort and re-group whenever a record changes. Writing
 * to the store on every keystroke moves the row out from under the cursor
 * mid-edit — grouping by Owner and typing a name is the worst case, since the
 * group key changes on every character. React then unmounts the input and the
 * rest of what you typed goes nowhere, which reads as text vanishing.
 *
 * Buffering until blur keeps the row still while the field has focus, and the
 * list reorders once, after you're done.
 */

type BufferedInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
> & {
  value: string;
  /** Called on blur (or Enter) when the text actually changed. */
  onCommit: (value: string) => void;
};

export function BufferedInput({ value, onCommit, className, ...props }: BufferedInputProps) {
  const [draft, setDraft] = React.useState(value ?? "");
  const focused = React.useRef(false);

  // Accept outside updates only while the user isn't typing into this field
  React.useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  return (
    <Input
      {...props}
      className={className}
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (draft !== (value ?? "")) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
    />
  );
}

type BufferedTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onBlur"
> & {
  value: string;
  onCommit: (value: string) => void;
};

export function BufferedTextarea({ value, onCommit, className, ...props }: BufferedTextareaProps) {
  const [draft, setDraft] = React.useState(value ?? "");
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        className,
      )}
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        props.onFocus?.(e);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (draft !== (value ?? "")) onCommit(draft);
      }}
    />
  );
}
