import type { ConfigurationSession } from "../../lib/domain.js";

export interface DerivedPalette {
  accent: string;
  accentAlt: string;
  backgroundA: string;
  backgroundB: string;
  bodyColor: string;
  cabinColor: string;
  ink: string;
}

const paletteLibrary = [
  {
    match: /sand|dune|beige|desert/i,
    palette: {
      accent: "#d97757",
      accentAlt: "#4c6f78",
      backgroundA: "#f2e5d5",
      backgroundB: "#d9c5a3",
      bodyColor: "#d3b38c",
      cabinColor: "#f7f2eb",
      ink: "#1b2528"
    }
  },
  {
    match: /forest|green|sage|moss/i,
    palette: {
      accent: "#5a7f5b",
      accentAlt: "#d3a25c",
      backgroundA: "#dbe7da",
      backgroundB: "#bfd4bf",
      bodyColor: "#748d72",
      cabinColor: "#eef4eb",
      ink: "#19221d"
    }
  },
  {
    match: /blue|ocean|storm|navy/i,
    palette: {
      accent: "#296d90",
      accentAlt: "#d0905d",
      backgroundA: "#d6e7ef",
      backgroundB: "#b6d0dc",
      bodyColor: "#4e7490",
      cabinColor: "#f2f7fa",
      ink: "#14232b"
    }
  },
  {
    match: /black|charcoal|graphite|night/i,
    palette: {
      accent: "#3e4754",
      accentAlt: "#cf9d65",
      backgroundA: "#e2e3e7",
      backgroundB: "#c4cad4",
      bodyColor: "#5e6772",
      cabinColor: "#f4f4f6",
      ink: "#11161a"
    }
  }
] as const;

const defaultPalette: DerivedPalette = {
  accent: "#d97757",
  accentAlt: "#26667f",
  backgroundA: "#efe7db",
  backgroundB: "#d9d5ca",
  bodyColor: "#c8b29b",
  cabinColor: "#f5f1ec",
  ink: "#182125"
};

export function derivePalette(session?: ConfigurationSession | null): DerivedPalette {
  const seed = `${session?.theme.paletteChoice ?? ""} ${session?.theme.visualTone ?? ""} ${
    String(session?.state.exterior.color ?? session?.state.exterior.exteriorColor ?? "")
  }`;
  const match = paletteLibrary.find((candidate) => candidate.match.test(seed));
  return match?.palette ?? defaultPalette;
}

