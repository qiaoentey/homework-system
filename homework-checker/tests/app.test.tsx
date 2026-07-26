import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app/App";

describe("App", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));

  it("opens grade 1 mathematics from the answer library", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "快速查答案" }));
    await user.click(screen.getByRole("button", { name: "一年级" }));
    await user.click(screen.getByRole("button", { name: "数学" }));
    expect(screen.getByRole("link", { name: "打开一年级数学 PDF" }))
      .toHaveAttribute("href", "/pdf/1年级_数学_活动本答案影片索引.pdf");
  });
});
