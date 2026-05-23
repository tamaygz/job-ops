import { describe, expect, it } from "vitest";
import { normaliseLinkedInHtml } from "./normaliser";

describe("compare/normaliser", () => {
  const URL = "https://www.linkedin.com/in/test-user";

  it("extracts basics from JSON-LD", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Person",
              "name": "Jane Doe",
              "jobTitle": "Senior Engineer",
              "description": "Experienced software engineer.",
              "address": {
                "addressLocality": "London",
                "addressRegion": "England",
                "addressCountry": "UK"
              }
            }
          </script>
        </head>
        <body><h1>Jane Doe</h1></body>
      </html>
    `;

    const result = normaliseLinkedInHtml(html, URL);
    expect(result.basics.name).toBe("Jane Doe");
    expect(result.basics.headline).toBe("Senior Engineer");
    expect(result.basics.location).toBe("London, England, UK");
    expect(result.basics.summary).toBe("Experienced software engineer.");
    expect(result.sourceUrl).toBe(URL);
    expect(result.fetchedAt).toBeTruthy();
  });

  it("falls back to HTML elements when no JSON-LD", () => {
    const html = `
      <html>
        <body>
          <h1>John Smith</h1>
          <div class="top-card-layout__headline">Product Manager</div>
          <div class="top-card-layout__first-subline">San Francisco, CA</div>
        </body>
      </html>
    `;

    const result = normaliseLinkedInHtml(html, URL);
    expect(result.basics.name).toBe("John Smith");
    expect(result.basics.headline).toBe("Product Manager");
    expect(result.basics.location).toBe("San Francisco, CA");
  });

  it("throws on empty/private profile with no name", () => {
    const html = "<html><body><p>Sign in to view</p></body></html>";
    expect(() => normaliseLinkedInHtml(html, URL)).toThrow(
      "Could not extract profile data",
    );
  });

  it("strips HTML from extracted text", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@type": "Person", "name": "<b>Bold Name</b>", "description": "Uses &amp; special chars"}
          </script>
        </head>
        <body><h1><b>Bold Name</b></h1></body>
      </html>
    `;

    const result = normaliseLinkedInHtml(html, URL);
    expect(result.basics.name).toBe("Bold Name");
    expect(result.basics.summary).toBe("Uses & special chars");
  });

  it("returns empty arrays for missing sections", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">{"@type": "Person", "name": "Test User"}</script>
        </head>
        <body><h1>Test User</h1></body>
      </html>
    `;

    const result = normaliseLinkedInHtml(html, URL);
    expect(result.sections.experience).toEqual([]);
    expect(result.sections.education).toEqual([]);
    expect(result.sections.skills).toEqual([]);
    expect(result.sections.certifications).toEqual([]);
    expect(result.sections.projects).toEqual([]);
    expect(result.sections.languages).toEqual([]);
    expect(result.sections.awards).toEqual([]);
  });
});
