export type ExperimentProps = {
  reducedMotion: boolean;
  quality: "high" | "low";
  /** Call once the first real frame is on screen; hides the page's loading overlay. */
  onReady: () => void;
};
