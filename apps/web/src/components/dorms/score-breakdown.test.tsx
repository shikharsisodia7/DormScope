import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ScoreBreakdown, type ScoreBreakdownData } from "./score-breakdown";

const unknownScore: ScoreBreakdownData = {
  overallScore: null,
  scoreable: false,
  valueScore: null,
  comfortScore: null,
  privacyScore: null,
  socialScore: null,
  convenienceScore: null,
  freshmanFitScore: null,
  amenityScore: null,
  dataConfidenceScore: null,
};

describe("ScoreBreakdown", () => {
  it('shows "Unknown" for null components, not 0', async () => {
    const user = userEvent.setup();
    render(<ScoreBreakdown score={unknownScore} />);

    await user.click(screen.getByRole("button", { name: /show breakdown/i }));

    const unknownLabels = screen.getAllByText("Unknown");
    expect(unknownLabels.length).toBeGreaterThan(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
