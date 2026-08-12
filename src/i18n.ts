import type { CommitmentType, DeploymentType } from "./types";

export type Language = "en" | "zh-CN";

export const DEFAULT_LANGUAGE: Language = "en";

export const languageOptions: ReadonlyArray<{
  value: Language;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
];

const UI_TEXT = {
  en: {
    header: {
      homeLabel: "Azure Foundry PTU Cost Planner home",
      navigationLabel: "Page navigation",
      calculator: "Calculator",
      sizingGuide: "Microsoft sizing guide",
      language: "Language",
    },
    hero: {
      title: "Compare PTU and PayGO cost",
      description:
        "Estimate provisioned capacity, monthly spend, utilization, and cost efficiency across the bundled model catalog.",
      models: "Models",
      catalogVerified: "Catalog verified",
      currency: "Currency",
    },
    calculator: {
      ariaLabel: "Workload inputs",
      heading: "Model and traffic",
      model: "Model",
      inputTokens: "Input tokens / request",
      outputTokens: "Output tokens / request",
      rpm: "Requests per minute",
      cacheHitRate: "Cache hit rate",
      provisionedDeployment: "Provisioned deployment",
      globalDataZone: "Global / Data Zone",
      regional: "Regional",
      requiredPtus: "Required PTUs",
      publishedCapacity: "Published capacity",
      benchmarkHint: "input TPM/PTU. Enter a benchmarked capacity estimate.",
      commitment: "Commitment",
      monthly: "Monthly",
      yearly: "Yearly",
      imageInputs: "Image inputs",
      optionalImage: "Optional image workload per request.",
      noImageRule: "This model has no image sizing rule in the catalog.",
      addImage: "Add image",
      image: "Image",
      width: "width",
      height: "height",
      low: "Low",
      high: "High",
      removeImage: "Remove image",
      requiredCapacity: "Required capacity",
      deployableCapacity: "Deployable capacity",
      normalizedTpm: "normalized TPM",
      addComparison: "Add comparison",
      clear: "Clear",
    },
    summary: {
      ariaLabel: "Current cost estimate",
      paygoEstimate: "PayGO estimate",
      ptuEstimate: "PTU estimate",
      estimatedSavings: "Estimated savings",
      perMonth: "per month",
      ptuVersusPaygo: "PTU versus PayGO",
    },
    optimizer: {
      ariaLabel: "PTU configuration optimizer",
      title: "Best PTU configuration",
      description:
        "Compare every available commitment and deployment option for this model at the current workload.",
      bestConfiguration: "Lowest-cost configuration",
      saves: "Saves",
      paygoLowerBy: "PayGO is lower by",
      perMonthAt: "per month at",
      breakEven: "Estimated first break-even",
      breakEvenNotReached: "No break-even is shown in this traffic range.",
      chartAriaLabel:
        "Monthly PayGO and PTU cost lines by requests per minute and configuration",
      rpmAxis: "Requests per minute (RPM)",
      currentTraffic: "Current traffic",
      legend: "Cost line legend and current monthly values",
      assumptions:
        "The curve keeps the current tokens per request, cache rate, images, and manual PTU estimate fixed. PTU lines step upward because capacity is rounded to deployable units.",
    },
    results: {
      ariaLabel: "Results",
      comparison: "Comparison",
      calculationDetails: "Calculation details",
      exportExcel: "Export Excel",
      emptyTitle: "Add a scenario to start comparing.",
      emptyDescription:
        "The current estimate updates live. Add it to keep a snapshot and compare another model or commitment.",
      model: "Model",
      workload: "Workload",
      commitment: "Commitment",
      requiredDeployed: "Required / deployed",
      utilization: "Utilization",
      paygoMonth: "PayGO / month",
      ptuMonth: "PTU / month",
      savings: "Savings",
      actions: "Actions",
      inputShort: "in",
      outputShort: "out",
      remove: "Remove",
      monthlyPtuCost: "Monthly PTU cost",
      monthlyPtuCostDescription:
        "Provisioned cost after the configured commitment discount.",
      throughputEfficiency: "Throughput efficiency",
      throughputEfficiencyDescription:
        "Millions of workload tokens per minute for each PTU dollar.",
    },
    explanation: {
      note:
        "Each trace is captured when its comparison is added, so later input changes do not alter existing calculations.",
      capturedInputs: "Captured inputs and prices",
      formula: "Formula",
      substitution: "Substitution",
    },
    reference: {
      title: "Reference formulas",
      description:
        "The calculator keeps the original monthly cost and throughput rules, presented here in a more compact format.",
      utilization: "PTU utilization",
      utilizationFormula: "required PTUs / rounded deployable PTUs x 100",
      paygoCost: "PayGO monthly cost",
      paygoFormula:
        "tokens/request x RPM x 60 x 24 x 30.42 / 1,000 x token price",
      automaticEstimate: "Automatic PTU estimate",
      automaticFormula:
        "(input TPM + output ratio x output TPM) / input TPM per PTU",
      efficiency: "TPM per dollar",
      efficiencyFormula:
        "workload TPM / PTU cost per minute / 1,000,000",
    },
    catalog: {
      title: "Model catalog",
      models: "models",
      verified: "verified",
      jsonLabel: "Model catalog JSON",
      save: "Save catalog",
      restore: "Restore bundled catalog",
      invalid:
        "The catalog must contain metadata and at least one model with all required pricing fields.",
      invalidJson: "Invalid catalog JSON.",
      saved: "Catalog saved in this browser.",
      restored: "Bundled catalog restored.",
    },
    export: {
      modelName: "Model Name",
      provider: "Provider",
      inputTokens: "Input Token Number",
      imageTokens: "Input Image Tokens",
      cacheHitRate: "Cache Hit Rate (%)",
      outputTokens: "Output Token Number",
      rpm: "RPM",
      commitment: "Commitment Type",
      deployment: "Deployment Type",
      requiredPtus: "Required PTU Num",
      deployedPtus: "Deployed PTUs",
      utilization: "PTU Utilization (%)",
      paygoCost: "PayGO cost",
      ptuCost: "PTU cost",
      efficiency: "TPM per dollar (in millions)",
      savings: "PTU Cost Saving (%)",
    },
    footer: {
      disclaimer:
        "Pricing is indicative and can vary by geography, agreement, and deployment type.",
      author: "Author",
    },
    errors: {
      calculate: "Unable to calculate scenario.",
    },
  },
  "zh-CN": {
    header: {
      homeLabel: "Azure Foundry PTU 成本规划器首页",
      navigationLabel: "页面导航",
      calculator: "计算器",
      sizingGuide: "Microsoft 容量规划指南",
      language: "语言",
    },
    hero: {
      title: "比较 PTU 与 PayGO 成本",
      description:
        "基于内置模型目录，估算预配容量、月度支出、利用率和成本效率。",
      models: "模型数",
      catalogVerified: "目录验证日期",
      currency: "币种",
    },
    calculator: {
      ariaLabel: "工作负载输入",
      heading: "模型与流量",
      model: "模型",
      inputTokens: "每次请求的输入令牌",
      outputTokens: "每次请求的输出令牌",
      rpm: "每分钟请求数",
      cacheHitRate: "缓存命中率",
      provisionedDeployment: "预配部署类型",
      globalDataZone: "全局 / 数据区域",
      regional: "区域",
      requiredPtus: "所需 PTU",
      publishedCapacity: "已发布容量",
      benchmarkHint: "输入 TPM/PTU。请输入经过基准测试的容量估算值。",
      commitment: "承诺周期",
      monthly: "按月",
      yearly: "按年",
      imageInputs: "图像输入",
      optionalImage: "可选：每次请求的图像工作负载。",
      noImageRule: "目录中没有此模型的图像容量规划规则。",
      addImage: "添加图像",
      image: "图像",
      width: "宽度",
      height: "高度",
      low: "低",
      high: "高",
      removeImage: "移除图像",
      requiredCapacity: "所需容量",
      deployableCapacity: "可部署容量",
      normalizedTpm: "标准化 TPM",
      addComparison: "添加对比",
      clear: "清除",
    },
    summary: {
      ariaLabel: "当前成本估算",
      paygoEstimate: "PayGO 估算",
      ptuEstimate: "PTU 估算",
      estimatedSavings: "预计节省",
      perMonth: "每月",
      ptuVersusPaygo: "PTU 相比 PayGO",
    },
    optimizer: {
      ariaLabel: "PTU 配置优化器",
      title: "最佳 PTU 配置",
      description: "按当前工作负载比较此模型所有可用的承诺周期和部署选项。",
      bestConfiguration: "成本最低的配置",
      saves: "每月节省",
      paygoLowerBy: "PayGO 每月低",
      perMonthAt: "，当前流量",
      breakEven: "预计首次盈亏平衡点",
      breakEvenNotReached: "当前流量范围内未显示盈亏平衡点。",
      chartAriaLabel: "按每分钟请求数和配置展示的 PayGO 与 PTU 月度成本曲线",
      rpmAxis: "每分钟请求数（RPM）",
      currentTraffic: "当前流量",
      legend: "成本曲线图例和当前月度价格",
      assumptions:
        "曲线固定使用当前每次请求令牌数、缓存命中率、图像和手动 PTU 估算。由于容量会向上取整为可部署单元，PTU 曲线呈阶梯式变化。",
    },
    results: {
      ariaLabel: "结果",
      comparison: "对比结果",
      calculationDetails: "计算明细",
      exportExcel: "导出 Excel",
      emptyTitle: "添加场景后即可开始对比。",
      emptyDescription:
        "当前估算会实时更新。添加场景可保存快照，并继续比较其他模型或承诺周期。",
      model: "模型",
      workload: "工作负载",
      commitment: "承诺周期",
      requiredDeployed: "所需 / 已部署",
      utilization: "利用率",
      paygoMonth: "PayGO / 月",
      ptuMonth: "PTU / 月",
      savings: "节省",
      actions: "操作",
      inputShort: "输入",
      outputShort: "输出",
      remove: "移除",
      monthlyPtuCost: "每月 PTU 成本",
      monthlyPtuCostDescription: "应用所配置承诺折扣后的预配成本。",
      throughputEfficiency: "吞吐效率",
      throughputEfficiencyDescription:
        "每一美元 PTU 成本对应的每分钟百万工作负载令牌数。",
    },
    explanation: {
      note:
        "每条计算记录会在添加对比时保存，因此之后修改输入不会影响已有结果。",
      capturedInputs: "已记录的输入和价格",
      formula: "公式",
      substitution: "代入值",
    },
    reference: {
      title: "参考公式",
      description: "以下以简洁形式列出计算器采用的月度成本和吞吐量规则。",
      utilization: "PTU 利用率",
      utilizationFormula: "所需 PTU / 向上取整后的可部署 PTU x 100",
      paygoCost: "PayGO 月度成本",
      paygoFormula:
        "每次请求令牌数 x RPM x 60 x 24 x 30.42 / 1,000 x 令牌价格",
      automaticEstimate: "自动 PTU 估算",
      automaticFormula:
        "（输入 TPM + 输出比率 x 输出 TPM）/ 每 PTU 输入 TPM",
      efficiency: "每美元 TPM",
      efficiencyFormula:
        "工作负载 TPM / 每分钟 PTU 成本 / 1,000,000",
    },
    catalog: {
      title: "模型目录",
      models: "个模型",
      verified: "验证日期",
      jsonLabel: "模型目录 JSON",
      save: "保存目录",
      restore: "恢复内置目录",
      invalid: "目录必须包含元数据，以及至少一个具备全部必需价格字段的模型。",
      invalidJson: "目录 JSON 无效。",
      saved: "目录已保存到此浏览器。",
      restored: "已恢复内置目录。",
    },
    export: {
      modelName: "模型名称",
      provider: "提供商",
      inputTokens: "输入令牌数",
      imageTokens: "输入图像令牌数",
      cacheHitRate: "缓存命中率（%）",
      outputTokens: "输出令牌数",
      rpm: "每分钟请求数",
      commitment: "承诺周期",
      deployment: "部署类型",
      requiredPtus: "所需 PTU 数",
      deployedPtus: "已部署 PTU",
      utilization: "PTU 利用率（%）",
      paygoCost: "PayGO 成本",
      ptuCost: "PTU 成本",
      efficiency: "每美元 TPM（百万）",
      savings: "PTU 成本节省（%）",
    },
    footer: {
      disclaimer: "价格仅供参考，可能因地域、协议和部署类型而异。",
      author: "作者",
    },
    errors: {
      calculate: "无法计算此场景。",
    },
  },
} as const;

