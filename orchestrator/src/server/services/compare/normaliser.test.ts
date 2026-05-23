import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseLinkedInHtml } from "./normaliser";

const FIXTURE_PATH = resolve(
  __dirname,
  "__fixtures__/linkedin-profile-fixture.html",
);
const fixtureHtml = readFileSync(FIXTURE_PATH, "utf-8");

describe("compare/normaliser", () => {
  const URL = "https://www.linkedin.com/in/test-user";

  it("maps fixture HTML to NormalisedCompareProfile with all sections", () => {
    const result = normaliseLinkedInHtml(fixtureHtml, URL);

    expect(result.sourceUrl).toBe(URL);
    expect(result.fetchedAt).toBeTruthy();
    expect(result.basics.name).toBe("Jane Doe");
    expect(result.basics.headline).toBe("Senior Software Engineer at TechCorp");
    expect(result.basics.location).toBe("San Francisco, California, US");
    expect(result.basics.summary).toContain("Full-stack engineer");

    expect(result.sections.experience.length).toBe(3);
    expect(result.sections.experience[0].company).toBe("TechCorp");
    expect(result.sections.experience[0].position).toBe(
      "Senior Software Engineer",
    );
    expect(result.sections.experience[0].period).toBe("Jan 2020 – Present");

    expect(result.sections.education.length).toBe(2);
    expect(result.sections.education[0].school).toBe("Stanford University");

    expect(result.sections.skills.length).toBeGreaterThan(0);

    // All section arrays must be present (even if empty)
    expect(Array.isArray(result.sections.certifications)).toBe(true);
    expect(Array.isArray(result.sections.projects)).toBe(true);
    expect(Array.isArray(result.sections.languages)).toBe(true);
    expect(Array.isArray(result.sections.awards)).toBe(true);
  });

  it("drops email, phone, and connections fields from output", () => {
    const result = normaliseLinkedInHtml(fixtureHtml, URL);
    const serialized = JSON.stringify(result);

    // The fixture contains email, phone, and connections in the JSON-LD
    // but the normaliser must strip them
    expect(serialized).not.toContain("jane.doe@example.com");
    expect(serialized).not.toContain("+1-555-123-4567");
    expect(serialized).not.toContain("500+ connections");

    // Ensure there's no email/phone property anywhere in the output
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("telephone");
    expect(result.basics).not.toHaveProperty("email");
    expect(result.basics).not.toHaveProperty("phone");
  });

  it("truncates description to ≤ 800 chars and summary to ≤ 600 chars", () => {
    const longDesc = "A".repeat(1000);
    const longSummary = "B".repeat(800);
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@type": "Person", "name": "Truncation Test", "description": "${longSummary}"}
          </script>
        </head>
        <body>
          <h1>Truncation Test</h1>
          <section id="experience" class="experience">
            <ul>
              <li class="experience-item">
                <h3>Engineer</h3>
                <h4>Company</h4>
                <p class="description">${longDesc}</p>
              </li>
            </ul>
          </section>
        </body>
      </html>
    `;

    const result = normaliseLinkedInHtml(html, URL);
    expect(result.basics.summary.length).toBeLessThanOrEqual(600);
    if (result.sections.experience.length > 0) {
      expect(
        result.sections.experience[0].description.length,
      ).toBeLessThanOrEqual(800);
    }
  });

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
