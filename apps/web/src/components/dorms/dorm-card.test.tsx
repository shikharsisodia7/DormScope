import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DormCard, type DormCardData } from "./dorm-card";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const baseDorm: DormCardData = {
  id: "1",
  name: "Test Hall",
  slug: "test-hall",
  college: { name: "Test University", slug: "test-u", state: "CA" },
};

describe("DormCard", () => {
  it('shows "More data needed" when overallScore is null', () => {
    const { container } = render(
      <DormCard
        dorm={{
          ...baseDorm,
          dormScore: { overallScore: null, scoreable: true },
        }}
      />,
    );

    expect(screen.getByText("More data needed")).toBeInTheDocument();
    expect(container.querySelector(".text-2xl")).not.toBeInTheDocument();
  });

  it('shows "More data needed" when scoreable is false', () => {
    const { container } = render(
      <DormCard
        dorm={{
          ...baseDorm,
          dormScore: { overallScore: 82, scoreable: false },
        }}
      />,
    );

    expect(screen.getByText("More data needed")).toBeInTheDocument();
    expect(container.querySelector(".text-2xl")).not.toBeInTheDocument();
    expect(screen.queryByText("82")).not.toBeInTheDocument();
  });
});
