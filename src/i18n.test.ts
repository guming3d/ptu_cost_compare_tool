import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  getUiText,
  localizeDeployment,
  localizeExplanationText,
} from "./i18n";

describe("UI translations", () => {
  it("defaults to English", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(getUiText(DEFAULT_LANGUAGE).header.language).toBe("Language");
  });

  it("provides Simplified Chinese UI and calculation labels", () => {
    expect(getUiText("zh-CN").hero.title).toBe("比较 PTU 与 PayGO 成本");
    expect(getUiText("zh-CN").optimizer.title).toBe("最佳 PTU 配置");
    expect(localizeExplanationText("Required PTU Num", "zh-CN")).toBe(
      "所需 PTU 数",
    );
  });

  it("localizes Global-only results and commitment explanations", () => {
    expect(localizeDeployment("Global", "en")).toBe("Global");
    expect(localizeDeployment("Global", "zh-CN")).toBe("全局");
    expect(localizeExplanationText("Monthly commitment; Global.", "zh-CN")).toBe("按月承诺；全局。");
  });
});
