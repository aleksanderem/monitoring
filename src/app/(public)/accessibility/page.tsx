import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility Statement | DSEO",
  description: "Our commitment to digital accessibility and WCAG 2.1 AA compliance.",
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-6">Accessibility Statement</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Our Commitment</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            DSEO is committed to ensuring digital accessibility for people with disabilities.
            We are continually improving the user experience for everyone, and applying the relevant
            accessibility standards.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Conformance Status</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.
            These guidelines explain how to make web content more accessible for people with disabilities.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Technologies Used</h2>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
            <li>HTML5 with semantic markup</li>
            <li>WAI-ARIA for dynamic content</li>
            <li>React Aria for accessible UI components</li>
            <li>CSS with prefers-reduced-motion support</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Known Limitations</h2>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
            <li>Some charts and data visualizations may not be fully accessible to screen readers</li>
            <li>Some third-party content may not meet accessibility standards</li>
            <li>Complex data tables may require additional screen reader navigation support</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Feedback</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We welcome your feedback on the accessibility of DSEO. Please let us know if you
            encounter accessibility barriers by contacting us at{" "}
            <a href="mailto:accessibility@dseo.app" className="text-blue-600 dark:text-blue-400 underline">
              accessibility@dseo.app
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Assessment Methods</h2>
          <p className="text-gray-700 dark:text-gray-300">
            DSEO assesses accessibility through automated testing with axe-core,
            manual keyboard navigation testing, and screen reader testing with VoiceOver and NVDA.
          </p>
        </section>
      </main>
    </div>
  );
}
