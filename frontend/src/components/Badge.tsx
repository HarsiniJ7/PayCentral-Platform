interface BadgeProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-steel/10 text-steel ring-1 ring-steel/15",
  success: "bg-signal/10 text-signal ring-1 ring-signal/20",
  warning: "bg-amber/10 text-amber ring-1 ring-amber/20",
  danger: "bg-coral/10 text-coral ring-1 ring-coral/20",
  info: "bg-violet/10 text-violet ring-1 ring-violet/20",
};

const DOT_CLASSES: Record<string, string> = {
  neutral: "bg-steel",
  success: "bg-signal",
  warning: "bg-amber",
  danger: "bg-coral",
  info: "bg-violet",
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${TONE_CLASSES[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {label}
    </span>
  );
}

export function statusTone(status: string): BadgeProps["tone"] {
  switch (status) {
    case "Active":
    case "Completed":
      return "success";
    case "Blocked":
    case "Declined":
    case "Critical":
    case "High":
      return "danger";
    case "Suspended":
    case "Pending":
    case "Medium":
      return "warning";
    case "Closed":
    case "Reversed":
      return "neutral";
    default:
      return "info";
  }
}
