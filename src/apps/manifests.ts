export interface AppManifest {
  appId: string;
  appName: string;
  persona: string;
  description: string;
  primaryToolPrefix: string;
  widgetPolicy: string[];
  widgetContract?: {
    renderMode: "compact_cards" | "priority_board";
    textPolicy: "single_line";
    requiredSources: string[];
  };
  actions: Array<{
    tool: string;
    promptHint: string;
    requiredWidgets: string[];
  }>;
}

export const part1Manifest: AppManifest = {
  appId: "part-1-customer-coworker",
  appName: "Configurate",
  persona: "Customer-Facing Sales & Marketing Coworker",
  description: "Configurate: customer config momentum in a guided, one-question-at-a-time journey.",
  primaryToolPrefix: "customer.",
  widgetPolicy: [
    "Use a card-stack visual flow with a template carousel, then one focused screen per step across exactly 5 stages.",
    "Render each step with chips/buttons and lightweight copy instead of long assistant prose.",
    "Show compatibility risk, completion hints, and summary metrics with clear visual hierarchy to maintain momentum.",
    "Render `journeyState`, `stepCards`, and `quickActions` consistently each turn.",
    "Enable full-screen rendering when a user asks for a polished demo display."
  ],
  widgetContract: {
    renderMode: "compact_cards",
    textPolicy: "single_line",
    requiredSources: ["journeyState", "nextQuestion", "requiredInputs", "stepCards", "quickActions"]
  },
  actions: [
    {
      tool: "customer.startSession",
      promptHint: "Open Configurate with a confident welcome and immediately move the customer into a 5-step flow.",
      requiredWidgets: ["step_cards", "quick_actions", "status_badges"]
    },
    {
      tool: "customer.advanceSession",
      promptHint: "Maintain forward momentum across exterior, interior/lifestyle, power, and accessory steps with one clear action each.",
      requiredWidgets: ["step_cards", "option_chips", "next_action_buttons"]
    },
    {
      tool: "customer.submitSession",
      promptHint: "Run validation, show pricing summary, and set up the handoff moment into Control.",
      requiredWidgets: ["result_card", "status_badge"]
    }
  ]
};

export const part2Manifest: AppManifest = {
  appId: "part-2-ops-cockpit",
  appName: "Control",
  persona: "Internal Operations & Product Ownership Coworker",
  description: "Control: operational visibility and issue detection with ranked action recommendations.",
  primaryToolPrefix: "ops.",
  widgetPolicy: [
    "Display KPI cards first, then render the priority board and short drill-down lists.",
    "Surface P0/P1/P2 lanes with impact/confidence signals and action-oriented action chips.",
    "Separate immediate fixes from feature ideas and roadmap candidates.",
    "Keep cards skimmable with one sentence copy for each item.",
    "Render full-screen cleanly for dashboard projection mode.",
    "Keep visual style and motion consistent with Part 1."
  ],
  widgetContract: {
    renderMode: "priority_board",
    textPolicy: "single_line",
    requiredSources: ["priorityQueue", "immediateFixes", "fixCandidates", "featureBuildCandidates", "actionRecommendations", "kpis", "performanceBugs", "featureIdeas", "recentTransactions"]
  },
  actions: [
    {
      tool: "ops.getOpsBoard",
      promptHint: "Load ranked triage and spotlight the single best fix candidate that sets up Customize.",
      requiredWidgets: ["priority_board", "issue_card", "actions_panel"]
    },
    {
      tool: "dev.fixIssue",
      promptHint: "Use Customize to run an immediate patch for the highlighted blocker and return resolved status.",
      requiredWidgets: ["fix_summary", "status_badge"]
    },
    {
      tool: "ops.getKpis",
      promptHint: "Render current throughput and reliability cards.",
      requiredWidgets: ["kpi_card_grid"]
    }
  ]
};
