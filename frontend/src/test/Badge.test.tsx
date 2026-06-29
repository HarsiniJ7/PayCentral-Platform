import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, statusTone } from "../components/Badge";

describe("Badge", () => {
  it("renders the given label", () => {
    render(<Badge label="Active" tone="success" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("defaults to a neutral tone when none is provided", () => {
    const { container } = render(<Badge label="Unknown" />);
    expect(container.querySelector("span")?.className).toContain("bg-steel/10");
  });
});

describe("statusTone", () => {
  it("maps healthy/approved states to success", () => {
    expect(statusTone("Active")).toBe("success");
    expect(statusTone("Completed")).toBe("success");
  });

  it("maps risk/negative states to danger", () => {
    expect(statusTone("Blocked")).toBe("danger");
    expect(statusTone("Critical")).toBe("danger");
  });

  it("maps an unrecognised status to the info fallback rather than throwing", () => {
    expect(statusTone("SomethingNew")).toBe("info");
  });
});
