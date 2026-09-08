import { getSubjectBadgeColor } from "@/lib/subjectBadge";

/** Compact subject pill, e.g. "[History]" — visual language matches the
 * existing source-label pills used alongside it (e.g. "From tutor"). */
export default function SubjectBadge({ subject }: { subject: string }) {
  const color = getSubjectBadgeColor(subject);
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 20,
        background: `${color}1f`,
        color,
        marginLeft: 6,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {subject}
    </span>
  );
}
