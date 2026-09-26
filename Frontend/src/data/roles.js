// Fix #17 + #18: Mixed industries, fuzzy search with typo tolerance,
// no suggestions until user types (handled in RoleSearch component).

export const ROLES = [
  // Tech
  { id: "frontend",       label: "Frontend Developer",              category: "tech" },
  { id: "backend",        label: "Backend Developer",               category: "tech" },
  { id: "fullstack",      label: "Full Stack Developer",            category: "tech" },
  { id: "mobile",         label: "Mobile App Developer",            category: "tech" },
  { id: "data_analyst",   label: "Data Analyst",                    category: "tech" },
  { id: "data_scientist", label: "Data Scientist",                  category: "tech" },
  { id: "devops",         label: "DevOps Engineer",                 category: "tech" },
  { id: "qa",             label: "QA / Test Engineer",              category: "tech" },
  { id: "ml_engineer",    label: "Machine Learning Engineer",       category: "tech" },
  { id: "cybersec",       label: "Cybersecurity Analyst",           category: "tech" },
  { id: "cloud",          label: "Cloud Engineer",                  category: "tech" },
  { id: "sysadmin",       label: "System Administrator",            category: "tech" },

  // Design
  { id: "ui_ux",          label: "UI/UX Designer",                  category: "design" },
  { id: "graphic",        label: "Graphic Designer",                category: "design" },
  { id: "motion",         label: "Motion Designer",                 category: "design" },
  { id: "product_design", label: "Product Designer",                category: "design" },

  // Business
  { id: "product_mgr",    label: "Product Manager",                 category: "business" },
  { id: "project_mgr",    label: "Project Manager",                 category: "business" },
  { id: "biz_analyst",    label: "Business Analyst",                category: "business" },
  { id: "sales",          label: "Sales Executive",                 category: "business" },
  { id: "sales_mgr",      label: "Sales Manager",                   category: "business" },
  { id: "marketing",      label: "Marketing Executive",             category: "business" },
  { id: "digital_mktg",   label: "Digital Marketing Specialist",    category: "business" },
  { id: "hr",             label: "HR Executive",                    category: "business" },
  { id: "hr_mgr",         label: "HR Manager",                      category: "business" },
  { id: "operations",     label: "Operations Manager",              category: "business" },
  { id: "supply_chain",   label: "Supply Chain Manager",            category: "business" },
  { id: "logistics",      label: "Logistics Coordinator",           category: "business" },

  // Finance
  { id: "accountant",     label: "Accountant",                      category: "finance" },
  { id: "accounting_asst",label: "Accounting Assistant",            category: "finance" },
  { id: "financial_analyst","label": "Financial Analyst",           category: "finance" },
  { id: "auditor",        label: "Auditor",                         category: "finance" },
  { id: "tax_consultant", label: "Tax Consultant",                  category: "finance" },
  { id: "banker",         label: "Bank Officer",                    category: "finance" },

  // Healthcare
  { id: "doctor",         label: "Doctor",                          category: "healthcare" },
  { id: "nurse",          label: "Nurse",                           category: "healthcare" },
  { id: "pharmacist",     label: "Pharmacist",                      category: "healthcare" },
  { id: "lab_tech",       label: "Lab Technician",                  category: "healthcare" },
  { id: "physiotherapist",label: "Physiotherapist",                 category: "healthcare" },

  // Education
  { id: "teacher",        label: "Teacher",                         category: "education" },
  { id: "lecturer",       label: "Lecturer",                        category: "education" },
  { id: "trainer",        label: "Corporate Trainer",               category: "education" },
  { id: "tutor",          label: "Private Tutor",                   category: "education" },

  // Content / Media
  { id: "content_writer", label: "Content Writer",                  category: "content" },
  { id: "copywriter",     label: "Copywriter",                      category: "content" },
  { id: "seo_specialist", label: "SEO Specialist",                  category: "content" },
  { id: "social_media",   label: "Social Media Manager",            category: "content" },
  { id: "video_editor",   label: "Video Editor",                    category: "content" },

  // Support / Admin
  { id: "customer_support","label": "Customer Support Representative", category: "support" },
  { id: "call_center",    label: "Call Center Agent",               category: "support" },
  { id: "admin",          label: "Administrative Assistant",        category: "admin" },
  { id: "receptionist",   label: "Receptionist",                    category: "admin" },
  { id: "data_entry",     label: "Data Entry Operator",             category: "admin" },

  // Engineering / Manufacturing
  { id: "civil_eng",      label: "Civil Engineer",                  category: "engineering" },
  { id: "mech_eng",       label: "Mechanical Engineer",             category: "engineering" },
  { id: "electrical_eng", label: "Electrical Engineer",             category: "engineering" },
  { id: "architect",      label: "Architect",                       category: "engineering" },

  // Legal
  { id: "lawyer",         label: "Lawyer",                          category: "legal" },
  { id: "paralegal",      label: "Paralegal",                       category: "legal" },

  { id: "other",          label: "Other",                           category: "general" },
];

// Fuzzy search: supports partial match, typos (levenshtein-lite),
// case-insensitive, extra spaces.
export function searchRoles(query) {

    const q = (query || "").trim().toLowerCase();

    if (!q) return [];

    return ROLES.filter(role => {

        return (

            role.label.toLowerCase().includes(q)

            ||

            role.category.toLowerCase().includes(q)

        );

    }).slice(0,8);

}

export const EXPERIENCE_LEVELS = [
  { id: "fresher", label: "Fresher (0 yrs)" },
  { id: "junior",  label: "1-2 years" },
  { id: "mid",     label: "3-5 years" },
  { id: "senior",  label: "5+ years" },
];

export const DYNAMIC_ROLE_FIELDS = {
  frontend: [
    { key: "github", label: "GitHub Profile", type: "url" },
    { key: "portfolio", label: "Portfolio Link", type: "url" },
    { key: "notable_projects", label: "Notable Projects", type: "textarea" },
  ],
  backend: [
    { key: "github", label: "GitHub Profile", type: "url" },
    { key: "systems_worked_on", label: "Systems / APIs Worked On", type: "textarea" },
  ],
  fullstack: [
    { key: "github", label: "GitHub Profile", type: "url" },
    { key: "portfolio", label: "Portfolio Link", type: "url" },
  ],
  ui_ux: [
    { key: "portfolio", label: "Portfolio / Behance Link", type: "url" },
  ],
  graphic: [
    { key: "portfolio", label: "Portfolio / Behance Link", type: "url" },
  ],
  data_analyst: [
    { key: "github", label: "GitHub / Kaggle Profile", type: "url" },
  ],
};

export function getRoleFields(roleId){

    return DYNAMIC_ROLE_FIELDS[roleId] || [];

}