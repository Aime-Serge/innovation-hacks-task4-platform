import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { DropdownMenu } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FilterBar } from "@/ui/FilterBar";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Icon } from "@/ui/Icon";
import { Input, Select, Textarea } from "@/ui/Input";
import { ProgressBar } from "@/ui/ProgressBar";
import { ProgressRing } from "@/ui/ProgressRing";
import { RegionState } from "@/ui/RegionState";
import { SearchField } from "@/ui/SearchField";
import { Skeleton } from "@/ui/Skeleton";
import { SortMenu } from "@/ui/SortMenu";
import { Spinner } from "@/ui/Spinner";
import { Tooltip } from "@/ui/Tooltip";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";
import { Checkbox } from "@/ui/Checkbox";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/cn";

describe("TC-041 progress indicators expose ARIA (FR-13)", () => {
  it("TC-041 the bar is a progressbar with min, max and now", () => {
    render(<ProgressBar value={42} label="Progress of Alpha" />);
    const bar = screen.getByRole("progressbar", { name: "Progress of Alpha" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("TC-041 the ring is a progressbar and clamps out-of-range values", () => {
    const { rerender } = render(<ProgressRing value={150} label="Ring" />);
    expect(screen.getByRole("progressbar", { name: "Ring" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    rerender(<ProgressRing value={-5} label="Ring" />);
    expect(screen.getByRole("progressbar", { name: "Ring" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("TC-041 rounds fractional values to whole percents", () => {
    render(<ProgressBar value={33.4} label="Bar" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });
});

describe("TC-070 the five states of a dynamic region (NFR-05)", () => {
  const base = {
    filtered: false,
    skeleton: <p>skeleton</p>,
    empty: { title: "Nothing yet", action: <button type="button">Create first</button> },
    onRetry: vi.fn(),
  };

  it("TC-070 loading: marks the region aria-busy and shows the skeleton", () => {
    const { container } = render(
      <RegionState {...base} status="loading" data={undefined}>
        {() => null}
      </RegionState>,
    );
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByText("skeleton")).toBeInTheDocument();
  });

  it("TC-074 success: renders the data", () => {
    render(
      <RegionState {...base} status="success" data={["a", "b"]}>
        {(items) => <p>{items.join("+")}</p>}
      </RegionState>,
    );
    expect(screen.getByText("a+b")).toBeInTheDocument();
  });

  it("TC-071 empty: shows the message and the create-first action", () => {
    render(
      <RegionState {...base} status="success" data={[]}>
        {() => null}
      </RegionState>,
    );
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create first" })).toBeInTheDocument();
  });

  it("TC-054 no-results: differs from empty and offers Clear filters", async () => {
    const onClear = vi.fn();
    render(
      <RegionState {...base} status="success" data={[]} filtered onClearFilters={onClear}>
        {() => null}
      </RegionState>,
    );
    expect(screen.getByRole("heading", { name: "No results" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create first" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("TC-072 error: announces a plain message, focuses Retry and retries", async () => {
    const onRetry = vi.fn();
    render(
      <RegionState {...base} onRetry={onRetry} status="error" data={undefined}>
        {() => null}
      </RegionState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("alert").textContent).not.toMatch(/Error:|at .*\(|stack/i);
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveFocus();
    await userEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("TC-072 ErrorState accepts custom copy", () => {
    render(<ErrorState title="Custom" body="Body text" onRetry={() => undefined} />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });
});

describe("TC-050 search field debounce (FR-15)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("TC-050 reports the value 250 ms after typing stops", () => {
    const onChange = vi.fn();
    render(<SearchField id="s" label="Search things" value="" onChange={onChange} />);
    const box = screen.getByRole("searchbox", { name: "Search things" });
    fireEvent.change(box, { target: { value: "ab" } });
    act(() => void vi.advanceTimersByTime(249));
    expect(onChange).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ab");
  });

  it("TC-050 adopts an external change such as Clear filters", () => {
    const { rerender } = render(
      <SearchField id="s" label="Search" value="old" onChange={() => undefined} />,
    );
    rerender(<SearchField id="s" label="Search" value="" onChange={() => undefined} />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

describe("TC-021 form fields link errors (FR-10)", () => {
  it("TC-021 the error is announced by aria-describedby and aria-invalid is set", () => {
    render(
      <FormField id="name" label="Name" error="Enter your name.">
        {(control) => <Input {...control} defaultValue="" />}
      </FormField>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter your name.");
  });

  it("TC-021 no error means no description and no invalid flag", () => {
    render(
      <FormField id="name" label="Name">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
  });

  it("TC-021 Select and Textarea take the same wiring", () => {
    render(
      <>
        <FormField id="s" label="Choice" error="Pick one">
          {(c) => (
            <Select {...c}>
              <option>a</option>
            </Select>
          )}
        </FormField>
        <FormField id="t" label="Notes" error="Too long">
          {(c) => <Textarea {...c} />}
        </FormField>
      </>,
    );
    expect(screen.getByLabelText("Choice")).toHaveAccessibleDescription("Pick one");
    expect(screen.getByLabelText("Notes")).toHaveAccessibleDescription("Too long");
  });
});

describe("TC-011 dialog and menus (FR-06, FR-08)", () => {
  it("TC-011 the dialog is labelled, closes on Escape and on the close button", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Menu" variant="drawer">
        <a href="/x">Link</a>
      </Dialog>,
    );
    expect(await screen.findByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("TC-011 the dialog traps focus inside itself", async () => {
    render(
      <>
        <button type="button">Outside</button>
        <Dialog open onOpenChange={() => undefined} title="Trap" description="About">
          <button type="button">Inside</button>
        </Dialog>
      </>,
    );
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(within(await screen.findByRole("dialog")).queryAllByRole("button")).toContain(
        document.activeElement,
      );
    }
  });

  it("TC-008 the profile menu opens by keyboard, selects, and closes on Escape", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<button type="button">Open</button>}
        items={[
          { value: "a", label: "Alpha", selected: true },
          { value: "b", label: "Beta" },
        ]}
        onSelect={onSelect}
      />,
    );
    screen.getByRole("button", { name: "Open" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Alpha" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: "Alpha" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});

describe("TC-016 filters and sort (FR-16)", () => {
  it("TC-051 toggling a checkbox reports the new selection and Clear resets", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <FilterBar
        active
        onClear={onClear}
        groups={[
          {
            id: "g",
            legend: "Status",
            options: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ],
            selected: ["a"],
            onChange,
          },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Status" });
    await userEvent.click(within(group).getByRole("checkbox", { name: "B" }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    await userEvent.click(within(group).getByRole("checkbox", { name: "A" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("TC-052 the sort menu changes the field and toggles direction", async () => {
    const onSort = vi.fn();
    const onDir = vi.fn();
    render(
      <SortMenu
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
        sort="a"
        dir="asc"
        onSort={onSort}
        onDir={onDir}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Sort: Alpha/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));
    expect(onSort).toHaveBeenCalledWith("b");
    await userEvent.click(screen.getByRole("button", { name: /Ascending/ }));
    expect(onDir).toHaveBeenCalledWith("desc");
  });
});

describe("TC-030 primitives", () => {
  it("TC-030 a badge always carries text, and icon buttons need a name", () => {
    render(
      <>
        <Badge tone="danger" icon="alert">
          Overdue
        </Badge>
        <IconButton label="Close">
          <Icon name="x" />
        </IconButton>
      </>,
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("TC-061 buttons carry the touch-target class that grows them on coarse pointers", () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("touch-target");
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });

  it("TC-030 skeletons and spinners are hidden from assistive tech", () => {
    const { container } = render(
      <>
        <Skeleton className="h-4" />
        <Spinner />
      </>,
    );
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(2);
  });

  it("TC-030 avatar initials and the class helper", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Cher")).toBe("CH");
    expect(initials("  ")).toBe("?");
    expect(cn("a", false, "b")).toBe("a b");
    render(<Avatar name="Ada Lovelace" size="lg" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("TC-030 empty state, card, checkbox and tooltip render", async () => {
    const onCheck = vi.fn();
    render(
      <Card>
        <EmptyState title="Empty" body="Body" />
        <Checkbox id="c" label="Check me" checked={false} onCheckedChange={onCheck} />
        <Tooltip content="Tip">
          <button type="button">Hover</button>
        </Tooltip>
      </Card>,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Check me" }));
    expect(onCheck).toHaveBeenCalledWith(true);
    await userEvent.hover(screen.getByRole("button", { name: "Hover" }));
    expect(await screen.findAllByText("Tip")).not.toHaveLength(0);
  });
});
