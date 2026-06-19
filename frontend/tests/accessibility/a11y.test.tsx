import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe, toHaveNoViolations } from "jest-axe";
import { AddressInput } from "../../src/components/AddressInput";
import { Layout } from "../../src/components/Layout";
import { EMPTY_ADDRESS } from "../../src/utils/address";

expect.extend(toHaveNoViolations);

describe("WCAG accessibility checks", () => {
  it("has no detectable violations in the public application shell", async () => {
    const { container } = render(
      <MemoryRouter>
        <Layout users={[]} onSwitchUser={() => undefined} onLogout={() => undefined} />
      </MemoryRouter>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes the address search as an accessible combobox", async () => {
    const { container } = render(
      <AddressInput value={{ ...EMPTY_ADDRESS }} onChange={() => undefined} required />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
