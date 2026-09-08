const HONEYPOT_NAME = "companyWebsite";

/**
 * Hidden spam-trap field for public forms. Real visitors never see or focus
 * it (aria-hidden, tabIndex -1, off-screen); bots that fill every input trip
 * it, and the server route rejects silently. No third-party service involved.
 */
export default function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name={HONEYPOT_NAME}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
    />
  );
}

export { HONEYPOT_NAME };
