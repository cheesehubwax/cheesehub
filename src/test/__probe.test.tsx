// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

describe("probe2", () => {
  it("renders combos", () => {
    const cases: [string, React.ReactElement][] = [
      ["Tooltip full", <Tooltip key="t"><TooltipTrigger asChild><span/></TooltipTrigger><TooltipContent>x</TooltipContent></Tooltip>],
      ["Select full", <Select key="s" onValueChange={() => {}}><SelectTrigger><SelectValue placeholder="p" /></SelectTrigger><SelectContent><SelectItem value="v">v</SelectItem></SelectContent></Select>],
      ["Icons", <div key="i"><Minus className="h-3" /><Plus className="h-3" /><RotateCcw className="h-3" /><X className="h-3" /></div>],
      ["Button icon", <Button key="b" variant="ghost" size="icon" className="h-6 w-6"><X className="h-3.5" /></Button>],
    ];
    const failed: string[] = [];
    for (const [name, el] of cases) {
      const orig = console.error; console.error = () => {};
      try { render(el); console.log(name, "OK"); } catch (e) { failed.push(`${name}: ${(e as Error).message.slice(0, 60)}`); }
      console.error = orig; document.body.innerHTML = "";
    }
    console.log("FAILED2:", failed);
    expect(true).toBe(true);
  });
});
