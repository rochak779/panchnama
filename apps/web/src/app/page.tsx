import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <main>
      <h1>{PRODUCT_NAME}</h1>
      <p>{PRODUCT_DISCLAIMER}</p>
      <p>
        This is a repository-bootstrap placeholder. The public scorecard (overview, inventory,
        portal evidence pages, methodology, and exports) is built in later sessions — see{" "}
        <code>implementation.md</code> section 14.
      </p>
    </main>
  );
}
