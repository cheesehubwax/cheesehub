import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FarmTutorialVideo } from "./FarmTutorialVideo";

afterEach(() => {
  vi.useRealTimers();
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  document.querySelector('script[src="https://www.youtube.com/iframe_api"]')?.remove();
});

describe("FarmTutorialVideo", () => {
  it("shows a visible tutorial cover before loading YouTube", () => {
    render(<FarmTutorialVideo />);

    expect(screen.getByAltText("WaxDAO V2 NFT Farms explained tutorial")).toBeVisible();
    expect(screen.getByRole("button", { name: "Play farm creation tutorial" })).toBeVisible();
    expect(screen.getByRole("link", { name: /watch on youtube/i })).toBeVisible();
  });

  it("keeps the cover visible while the player loads", () => {
    render(<FarmTutorialVideo />);
    fireEvent.click(screen.getByRole("button", { name: "Play farm creation tutorial" }));

    expect(screen.getByText("Loading video…")).toBeVisible();
    expect(screen.getByAltText("WaxDAO V2 NFT Farms explained tutorial")).toBeVisible();
  });

  it("shows a direct YouTube fallback after a loading timeout", async () => {
    vi.useFakeTimers();
    render(<FarmTutorialVideo />);
    fireEvent.click(screen.getByRole("button", { name: "Play farm creation tutorial" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText("The YouTube player could not load here.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: /watch on youtube/i })).toHaveLength(2);
  });

  it("reveals the player only after YouTube reports it ready", async () => {
    window.YT = {
      Player: class {
        destroy() {}
        constructor(_element: HTMLElement, options: { events: { onReady: () => void } }) {
          options.events.onReady();
        }
      },
    };

    render(<FarmTutorialVideo />);
    fireEvent.click(screen.getByRole("button", { name: "Play farm creation tutorial" }));

    await act(async () => Promise.resolve());
    expect(screen.queryByAltText("WaxDAO V2 NFT Farms explained tutorial")).not.toBeInTheDocument();
  });
});