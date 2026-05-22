export interface SummaryInput {
  hasAC?: boolean | null;
  bathroomStyle?: string;
  dormType?: string;
  freshmanEligible?: boolean;
  yearlyCost?: number | null;
  collegeAvgCost?: number;
  kitchenAccess?: boolean | null;
  upperclassEligible?: boolean;
  honorsHousing?: boolean;
  socialVibe?: number | null;
  quietVibe?: number | null;
}

export function generateRuleBasedSummary(input: SummaryInput): string {
  const parts: string[] = [];

  if (input.hasAC && input.bathroomStyle === "SUITE" && (input.yearlyCost ?? 0) > (input.collegeAvgCost ?? 15000)) {
    parts.push("This dorm is likely comfortable (AC + suite bathrooms) but on the expensive side.");
  }
  if (input.freshmanEligible && input.bathroomStyle === "COMMUNAL") {
    parts.push("May be more social with communal bathrooms — common for freshmen meeting hallmates.");
  }
  if (input.dormType === "APARTMENT" && input.kitchenAccess && input.upperclassEligible) {
    parts.push("Fits students who want independence — apartment-style with kitchen access.");
  }
  if (input.honorsHousing) {
    parts.push("Honors or themed community — often quieter and academically focused.");
  }
  if ((input.socialVibe ?? 0) >= 8) {
    parts.push("Students often describe it as lively and social.");
  }
  if ((input.quietVibe ?? 0) >= 8) {
    parts.push("Tends to be quieter — better if you prioritize sleep and study.");
  }
  if (!input.hasAC) {
    parts.push("Note: may not have air conditioning — check official housing info for your building.");
  }

  if (parts.length === 0) {
    return "A solid on-campus option — review room types, costs, and official housing pages before deciding.";
  }

  return parts.join(" ");
}

export async function generateAISummary(
  input: SummaryInput,
  openaiKey?: string
): Promise<string | null> {
  if (!openaiKey) return null;

  try {
    const prompt = `Summarize this college dorm in 2 sentences for a student: ${JSON.stringify(input)}`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
