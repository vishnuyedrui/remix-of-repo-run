describe("Landing Page", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("should display the landing page", () => {
    cy.get("body").should("be.visible");
  });

  it("should have a GitHub URL input", () => {
    cy.get('input[type="text"], input[type="url"]').should("exist");
  });
});
