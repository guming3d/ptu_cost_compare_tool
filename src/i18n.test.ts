import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  getUiText,
  localizeExplanationText,
} from "./i18n";

describe("UI translations", () => {
  it("defaults to English", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(getUiText(DEFAULT_LANGUAGE).header.language).toBe("Language");
  });

  it("provides Simplified Chinese UI and calculation labels", () => {
    expect(getUiText("zh-CN").hero.title).toBe("比较 PTU 与 PayGO 成本");
    expect(localizeExplanationText("Required PTU Num", "zh-CN")).toBe(
      "所需 PTU 数",
    );
  });
});
