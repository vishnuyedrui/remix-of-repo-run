// ***********************************************************
// This file is processed and loaded automatically before your
// e2e test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import "./commands";

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests from command log
const app = window.top;
if (!app.document.head.querySelector("[data-hide-command-log-request]")) {
  const style = app.document.createElement("style");
  style.setAttribute("data-hide-command-log-request", "");
  style.innerHTML = ".command-name-request, .command-name-xhr { display: none }";
  app.document.head.appendChild(style);
}
