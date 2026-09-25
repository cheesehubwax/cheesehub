// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import * as L from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { TokenLogo } from "@/components/TokenLogo";
import { VenueLogo } from "@/components/anal/VenueLogo";

describe("probe", () => {
  it("renders each piece", () => {
    const cases: [string, React.ReactElement][] = [
      ["Button", <Button key="b">x</Button>],
      ["Slider", <Slider key="s" value={[1]} />],
      ["Select", <Select key="c"><div/></Select>],
      ["Tooltip", <Tooltip key="t"><TooltipTrigger/></Tooltip>],
      ["TokenLogo", <TokenLogo key="l" contract="a" symbol="B" />],
      ["VenueLogo", <VenueLogo key="v" venue="alcor" />],
      ["Minus", <L.Minus key="m" className="h-3" />],
    ];
    const failed: string[] = [];
    for (const [name, el] of cases) {
      const orig = console.error;
      console.error = () => {};
      try { render(el); } catch (e) { failed.push(name + ": " + (e as Error).message.slice(0, 80)); }
      console.error = orig;
      document.body.innerHTML = "";
    }
    console.log("FAILED:", failed);
    expect(true).toBe(true);
  });
});