const ZH_EXPLANATION_TEXT: Record<string, string> = {
  "Monthly requests": "每月请求数",
  "Monthly PayGO input cost": "每月 PayGO 输入成本",
  "Monthly PayGO output cost": "每月 PayGO 输出成本",
  "PayGO cost": "PayGO 成本",
  "Effective text input tokens": "有效文本输入令牌",
  "Normalized TPM": "标准化 TPM",
  "Required PTU Num": "所需 PTU 数",
  "Deployable PTUs": "可部署 PTU",
  "PTU Utilization": "PTU 利用率",
  "PTU cost": "PTU 成本",
  "TPM per dollar (in millions)": "每美元 TPM（百万）",
  "PTU Cost Saving (%)": "PTU 成本节省（%）",
  "requests/month": "请求/月",
  "USD/month": "美元/月",
  "tokens/request": "令牌/请求",
  "normalized tokens/minute": "标准化令牌/分钟",
  "raw PTUs": "原始 PTU",
  "raw GSUs": "原始 GSU",
  "million TPM/USD": "百万 TPM/美元",
  "Monthly requests = RPM x 60 x 24 x 30.42":
    "每月请求数 = RPM x 60 x 24 x 30.42",
  "(non-cached tokens x monthly requests / 1,000 x input price) + (cached tokens x monthly requests / 1,000 x cached price)":
    "（未缓存令牌 x 每月请求数 / 1,000 x 输入价格）+（缓存令牌 x 每月请求数 / 1,000 x 缓存价格）",
  "output tokens x monthly requests / 1,000 x output price":
    "输出令牌 x 每月请求数 / 1,000 x 输出价格",
  "PayGO cost = input cost + output cost":
    "PayGO 成本 = 输入成本 + 输出成本",
  "input tokens x (1 - cache hit rate / 100)":
    "输入令牌 x（1 - 缓存命中率 / 100）",
  "RPM x (effective text input + image input) + output ratio x (RPM x output tokens)":
    "RPM x（有效文本输入 + 图像输入）+ 输出比率 x（RPM x 输出令牌）",
  "normalized TPM / input TPM per PTU":
    "标准化 TPM / 每 PTU 输入 TPM",
  "(input tokens + image estimate + output ratio x output tokens) x 4 x (RPM / 60) / characters per GSU":
    "（输入令牌 + 图像估算 + 输出比率 x 输出令牌）x 4 x（RPM / 60）/ 每 GSU 字符数",
  "Required PTUs = user supplied capacity estimate":
    "所需 PTU = 用户提供的容量估算",
  "max(minimum PTUs, ceil(required PTUs / scale increment) x scale increment)":
    "max（最低 PTU，ceil（所需 PTU / 扩容步长）x 扩容步长）",
  "required PTUs / deployed PTUs x 100":
    "所需 PTU / 已部署 PTU x 100",
  "deployed PTUs x PTU unit price x (1 - discount)":
    "已部署 PTU x PTU 单价 x（1 - 折扣）",
  "total workload TPM / monthly PTU cost per minute / 1,000,000":
    "总工作负载 TPM / 每月 PTU 成本折算的每分钟成本 / 1,000,000",
  "(PayGO cost - PTU cost) / PayGO cost x 100":
    "（PayGO 成本 - PTU 成本）/ PayGO 成本 x 100",
  "Microsoft publishes input TPM per PTU for this model but not the output-token weighting needed for an automatic mixed-workload estimate.":
    "Microsoft 发布了此模型的每 PTU 输入 TPM，但未提供自动估算混合工作负载所需的输出令牌权重。",
  inputTextTokens: "输入文本令牌",
  inputImageTokens: "输入图像令牌",
  outputTokens: "输出令牌",
  rpm: "每分钟请求数",
  cacheHitRate: "缓存命中率",
  minimumPtus: "最低 PTU",
  scaleIncrement: "扩容步长",
  inputPricePer1k: "每千输入令牌价格",
  cachedInputPricePer1k: "每千缓存输入令牌价格",
  outputPricePer1k: "每千输出令牌价格",
  ptuPricePerUnit: "PTU 单价",
  ptuDiscount: "PTU 折扣",
  "Global / Data Zone": "全局 / 数据区域",
  Regional: "区域",
  "Configured default": "配置的默认值",
  Monthly: "按月",
  Yearly: "按年",
};

