import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PwaUpdatePrompt, type RegisterServiceWorkerHook } from "../src/pwa/PwaUpdatePrompt";

const registration = (
  needRefresh: boolean,
  updateServiceWorker = vi.fn().mockResolvedValue(undefined),
): ReturnType<RegisterServiceWorkerHook> => ({
  needRefresh: [needRefresh, vi.fn()],
  offlineReady: [false, vi.fn()],
  updateServiceWorker,
});

describe("PwaUpdatePrompt", () => {
  it("does not interrupt a client when no update is waiting", () => {
    render(<PwaUpdatePrompt useRegistration={() => registration(false)} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("activates a waiting worker only after the teacher accepts a reload", async () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    render(<PwaUpdatePrompt useRegistration={() => registration(true, updateServiceWorker)} />);

    expect(screen.getByRole("status")).toHaveTextContent("新版本已准备好");
    expect(updateServiceWorker).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "更新并重新载入" }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
