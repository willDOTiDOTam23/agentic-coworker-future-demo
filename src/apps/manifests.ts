export interface AppManifest {
  appId: string;
  appName: string;
  persona: string;
  description: string;
  primaryToolPrefix: string;
  widgetPolicy: string[];
  actions: Array<{
    tool: string;
    promptHint: string;
    requiredWidgets: string[];
  }>;
}

export const part1Manifest: AppManifest = {
  appId: "part-1-customer-coworker",
  appName: "Adventure Van Concierge",
  persona: "Customer-Facing Sales & Marketing Coworker",
  description: "Guided, conversational van configuration assistant with compact cards and one-question-at-a-time prompts.",
  primaryToolPrefix: "customer.",
  widgetPolicy: [
    "Render every assistant response as compact cards, not long paragraphs.",
    "Keep each turn to one concise question/action.",
    "Prefer compact cards/chips/buttons for user choices.",
    "Show price, terrain fit, compatibility risk, and next step in visible chips."
  ],
  actions: [
    {
      tool: "customer.startSession",
      promptHint: "Collect name, budget band, terrain, region, and trip style one at a time.",
      requiredWidgets: ["step_cards", "quick_actions", "status_badges"]
    },
    {
      tool: "customer.advanceSession",
      promptHint: "Progress the guided journey by collecting missing context and selecting options.",
      requiredWidgets: ["step_cards", "option_chips", "next_action_buttons"]
    },
    {
      tool: "customer.submitSession",
      promptHint: "Run validation and show immediate pass/fail status using a compact widget.",
      requiredWidgets: ["result_card", "status_badge"]
    }
  ]
};

export const part2Manifest: AppManifest = {
  appId: "part-2-ops-cockpit",
  appName: "Ops Product Owner Cockpit",
  persona: "Internal Operations & Product Ownership Coworker",
  description: "Priority board that ranks defects and growth opportunities with clear action recommendations.",
  primaryToolPrefix: "ops.",
  widgetPolicy: [
    "Display KPI cards and issue triage list first.",
    "Surface P0/P1/P2 board with impact and confidence chips.",
    "Separate immediate fixes from backlog candidates."
  ],
  actions: [
    {
      tool: "ops.getOpsBoard",
      promptHint: "Load ranked triage, then render as P0-P2 board with Apply/Create/Defer actions.",
      requiredWidgets: ["priority_board", "issue_card", "actions_panel"]
    },
    {
      tool: "dev.fixIssue",
      promptHint: "Run immediate patch for the highlighted blocker and return resolved status.",
      requiredWidgets: ["fix_summary", "status_badge"]
    },
    {
      tool: "ops.getKpis",
      promptHint: "Render current throughput and reliability cards.",
      requiredWidgets: ["kpi_card_grid"]
    }
  ]
};
