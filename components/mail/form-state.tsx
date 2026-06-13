"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type State = { ok: boolean; message: string };

export function StatefulForm({
  action,
  children,
  submitLabel,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, { ok: true, message: "" });
  return (
    <form action={formAction} className="space-y-3">
      {children}
      <SubmitButton label={submitLabel} />
      {state.message && (
        <p className={state.ok ? "text-xs text-cyber-green" : "text-xs text-cyber-red"}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const status = useFormStatus();
  return (
    <Button type="submit" disabled={status.pending}>
      {status.pending ? "Working" : label}
    </Button>
  );
}
