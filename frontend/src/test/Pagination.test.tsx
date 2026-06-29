import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "../components/Common";

describe("Pagination", () => {
  it("renders nothing when there is only one page", () => {
    const { container } = render(<Pagination page={1} pageSize={10} total={5} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables 'Previous' on the first page and 'Next' on the last page", () => {
    render(<Pagination page={1} pageSize={10} total={25} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeEnabled();
  });

  it("calls onPageChange with the next page number when 'Next' is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} pageSize={10} total={50} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with the previous page number when 'Previous' is clicked", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} pageSize={10} total={50} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
