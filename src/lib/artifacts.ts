import type { DesignBrief, SupplyOrder } from "./schemas.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(items: string[]): string {
  if (!items.length) {
    return "<p class=\"artifact-empty\">None noted.</p>";
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSection(title: string, body: string): string {
  return `<section class="artifact-section"><h3>${escapeHtml(title)}</h3>${body}</section>`;
}

export function renderDesignBriefHtml(brief: DesignBrief): string {
  return `
    <article class="artifact design-brief">
      <header>
        <p class="artifact-kicker">Design Brief</p>
        <h2>${escapeHtml(brief.projectOverview.buildName)}</h2>
        <p>${escapeHtml(brief.projectOverview.summary)}</p>
      </header>
      ${renderSection(
        "Project Overview",
        `<p><strong>Customer archetype:</strong> ${escapeHtml(brief.projectOverview.customerArchetype)}</p>
         <p><strong>Build stage:</strong> ${escapeHtml(brief.projectOverview.buildStage)}</p>`
      )}
      ${renderSection(
        "Use Case & Vision",
        `<p><strong>Primary use case:</strong> ${escapeHtml(brief.useCaseAndVision.primaryUseCase)}</p>
         <p><strong>Vision:</strong> ${escapeHtml(brief.useCaseAndVision.visionStatement)}</p>
         <p><strong>Vibe keywords:</strong> ${escapeHtml(brief.useCaseAndVision.vibeKeywords.join(", "))}</p>
         <p><strong>Intended trips:</strong> ${escapeHtml(brief.useCaseAndVision.intendedTrips.join(", "))}</p>`
      )}
      ${renderSection(
        "Exterior Spec",
        `<p><strong>Color:</strong> ${escapeHtml(brief.exteriorSpec.exteriorColor)}</p>
         <p><strong>Finish:</strong> ${escapeHtml(brief.exteriorSpec.finish)}</p>
         <p><strong>Drivetrain:</strong> ${escapeHtml(brief.exteriorSpec.drivetrain)}</p>
         <p><strong>Power preference:</strong> ${escapeHtml(brief.exteriorSpec.powerPreference)}</p>
         ${renderList(brief.exteriorSpec.notes)}`
      )}
      ${renderSection(
        "Interior Spec",
        `<p><strong>Tone:</strong> ${escapeHtml(brief.interiorSpec.interiorTone)}</p>
         <p><strong>Materials:</strong> ${escapeHtml(brief.interiorSpec.materials.join(", "))}</p>
         <p><strong>Comfort level:</strong> ${escapeHtml(brief.interiorSpec.comfortLevel)}</p>
         <p><strong>Workspace intent:</strong> ${escapeHtml(brief.interiorSpec.workspaceIntent)}</p>
         ${renderList(brief.interiorSpec.notes)}`
      )}
      ${renderSection(
        "Layout & Sleeping Config",
        `<p><strong>Occupancy:</strong> ${escapeHtml(brief.layoutAndSleepingConfig.occupancy)}</p>
         <p><strong>Sleeping configuration:</strong> ${escapeHtml(brief.layoutAndSleepingConfig.sleepingConfiguration)}</p>
         <p><strong>Storage strategy:</strong> ${escapeHtml(brief.layoutAndSleepingConfig.storageStrategy)}</p>
         ${renderList(brief.layoutAndSleepingConfig.layoutPriorities)}`
      )}
      ${renderSection(
        "Gear & Accessories",
        brief.gearAndAccessories.items.length
          ? `<ul>${brief.gearAndAccessories.items
              .map(
                (item) =>
                  `<li><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml(item.purpose)} (${escapeHtml(
                    item.priority
                  )})</li>`
              )
              .join("")}</ul>`
          : "<p class=\"artifact-empty\">No accessories captured yet.</p>"
      )}
      ${renderSection(
        "BOM Summary",
        `${brief.bomSummary.componentBuckets
          .map(
            (bucket) =>
              `<div class="artifact-subsection"><p><strong>${escapeHtml(bucket.category)}</strong> · ${escapeHtml(
                bucket.estimatedCostRange
              )}</p>${renderList(bucket.items)}</div>`
          )
          .join("")}
         <p><strong>Estimated total:</strong> ${escapeHtml(brief.bomSummary.estimatedTotalRange)}</p>`
      )}
      ${renderSection(
        "Build Notes",
        `<p><strong>Assumptions</strong></p>${renderList(brief.buildNotes.assumptions)}
         <p><strong>Risks</strong></p>${renderList(brief.buildNotes.risks)}
         <p><strong>Unresolved decisions</strong></p>${renderList(brief.buildNotes.unresolvedDecisions)}`
      )}
    </article>
  `.trim();
}

export function renderSupplyOrderHtml(order: SupplyOrder): string {
  return `
    <article class="artifact supply-order">
      <header>
        <p class="artifact-kicker">Supply Order</p>
        <h2>${escapeHtml(order.orderSummary.buildPhase)}</h2>
        <p>${escapeHtml(order.orderSummary.summary)}</p>
      </header>
      ${renderSection(
        "Order Summary",
        `<p><strong>Sourcing posture:</strong> ${escapeHtml(order.orderSummary.sourcingPosture)}</p>
         <p><strong>Total estimated range:</strong> ${escapeHtml(order.orderSummary.totalEstimatedRange)}</p>`
      )}
      ${renderSection(
        "Component Line Items",
        order.componentLineItems.length
          ? `<table class="artifact-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Estimated cost</th>
                  <th>Supplier type</th>
                  <th>Lead time</th>
                </tr>
              </thead>
              <tbody>
                ${order.componentLineItems
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.category)}</td>
                        <td>${escapeHtml(item.estimatedCostRange)}</td>
                        <td>${escapeHtml(item.supplierType)}</td>
                        <td>${escapeHtml(item.leadTime)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>`
          : "<p class=\"artifact-empty\">No sourcing lines available.</p>"
      )}
      ${renderSection("Sequencing Notes", renderList(order.sequencingNotes))}
      ${renderSection("Open Questions", renderList(order.openQuestions))}
    </article>
  `.trim();
}

