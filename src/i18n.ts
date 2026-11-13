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
    workspace: {
      ariaLabel: "Workspace mode",
      estimationTab: "PTU Estimation",
      comparisonTab: "PTU vs PayGO Comparison",
    },
    guide: {
      title: "Quick start",
      dismiss: "Dismiss",
      reopen: "Show guide",
      step: "Step",
      of: "of",
      modelTitle: "Choose a model",
      modelDescription: "Select the model you plan to deploy. Available sizing rules and fields will adapt to it.",
      tokensTitle: "Enter tokens per request",
      tokensDescription: "Enter your typical input and output tokens. Fill in any model-specific fields shown below.",
      trafficTitle: "Set peak traffic",
      trafficDescription: "Enter peak requests per minute and adjust caching or deployment settings as needed.",
      resultTitle: "Read the PTU estimate",
      resultDescription: "The target PTU count updates automatically on the right. Expand the calculation steps to see why.",
      goToStep: "Go to field",
      back: "Back",
      next: "Next",
      finish: "Finish",
    },
    estimation: {
      summaryAriaLabel: "Target PTU summary",
      liveBadge: "Live sizing",
      targetStepBadge: "Target output",
      saveToComparison: "Add to comparison",
      savedFeedback: "Added to comparison",
      compareWithPaygo: "Compare PTU vs PayGO",
      targetPtus: "Target deployable PTUs",
      rawRequiredPtus: "Raw required capacity",
      utilization: "Utilization",
      normalizedThroughput: "Normalized throughput",
      workloadThroughput: "Workload throughput",
      monthlyPtuCost: "Monthly PTU cost",
      perMonth: "per month",
      minUnit: "Min",
      incrementUnit: "increment",
      tpmPerPtu: "input TPM / PTU",
      backendCalculationTitle: "How backend calculates target PTUs",
      backendCalculationDescription:
        "From your peak traffic to a deployable PTU count. Values update with your workload inputs.",
      flowAriaLabel: "Three stages of PTU sizing",
      flowWorkload: "Start with your workload",
      flowWorkloadDescription: "Peak requests per minute and tokens per request set the demand.",
      flowDemand: "Calculate required capacity",
      flowDemandDescription: "Apply this model's sizing rule to find the unrounded PTUs needed.",
      flowDeployment: "Round to a deployable size",
      flowDeploymentDescription: "Meet the minimum and round up to the allowed PTU increment.",
      flowCaption: "The target is rounded up so the deployment can handle the estimated peak demand.",
      showCalculationSteps: "See how each value is calculated",
      stepEffectiveInput: "Weight the different input token types before calculating capacity.",
      stepNormalizedTpm: "Turn weighted tokens per request into tokens per minute at peak traffic.",
      stepRequiredPtus: "Convert peak demand into the raw PTU capacity needed, before rounding.",
      requiredStepLabel: "Required PTUs",
      requiredGsuStepLabel: "Required GSUs",
      stepDeployablePtus: "Round raw capacity up to the model's minimum and deployment increment.",
      stepUtilization: "Show what fraction of deployed capacity the estimated workload uses.",
      stepCost: "Price the deployed PTUs using the selected commitment and discount.",
      stepEfficiency: "Compare throughput with the cost per minute of the deployment.",
      activeSizingParameters: "Active sizing parameters and catalog rules",
      sizingGuide: "Microsoft sizing guide",
      formula: "Formula",
      substitution: "Substitution",
      unavailableTitle: "Complete workload inputs to calculate target PTUs",
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
      rpmHint: "PTU sizing uses peak RPM. PayGO assumes this rate continuously for 30.42 days, not a separate monthly average.",
      cacheHitRate: "Cache hit rate",
      contextMode: "Context pricing tier",
      shortContext: "Short context",
      longContext: "Long context",
      normalizedContextHint: "Select the applicable tier. All token weights use the short-context input price as their baseline; see the live normalization breakdown on the right.",
      cacheWriteTokens: "Cache write tokens / request",
      cacheWriteHint: "Defaults to input tokens x (1 - cache hit rate / 100). Edit to override; reads plus writes cannot exceed total input.",
      useAutomaticCacheWrites: "Use automatic cache writes",
      textInputTokens: "Text input tokens / request",
      imageInputTokens: "Image input tokens / request",
      imageOutputTokens: "Image output tokens / request",
      imageTokenHint: "Use measured, model-specific totals per request for all generated images and previews. Text input excludes image tokens; dimensions and the shared output default are not token estimates.",
      imageCacheHint: "Image caching is not modeled. All input is uncached; direct Images API calls do not receive cached-input pricing.",
      imagePaygoScopeHint: "PayGO benchmark, independent of PTU deployment:",
      unverifiedPaygoScope: "Unspecified; verify the catalog scope.",
      provisionedDeployment: "Provisioned deployment",
      globalDataZone: "Global / Data Zone",
      globalProvisionedOnly: "Global Provisioned only. Data Zone is not supported.",
      paygoRetired: "PayGO retired; PTU remains supported. PayGO and savings are N/A. Retirement date:",
      paygoUnavailable: "PayGO or applicable token prices are unverified; PayGO and savings are N/A.",
      promptLimit: "Maximum provisioned prompt tokens (including cached input):",
      regional: "Regional",
      requiredPtus: "Required PTUs",
      publishedCapacity: "Published capacity",
      benchmarkHint: "input TPM/PTU. Enter a benchmarked capacity estimate.",
      manualDeploymentHint: "Benchmark each deployment separately. The optimizer compares commitments for the selected deployment only.",
      ptuPricingAssumption: "PTU commitment rates are catalog planning assumptions, not a current model-specific quote.",
      overridePtus: "Override automatic PTU estimate",
      automaticFireworksHint:
        "Automatic estimate. Microsoft does not publish a Fireworks output-token weight, so the catalog output-to-input ratio is used:",
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
    normalization: {
      title: "How tokens become PTU capacity",
      description: "Split the prompt once, apply each category's weight, then convert normalized tokens to PTUs.",
      source: "Microsoft sizing guide",
      inputSplit: "1. Split input tokens",
      requestInput: "Request input",
      inputTokens: "Input tokens / request",
      cacheHitRate: "Cache hit rate",
      cachedPrefix: "Cached prefix",
      inputStart: "Input start",
      inputEnd: "Input end",
      prefixOrder: "Cache reads start at the input prefix; cache writes follow, then any remaining uncached input.",
      noDoubleCounting: "Cache reads and writes are part of total input, not extra tokens. Each input token belongs to exactly one bucket.",
      automaticWrites: "Cache writes are estimated from the cache-miss share.",
      manualWrites: "Cache writes use your manual override; any remaining input is uncached.",
      conversion: "2. Apply normalized token weights",
      category: "Token category",
      tokens: "Tokens / request",
      weight: "Weight",
      normalized: "Normalized / request",
      buckets: {
        uncached: "Uncached input",
        cached: "Cache read",
        cacheWrite: "Cache write",
        image: "Image input",
        output: "Output",
      },
      baseline: "Weight = token-type price / short-context input price. Baseline:",
      perMillion: "per 1M tokens",
      longContextBaseline: "Long-context prices still use this short-context baseline.",
      catalogOverride: "The active catalog weights differ from its price ratios. If you saved an older browser catalog, use Restore bundled catalog below to load the current guide defaults. Custom weights are otherwise respected.",
      sum: "Sum weighted tokens",
      normalizedPerRequest: "normalized tokens / request",
      multiplyRpm: "Multiply by RPM",
      normalizedTpm: "normalized tokens / minute",
      divideCapacity: "Divide by TPM per PTU",
      rawPtus: "raw PTUs",
      roundDeployment: "Round to deployment size",
      deployedPtus: "deployed PTUs",
      minimumIncrement: "Minimum / increment",
      unavailable: "Normalization is unavailable. Check the workload inputs and catalog sizing configuration.",
    },
    summary: {
      ariaLabel: "Current cost estimate",
      paygoEstimate: "PayGO estimate",
      paygoUnavailable: "Current PayGO comparison unavailable",
      ptuEstimate: "PTU estimate",
      estimatedSavings: "Estimated savings",
      perMonth: "per month",
      ptuVersusPaygo: "PTU versus PayGO",
    },
    optimizer: {
      ariaLabel: "PTU configuration optimizer",
      title: "Best PTU configuration",
      description:
        "Compare the available PTU options at your current workload. The least expensive PTU option is highlighted.",
      rankingTitle: "Monthly PTU cost at your current traffic",
      rankingDescription: "Shorter bars cost less. Each row uses the same workload at",
      bestBadge: "Lowest PTU cost",
      perMonth: "/ month",
      paygoReference: "PayGO reference for this configuration",
      showTrafficChart: "Explore how costs change with traffic",
      trafficChartDescription: "Across different request rates, PTU capacity rises in deployable steps while PayGO cost changes with usage. The dashed marker shows your current traffic.",
      bestConfiguration: "Lowest-cost configuration",
      saves: "Saves",
      paygoLowerBy: "PayGO is lower by",
      perMonthAt: "per month at",
      breakEven: "Estimated first break-even",
      breakEvenNotReached: "No break-even is shown in this traffic range.",
      paygoUnavailable: "PayGO and savings are N/A. PTU costs remain planning estimates.",
      chartAriaLabel:
        "Monthly PayGO and PTU cost lines by requests per minute and configuration",
      rpmAxis: "Requests per minute (RPM)",
      currentTraffic: "Current traffic",
      legend: "Cost line legend and current monthly values",
      dataTable: "View chart data",
      rpm: "RPM",
      assumptions:
        "The curve keeps the current tokens per request, cache rate, images, and manual PTU estimate fixed. PTU costs use capacity rounded to deployable units.",
    },
    results: {
      ariaLabel: "Results",
      comparison: "Comparison",
      calculationDetails: "Calculation details",
      exportExcel: "Export Excel",
      emptyTitle: "Add a scenario to start comparing.",
      emptyDescription:
        "The current estimate updates live. Add it to keep a snapshot and compare another model or commitment.",
      addCurrentScenario: "Add current scenario",
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
        "text/image usage x RPM x 60 x 24 x 30.42 x applicable unit price",
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
        "The catalog must contain metadata and valid model pricing (number or null), sizing, and deployment fields.",
      outdated: "This browser is using an older catalog. Restore bundled catalog to adopt the current model set and sizing; saved customizations are not replaced automatically.",
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
      contextMode: "Context pricing tier",
      cacheWriteTokens: "Cache Write Tokens",
      outputTokens: "Output Token Number",
      rpm: "RPM",
      commitment: "Commitment Type",
      deployment: "Deployment Type",
      requiredPtus: "Required PTU Num",
      deployedPtus: "Deployed PTUs",
      utilization: "PTU Utilization (%)",
      paygoCost: "PayGO cost",
      paygoScope: "PayGO pricing scope",
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
    workspace: {
      ariaLabel: "工作区模式",
      estimationTab: "PTU 容量估算",
      comparisonTab: "PTU 与 PayGO 对比",
    },
    guide: {
      title: "快速入门",
      dismiss: "关闭",
      reopen: "查看引导",
      step: "步骤",
      of: "/",
      modelTitle: "选择模型",
      modelDescription: "选择计划部署的模型。容量规则和输入字段会随模型调整。",
      tokensTitle: "填写每次请求的令牌数",
      tokensDescription: "输入常见的输入与输出令牌数，并填写下方显示的模型专属参数。",
      trafficTitle: "设置峰值流量",
      trafficDescription: "输入每分钟峰值请求数，并按需调整缓存或部署设置。",
      resultTitle: "查看 PTU 估算",
      resultDescription: "右侧的目标 PTU 数会自动更新。展开计算步骤可了解原因。",
      goToStep: "前往对应字段",
      back: "上一步",
      next: "下一步",
      finish: "完成",
    },
    estimation: {
      summaryAriaLabel: "目标 PTU 容量摘要",
      liveBadge: "实时估算",
      targetStepBadge: "目标结果",
      saveToComparison: "加入对比",
      savedFeedback: "已加入对比",
      compareWithPaygo: "对比 PTU 与 PayGO",
      targetPtus: "目标可部署 PTU",
      rawRequiredPtus: "原始所需容量",
      utilization: "利用率",
      normalizedThroughput: "标准化吞吐量",
      workloadThroughput: "工作负载吞吐量",
      monthlyPtuCost: "每月 PTU 成本",
      perMonth: "每月",
      minUnit: "最小",
      incrementUnit: "步长",
      tpmPerPtu: "输入 TPM / PTU",
      backendCalculationTitle: "后端如何计算目标 PTU",
      backendCalculationDescription:
        "从峰值流量到可部署的 PTU 数量；数值随工作负载参数实时更新。",
      flowAriaLabel: "PTU 容量规划的三个阶段",
      flowWorkload: "输入工作负载",
      flowWorkloadDescription: "每分钟峰值请求数和每次请求的令牌数决定容量需求。",
      flowDemand: "计算所需容量",
      flowDemandDescription: "按当前模型的容量规则计算未取整的所需 PTU。",
      flowDeployment: "取整为可部署容量",
      flowDeploymentDescription: "满足最小容量要求，并向上取整到允许的 PTU 步长。",
      flowCaption: "目标容量向上取整，以便部署能够承载预计的峰值需求。",
      showCalculationSteps: "查看每个数值的计算过程",
      stepEffectiveInput: "先对不同类别的输入令牌加权，再计算容量。",
      stepNormalizedTpm: "按峰值流量将每次请求的加权令牌转换为每分钟令牌数。",
      stepRequiredPtus: "将峰值需求转换为取整之前的原始 PTU 容量。",
      requiredStepLabel: "所需 PTU 数",
      requiredGsuStepLabel: "所需 GSU 数",
      stepDeployablePtus: "按模型的最小容量和部署步长向上取整。",
      stepUtilization: "展示预计负载占已部署容量的比例。",
      stepCost: "根据所选承诺周期和折扣计算已部署 PTU 的费用。",
      stepEfficiency: "将吞吐量与部署的每分钟成本进行比较。",
      activeSizingParameters: "当前容量计算参数与目录规则",
      sizingGuide: "Microsoft 容量规划指南",
      formula: "公式",
      substitution: "代入值",
      unavailableTitle: "请完善工作负载输入以计算目标 PTU",
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
      rpmHint: "PTU 容量按峰值 RPM 估算。PayGO 假设该速率持续运行 30.42 天，并未单独使用月平均流量。",
      cacheHitRate: "缓存命中率",
      contextMode: "上下文价格档位",
      shortContext: "短上下文",
      longContext: "长上下文",
      normalizedContextHint: "请选择适用的档位。所有令牌权重均以短上下文输入价格为基准，右侧实时展示归一化过程。",
      cacheWriteTokens: "每次请求的缓存写入令牌",
      cacheWriteHint: "默认按输入令牌 x (1 - 缓存命中率 / 100) 自动计算，可手动修改；读取和写入之和不能超过输入总数。",
      useAutomaticCacheWrites: "恢复自动计算缓存写入",
      textInputTokens: "每次请求的文本输入令牌",
      imageInputTokens: "每次请求的图像输入令牌",
      imageOutputTokens: "每次请求的图像输出令牌",
      imageTokenHint: "请使用该模型实测的每次请求令牌总量，包含所有生成图像和预览。文本输入不含图像令牌；图像尺寸和共用的输出默认值不是令牌估算。",
      imageCacheHint: "不计算图像模型缓存优惠，所有输入均按未缓存处理；直接调用 Images API 不适用缓存输入价格。",
      imagePaygoScopeHint: "PayGO 对比基准（与 PTU 部署类型独立）：",
      unverifiedPaygoScope: "未指定，请核实目录价格范围。",
      provisionedDeployment: "预配部署类型",
      globalDataZone: "全局 / 数据区域",
      globalProvisionedOnly: "仅支持全局预配，不支持数据区域预配。",
      paygoRetired: "PayGO 已退役，PTU 仍受支持。PayGO 和节省显示为 N/A。退役日期：",
      paygoUnavailable: "PayGO 或适用令牌价格未经验证，PayGO 和节省显示为 N/A。",
      promptLimit: "预配提示词令牌上限（包含缓存输入）：",
      regional: "区域",
      requiredPtus: "所需 PTU",
      publishedCapacity: "已发布容量",
      benchmarkHint: "输入 TPM/PTU。请输入经过基准测试的容量估算值。",
      manualDeploymentHint: "请对每种部署单独进行基准测试。优化器仅比较所选部署的承诺周期。",
      ptuPricingAssumption: "PTU 承诺价格为目录中的规划假设，并非当前模型的专属报价。",
      overridePtus: "手动覆盖自动 PTU 估算",
      automaticFireworksHint:
        "自动估算。Microsoft 未发布 Fireworks 模型的输出令牌权重，因此使用目录中的输出/输入比率：",
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
    normalization: {
      title: "令牌如何转换为 PTU 容量",
      description: "将提示词令牌分组，分别应用对应权重，再将归一化令牌转换为 PTU。",
      source: "Microsoft 容量规划指南",
      inputSplit: "1. 输入令牌分组",
      requestInput: "请求输入",
      inputTokens: "每次请求的输入令牌",
      cacheHitRate: "缓存命中率",
      cachedPrefix: "已缓存前缀",
      inputStart: "输入起点",
      inputEnd: "输入终点",
      prefixOrder: "缓存读取始终从输入前缀开始，之后是缓存写入，最后是其余未缓存输入。",
      noDoubleCounting: "缓存读取和写入包含在输入令牌总数中，不是额外令牌。每个输入令牌只归入一个分组。",
      automaticWrites: "缓存写入按未命中缓存的输入比例自动估算。",
      manualWrites: "缓存写入使用手动设定值，其余输入计为未缓存令牌。",
      conversion: "2. 应用归一化令牌权重",
      category: "令牌类别",
      tokens: "令牌 / 请求",
      weight: "权重",
      normalized: "归一化令牌 / 请求",
      buckets: {
        uncached: "未缓存输入",
        cached: "缓存读取",
        cacheWrite: "缓存写入",
        image: "图像输入",
        output: "输出",
      },
      baseline: "权重 = 该类别令牌价格 / 短上下文输入价格。基准：",
      perMillion: "每百万令牌",
      longContextBaseline: "长上下文价格仍使用此短上下文基准。",
      catalogOverride: "当前目录权重与其价格比率不同。若浏览器保存了旧目录，可使用下方的“恢复内置目录”加载当前指南默认值；否则仍保留自定义权重。",
      sum: "汇总加权令牌",
      normalizedPerRequest: "归一化令牌 / 请求",
      multiplyRpm: "乘以每分钟请求数",
      normalizedTpm: "归一化令牌 / 分钟",
      divideCapacity: "除以每 PTU 的 TPM",
      rawPtus: "原始 PTU",
      roundDeployment: "向上取整为可部署容量",
      deployedPtus: "已部署 PTU",
      minimumIncrement: "最小部署量 / 增量",
      unavailable: "无法展示归一化过程，请检查工作负载输入和目录容量配置。",
    },
    summary: {
      ariaLabel: "当前成本估算",
      paygoEstimate: "PayGO 估算",
      paygoUnavailable: "无法进行当前 PayGO 对比",
      ptuEstimate: "PTU 估算",
      estimatedSavings: "预计节省",
      perMonth: "每月",
      ptuVersusPaygo: "PTU 相比 PayGO",
    },
    optimizer: {
      ariaLabel: "PTU 配置优化器",
      title: "最佳 PTU 配置",
      description: "按当前工作负载比较可用的 PTU 配置，并突出显示 PTU 成本最低的选项。",
      rankingTitle: "当前流量下的每月 PTU 成本",
      rankingDescription: "条形越短，成本越低。所有配置使用相同的工作负载，流量为",
      bestBadge: "PTU 成本最低",
      perMonth: "/ 月",
      paygoReference: "此配置的 PayGO 参考成本",
      showTrafficChart: "查看流量变化时的成本曲线",
      trafficChartDescription: "不同请求速率下，PTU 容量按可部署步长增长，PayGO 成本则随用量变化。虚线标记当前流量。",
      bestConfiguration: "成本最低的配置",
      saves: "每月节省",
      paygoLowerBy: "PayGO 每月低",
      perMonthAt: "，当前流量",
      breakEven: "预计首次盈亏平衡点",
      breakEvenNotReached: "当前流量范围内未显示盈亏平衡点。",
      paygoUnavailable: "PayGO 和节省显示为 N/A。PTU 成本仍为规划估算。",
      chartAriaLabel: "按每分钟请求数和配置展示的 PayGO 与 PTU 月度成本曲线",
      rpmAxis: "每分钟请求数（RPM）",
      currentTraffic: "当前流量",
      legend: "成本曲线图例和当前月度价格",
      dataTable: "查看图表数据",
      rpm: "RPM",
      assumptions:
        "曲线固定使用当前每次请求令牌数、缓存命中率、图像和手动 PTU 估算。PTU 成本使用向上取整后的可部署容量。",
    },
    results: {
      ariaLabel: "结果",
      comparison: "对比结果",
      calculationDetails: "计算明细",
      exportExcel: "导出 Excel",
      emptyTitle: "添加场景后即可开始对比。",
      emptyDescription:
        "当前估算会实时更新。添加场景可保存快照，并继续比较其他模型或承诺周期。",
      addCurrentScenario: "添加当前场景",
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
        "文本/图像用量 x RPM x 60 x 24 x 30.42 x 相应单价",
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
      invalid: "目录必须包含元数据，以及有效的模型价格（数值或 null）、容量和部署字段。",
      outdated: "此浏览器正在使用旧目录。请恢复内置目录以采用最新模型列表和容量；不会自动替换已保存的自定义配置。",
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
      contextMode: "上下文价格档位",
      cacheWriteTokens: "缓存写入令牌",
      outputTokens: "输出令牌数",
      rpm: "每分钟请求数",
      commitment: "承诺周期",
      deployment: "部署类型",
      requiredPtus: "所需 PTU 数",
      deployedPtus: "已部署 PTU",
      utilization: "PTU 利用率（%）",
      paygoCost: "PayGO 成本",
      paygoScope: "PayGO 价格范围",
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
  "PayGO comparison unavailable": "无法比较 PayGO",
  "PayGO is retired or applicable token prices are unverified.": "PayGO 已退役或适用的令牌价格未经验证。",
  "Catalog PayGO rates": "目录中的 PayGO 价格",
  paygoPricingScope: "PayGO 价格范围",
  paygoStatus: "PayGO 状态",
  paygoRetirementDate: "PayGO 退役日期",
  inputTpmPerPtu: "每 PTU 输入 TPM",
  available: "可用",
  retired: "已退役",
  unverified: "未经验证",
  "Data Zone": "数据区域",
  "Global (standard capacity)": "全局（标准容量）",
  contextMode: "上下文价格档位",
  short: "短上下文",
  long: "长上下文",
  cacheWriteTokens: "缓存写入令牌",
  cacheWritePricePer1k: "每千缓存写入令牌价格",
  inputWeight: "输入令牌权重",
  cachedInputWeight: "缓存读取令牌权重",
  cacheWriteWeight: "缓存写入令牌权重",
  outputWeight: "输出令牌权重",
  imageInputPricePer1k: "每千图像输入令牌价格",
  imageInputWeight: "图像输入令牌权重",
  imageOutputWeight: "图像输出令牌权重",
  "(uncached tokens x input price + cached tokens x cached price + cache write tokens x write price) x monthly requests / 1,000":
    "（未缓存令牌 x 输入价格 + 缓存令牌 x 缓存价格 + 缓存写入令牌 x 写入价格）x 每月请求数 / 1,000",
  "uncached tokens x input weight + cached tokens x cache weight + cache write tokens x write weight":
    "未缓存令牌 x 输入权重 + 缓存令牌 x 缓存权重 + 缓存写入令牌 x 写入权重",
  "RPM x (effective text input + image input x image-to-text factor + image output x image output-to-input ratio x image-to-text factor)":
    "RPM x（有效文本输入 + 图像输入 x 图文转换因子 + 图像输出 x 图像输出输入比 x 图文转换因子）",
  "Monthly requests": "每月请求数",
  "Monthly PayGO input cost": "每月 PayGO 输入成本",
  "Monthly PayGO image cost": "每月 PayGO 图像成本",
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
  "image count x monthly requests x image price":
    "图像数 x 每月请求数 x 图像单价",
  "image input tokens x monthly requests / 1,000 x input price":
    "图像输入令牌 x 每月请求数 / 1,000 x 输入价格",
  "PayGO cost = input cost + image cost + output cost":
    "PayGO 成本 = 输入成本 + 图像成本 + 输出成本",
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
  "Required PTUs = user supplied PTU override":
    "所需 PTU = 用户手动覆盖的 PTU 值",
  "The automatic estimate is replaced by the user supplied PTU override.":
    "自动估算已被用户手动覆盖的 PTU 值替代。",
  "Microsoft does not publish a PTU output-token weight for this Fireworks model; the catalog output ratio is used (4:1 for DeepSeek, 1:1 for GLM, or the PayGO output-to-input price ratio for other models).":
    "Microsoft 未发布此 Fireworks 模型的 PTU 输出令牌权重；使用目录中的输出比率（DeepSeek 为 4:1，GLM 为 1:1，其他模型使用 PayGO 输出/输入价格比）。",
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
  Global: "全局",
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
  if (value === "Benchmarked required PTUs must be a positive number.") {
    return "请输入经过基准测试的正数 PTU 容量。";
  }
  const promptLimit = value.match(/^Provisioned prompts above ([\d,]+) tokens are not supported for this model\.$/);
  if (promptLimit) {
    return `此模型不支持超过 ${promptLimit[1]} 个令牌的预配提示词。`;
  }

  return value;
}
