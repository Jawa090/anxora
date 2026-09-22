/**
 * Shared constants for the ELINA frontend.
 * Keep department names in sync with the Admin Dashboard.
 */

export const ADMIN_DEPARTMENTS = [
  "Executive",
  "Management",
  "Sales",
  "SEO Marketing",
  "Email Marketing",
  "Operations",
  "Human Resources",
  "Software Engineering",
  "Estimation Department",
  "Growth Engine Department",
  "Customer Support",
  "Finance",
];

// General departments list for all other pages (excludes Executive)
export const DEPARTMENTS = ADMIN_DEPARTMENTS.filter((d) => d !== "Executive");
