import type { AnchorHTMLAttributes, ReactNode } from "react";

export interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

/**
 * Every outbound link to a portal's own domain or a source URL cited as
 * evidence — implementation.md section 14's "safe external-link behavior"
 * for Session 14. `rel="noopener noreferrer"` prevents the opened page
 * from getting a `window.opener` reference back into this one (tab-
 * nabbing) and stops the destination from seeing this page as a referrer;
 * `target="_blank"` keeps a reader's place on the evidence page they were
 * reading instead of navigating them away from it.
 */
export function ExternalLink({ href, children, ...rest }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
