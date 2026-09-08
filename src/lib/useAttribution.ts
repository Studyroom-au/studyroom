export type Attribution = {
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

const EMPTY_ATTRIBUTION: Attribution = { referrer: "", utm_source: "", utm_medium: "", utm_campaign: "" };

/**
 * Reads UTM params from the current URL and document.referrer. Attribution is
 * only ever needed at the moment a form submits, so this is a plain function
 * called from the submit handler — not a hook — with no state/effect and
 * nothing to keep in sync with re-renders.
 */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY_ATTRIBUTION;
  const params = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
  };
}
