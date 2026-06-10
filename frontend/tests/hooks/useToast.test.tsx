import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastViewport } from "../../src/components/ui";
import { ToastProvider, useToast } from "../../src/hooks/useToast";

function DuplicateToastTrigger() {
  const { pushToast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        pushToast("Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.", "error");
        pushToast("Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.", "error");
      }}
    >
      Meldung auslösen
    </button>
  );
}

describe("ToastProvider", () => {
  it("shows simultaneous identical messages only once", () => {
    render(
      <ToastProvider>
        <DuplicateToastTrigger />
        <ToastViewport />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Meldung auslösen" }));

    expect(screen.getAllByText("Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.")).toHaveLength(1);
  });
});
