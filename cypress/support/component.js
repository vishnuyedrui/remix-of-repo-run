// ***********************************************************
// This file is processed and loaded automatically before your
// component test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import "./commands";

// Import global styles
import "../../src/index.css";

// Mount command for React components
import { mount } from "cypress/react18";

Cypress.Commands.add("mount", mount);

// Example use:
// cy.mount(<MyComponent />)