export function getUiText(language: Language) {
  return UI_TEXT[language];
}

export function getLocale(language: Language): string {
  return language === "zh-CN" ? "zh-CN" : "en-US";
}

export function localizeCommitment(
  commitment: CommitmentType,
  language: Language,
): string {
  return language === "zh-CN"
    ? ZH_EXPLANATION_TEXT[commitment]
    : commitment;
}

export function localizeDeployment(
  deployment: DeploymentType | string,
  language: Language,
): string {
  return language === "zh-CN"
    ? (ZH_EXPLANATION_TEXT[deployment] ?? deployment)
    : deployment;
}

export function localizeExplanationText(
  value: string,
  language: Language,
): string {
  if (language !== "zh-CN") {
    return value;
  }

  const exact = ZH_EXPLANATION_TEXT[value];
  if (exact) {
    return exact;
  }

  const inputNote = value.match(
    /^([\d,.]+) input tokens per request at a ([\d.]+)% cache-hit rate\.$/,
  );
  if (inputNote) {
    return `每次请求 ${inputNote[1]} 个输入令牌，缓存命中率为 ${inputNote[2]}%。`;
  }

  const imageNote = value.match(
    /^([\d,.]+) calculated image input tokens are used for PTU sizing and TPM-per-dollar, matching the original tool\.$/,
  );
  if (imageNote) {
    return `使用计算得到的 ${imageNote[1]} 个图像输入令牌进行 PTU 容量和每美元 TPM 计算，与原工具保持一致。`;
  }

  const commitmentNote = value.match(
    /^(Monthly|Yearly) commitment; (.+)\.$/,
  );
  if (commitmentNote) {
    return `${ZH_EXPLANATION_TEXT[commitmentNote[1]] ?? commitmentNote[1]}承诺；${
      ZH_EXPLANATION_TEXT[commitmentNote[2]] ?? commitmentNote[2]
    }。`;
  }

  if (value.startsWith("Required PTUs = ")) {
    return value.replace("Required PTUs = ", "所需 PTU = ");
  }

  return value;
}
