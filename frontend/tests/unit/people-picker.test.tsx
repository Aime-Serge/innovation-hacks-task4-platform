// MF-11: the people picker combobox (search, results, keyboard, privacy switch).
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeoplePicker } from "@/features/tasks/PeoplePicker";
import { installScenario } from "./mock-services";
import { renderApp } from "./render";

vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));

beforeEach(() => installScenario("default"));

function Picker({ onChange }: { onChange: (id: string | null) => void }) {
  return <PeoplePicker id="picker" value={null} knownUsers={[]} onChange={onChange} />;
}

describe("MF-11 people picker", () => {
  it("requires at least 2 characters before searching", async () => {
    const user = userEvent.setup();
    renderApp(<Picker onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "a");
    expect(screen.getByText("Type at least 2 characters to search.")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows matching members and selects one with the keyboard", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderApp(<Picker onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "Amara");
    expect(await screen.findByRole("option", { name: /Amara Diallo/ })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("user-2");
    expect(input).toHaveValue("Amara Diallo");
  });

  it("hides the professional details of a member whose privacy switch is off (MB-02)", async () => {
    const user = userEvent.setup();
    renderApp(<Picker onChange={vi.fn()} />);
    await user.type(screen.getByRole("combobox"), "Kwame");
    const option = await screen.findByRole("option", { name: /Kwame Mensah/ });
    expect(option).not.toHaveTextContent("Mobile");
  });

  it("Escape closes the list", async () => {
    const user = userEvent.setup();
    renderApp(<Picker onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "Amara");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("clears the assignee", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderApp(<PeoplePicker id="picker" value="user-2" knownUsers={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Clear assignee" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
