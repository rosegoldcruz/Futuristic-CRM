// TODO: reconnect to Postgres/Supabase when backend is available.
// This file provides local mock data so the UI works as a portfolio-ready MVP
// without a live database connection.

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  projectType: string;
  source: string;
  budgetRange: string;
  status: "new" | "contacted" | "qualified" | "hot" | "quote-ready" | "lost";
  priority: "high" | "medium" | "low";
  callDisposition: "no-answer" | "left-voicemail" | "follow-up-booked" | "quoted" | "not-interested";
  notes: string;
  createdAt: string;
  nextFollowUp: string;
};

export type Quote = {
  id: string;
  customerName: string;
  projectType: string;
  city: string;
  amount: number;
  status: "draft" | "sent" | "pending" | "won" | "lost" | "expired";
  sentAt: string;
  validUntil: string;
  assignedRep: string;
  probability: number;
};

export type Job = {
  id: string;
  customerName: string;
  city: string;
  projectType: string;
  installer: string;
  supplier: string;
  materialStatus: "ordered" | "in-transit" | "delivered" | "missing" | "delayed";
  paymentStatus: "paid" | "partial" | "hold" | "pending" | "overdue";
  qcStatus: "pending" | "passed" | "failed" | "photos-due";
  stage: "scheduled" | "in-progress" | "awaiting-installer" | "completed" | "on-hold";
  installDate: string;
  nextAction: string;
};

export type Homeowner = {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  activeProject: string;
  status: "active" | "completed" | "prospecting" | "on-hold";
};

export type Installer = {
  id: string;
  name: string;
  coverageArea: string;
  availability: "available" | "busy" | "unavailable";
  activeJobs: number;
  slaScore: number;
  rating: number;
  status: "active" | "inactive" | "suspended";
};

export type Supplier = {
  id: string;
  name: string;
  materialCategory: string;
  fulfillmentRate: number;
  openOrders: number;
  status: "active" | "delayed" | "inactive";
};

export type Material = {
  sku: string;
  name: string;
  category: string;
  supplier: string;
  dimensions: string;
  imageLabel: string;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock" | "on-order";
  eta: string;
};

export type Payment = {
  invoiceId: string;
  customerName: string;
  amount: number;
  status: "paid" | "pending" | "hold" | "overdue" | "partial";
  dueDate: string;
};

export type Document = {
  id: string;
  name: string;
  type: "contract" | "quote" | "qc-photo" | "completion" | "permit" | "invoice";
  linkedJob: string;
  status: "signed" | "pending" | "draft" | "expired";
  uploadedAt: string;
};

export type WorkOrder = {
  id: string;
  jobId: string;
  installer: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled" | "pending";
  scheduledDate: string;
  notes: string;
};

// ─── Leads ─────────────────────────────────────────────────────────────────
export const mockLeads: Lead[] = [
  {
    id: "L-1001",
    name: "Emma Castillo",
    phone: "(602) 555-0191",
    email: "emma.c@email.com",
    address: "8712 E Via Linda Blvd, Scottsdale, AZ 85258",
    city: "Scottsdale, AZ",
    projectType: "Kitchen Reface",
    source: "Meta Ads",
    budgetRange: "$8K–$12K",
    status: "hot",
    priority: "high",
    callDisposition: "follow-up-booked",
    notes: "Asked for white shaker with soft-close upgrade. Wants install before end of month.",
    createdAt: "2025-05-01",
    nextFollowUp: "2025-05-08",
  },
  {
    id: "L-1002",
    name: "Marcus Wilson",
    phone: "(480) 555-0342",
    email: "mwilson@email.com",
    address: "1943 N Higley Rd, Mesa, AZ 85205",
    city: "Mesa, AZ",
    projectType: "Cabinet Replacement",
    source: "TikTok",
    budgetRange: "$15K–$20K",
    status: "quote-ready",
    priority: "high",
    callDisposition: "quoted",
    notes: "Requested premium hardware options and financing terms before signing quote.",
    createdAt: "2025-05-02",
    nextFollowUp: "2025-05-07",
  },
  {
    id: "L-1003",
    name: "Diane Alvarez",
    phone: "(623) 555-0784",
    email: "d.alvarez@email.com",
    address: "3309 W Camelback Rd, Phoenix, AZ 85017",
    city: "Phoenix, AZ",
    projectType: "Closet Build-Out",
    source: "Referral",
    budgetRange: "$5K–$8K",
    status: "contacted",
    priority: "medium",
    callDisposition: "left-voicemail",
    notes: "Could not connect live. Sent follow-up text with booking link for consult.",
    createdAt: "2025-05-03",
    nextFollowUp: "2025-05-10",
  },
  {
    id: "L-1004",
    name: "James Park",
    phone: "(602) 555-0456",
    email: "jpark@email.com",
    address: "1414 E Broadway Rd, Tempe, AZ 85282",
    city: "Tempe, AZ",
    projectType: "Full Kitchen Remodel",
    source: "Google",
    budgetRange: "$25K–$40K",
    status: "qualified",
    priority: "high",
    callDisposition: "follow-up-booked",
    notes: "Confirmed in-home measurement appointment for Friday at 3:00 PM.",
    createdAt: "2025-05-04",
    nextFollowUp: "2025-05-09",
  },
  {
    id: "L-1005",
    name: "Rachel Kim",
    phone: "(480) 555-0988",
    email: "rkim@email.com",
    address: "2200 N Dobson Rd, Chandler, AZ 85224",
    city: "Chandler, AZ",
    projectType: "Bathroom Vanity",
    source: "Instagram",
    budgetRange: "$3K–$6K",
    status: "new",
    priority: "low",
    callDisposition: "no-answer",
    notes: "Lead form submitted late night. No pickup yet; queued for second call attempt.",
    createdAt: "2025-05-05",
    nextFollowUp: "2025-05-11",
  },
  {
    id: "L-1006",
    name: "Tony Nguyen",
    phone: "(602) 555-0123",
    email: "tnguyen@email.com",
    address: "1050 S Val Vista Dr, Gilbert, AZ 85296",
    city: "Gilbert, AZ",
    projectType: "Kitchen Reface",
    source: "Meta Ads",
    budgetRange: "$10K–$14K",
    status: "hot",
    priority: "high",
    callDisposition: "follow-up-booked",
    notes: "Interested in cabinet reface + island wrap. Requested Saturday consultation.",
    createdAt: "2025-05-05",
    nextFollowUp: "2025-05-08",
  },
  {
    id: "L-1007",
    name: "Sarah Bennett",
    phone: "(623) 555-0677",
    email: "sbennett@email.com",
    address: "8190 W Deer Valley Rd, Peoria, AZ 85382",
    city: "Peoria, AZ",
    projectType: "Laundry Room Build",
    source: "Referral",
    budgetRange: "$4K–$7K",
    status: "contacted",
    priority: "medium",
    callDisposition: "left-voicemail",
    notes: "Needs custom storage layout. Waiting on callback to confirm measurements.",
    createdAt: "2025-05-06",
    nextFollowUp: "2025-05-12",
  },
  {
    id: "L-1008",
    name: "David Torres",
    phone: "(480) 555-0321",
    email: "dtorres@email.com",
    address: "7230 E Shea Blvd, Scottsdale, AZ 85260",
    city: "Scottsdale, AZ",
    projectType: "Whole Home Reface",
    source: "Google",
    budgetRange: "$30K–$50K",
    status: "qualified",
    priority: "high",
    callDisposition: "follow-up-booked",
    notes: "Wants full-home package estimate. Requested references and financing sheet.",
    createdAt: "2025-05-06",
    nextFollowUp: "2025-05-09",
  },
];

// ─── Quotes ────────────────────────────────────────────────────────────────
export const mockQuotes: Quote[] = [
  {
    id: "Q-2201",
    customerName: "Emma Castillo",
    projectType: "Kitchen Reface",
    city: "Scottsdale, AZ",
    amount: 11400,
    status: "sent",
    sentAt: "2025-05-03",
    validUntil: "2025-05-17",
    assignedRep: "Riley M.",
    probability: 80,
  },
  {
    id: "Q-2202",
    customerName: "Marcus Wilson",
    projectType: "Cabinet Replacement",
    city: "Mesa, AZ",
    amount: 17800,
    status: "pending",
    sentAt: "2025-05-04",
    validUntil: "2025-05-18",
    assignedRep: "Jordan T.",
    probability: 65,
  },
  {
    id: "Q-2203",
    customerName: "James Park",
    projectType: "Full Kitchen Remodel",
    city: "Tempe, AZ",
    amount: 34500,
    status: "won",
    sentAt: "2025-04-28",
    validUntil: "2025-05-12",
    assignedRep: "Riley M.",
    probability: 100,
  },
  {
    id: "Q-2204",
    customerName: "David Torres",
    projectType: "Whole Home Reface",
    city: "Scottsdale, AZ",
    amount: 42000,
    status: "draft",
    sentAt: "—",
    validUntil: "—",
    assignedRep: "Jordan T.",
    probability: 40,
  },
  {
    id: "Q-2205",
    customerName: "Rachel Kim",
    projectType: "Bathroom Vanity",
    city: "Chandler, AZ",
    amount: 4900,
    status: "lost",
    sentAt: "2025-04-20",
    validUntil: "2025-05-04",
    assignedRep: "Alex B.",
    probability: 0,
  },
  {
    id: "Q-2206",
    customerName: "Tony Nguyen",
    projectType: "Kitchen Reface",
    city: "Gilbert, AZ",
    amount: 12600,
    status: "sent",
    sentAt: "2025-05-06",
    validUntil: "2025-05-20",
    assignedRep: "Alex B.",
    probability: 70,
  },
  {
    id: "Q-2207",
    customerName: "Sarah Bennett",
    projectType: "Laundry Room Build",
    city: "Peoria, AZ",
    amount: 5800,
    status: "pending",
    sentAt: "2025-05-05",
    validUntil: "2025-05-19",
    assignedRep: "Riley M.",
    probability: 55,
  },
];

// ─── Jobs ──────────────────────────────────────────────────────────────────
export const mockJobs: Job[] = [
  {
    id: "VK-2041",
    customerName: "Emma Castillo",
    city: "Scottsdale, AZ",
    projectType: "Kitchen Reface",
    installer: "Botta Install Co.",
    supplier: "AZ Cabinet Supply",
    materialStatus: "missing",
    paymentStatus: "partial",
    qcStatus: "pending",
    stage: "scheduled",
    installDate: "2025-05-09",
    nextAction: "Source missing panels",
  },
  {
    id: "VK-2033",
    customerName: "Marcus Wilson",
    city: "Mesa, AZ",
    projectType: "Cabinet Replacement",
    installer: "Southwest Installs",
    supplier: "ProPanel AZ",
    materialStatus: "delivered",
    paymentStatus: "hold",
    qcStatus: "photos-due",
    stage: "on-hold",
    installDate: "2025-05-06",
    nextAction: "Resolve payment hold",
  },
  {
    id: "VK-2050",
    customerName: "Diane Alvarez",
    city: "Phoenix, AZ",
    projectType: "Closet Build-Out",
    installer: "TBD",
    supplier: "Closet Depot",
    materialStatus: "in-transit",
    paymentStatus: "paid",
    qcStatus: "pending",
    stage: "awaiting-installer",
    installDate: "2025-05-12",
    nextAction: "Assign installer",
  },
  {
    id: "VK-2038",
    customerName: "James Park",
    city: "Tempe, AZ",
    projectType: "Full Kitchen Remodel",
    installer: "Precision Kitchen Co.",
    supplier: "Southwest Cabinet Group",
    materialStatus: "delivered",
    paymentStatus: "paid",
    qcStatus: "passed",
    stage: "in-progress",
    installDate: "2025-05-07",
    nextAction: "Final walkthrough",
  },
  {
    id: "VK-2044",
    customerName: "Tony Nguyen",
    city: "Gilbert, AZ",
    projectType: "Kitchen Reface",
    installer: "Botta Install Co.",
    supplier: "AZ Cabinet Supply",
    materialStatus: "ordered",
    paymentStatus: "paid",
    qcStatus: "pending",
    stage: "scheduled",
    installDate: "2025-05-14",
    nextAction: "Confirm delivery ETA",
  },
  {
    id: "VK-2029",
    customerName: "Rachel Kim",
    city: "Chandler, AZ",
    projectType: "Bathroom Vanity",
    installer: "Desert Finish Pros",
    supplier: "Vanity Pro Supply",
    materialStatus: "delayed",
    paymentStatus: "partial",
    qcStatus: "pending",
    stage: "scheduled",
    installDate: "2025-05-16",
    nextAction: "Material delay ETA update",
  },
];

// ─── Homeowners ────────────────────────────────────────────────────────────
export const mockHomeowners: Homeowner[] = [
  { id: "HO-001", name: "Emma Castillo", city: "Scottsdale, AZ", phone: "(602) 555-0191", email: "emma.c@email.com", activeProject: "Kitchen Reface", status: "active" },
  { id: "HO-002", name: "Marcus Wilson", city: "Mesa, AZ", phone: "(480) 555-0342", email: "mwilson@email.com", activeProject: "Cabinet Replacement", status: "active" },
  { id: "HO-003", name: "Diane Alvarez", city: "Phoenix, AZ", phone: "(623) 555-0784", email: "d.alvarez@email.com", activeProject: "Closet Build-Out", status: "active" },
  { id: "HO-004", name: "James Park", city: "Tempe, AZ", phone: "(602) 555-0456", email: "jpark@email.com", activeProject: "Full Kitchen Remodel", status: "active" },
  { id: "HO-005", name: "Rachel Kim", city: "Chandler, AZ", phone: "(480) 555-0988", email: "rkim@email.com", activeProject: "Bathroom Vanity", status: "active" },
  { id: "HO-006", name: "Tony Nguyen", city: "Gilbert, AZ", phone: "(602) 555-0123", email: "tnguyen@email.com", activeProject: "Kitchen Reface", status: "active" },
  { id: "HO-007", name: "Linda Flores", city: "Glendale, AZ", phone: "(623) 555-0211", email: "lflores@email.com", activeProject: "—", status: "completed" },
  { id: "HO-008", name: "Steve Morales", city: "Surprise, AZ", phone: "(623) 555-0654", email: "smorales@email.com", activeProject: "—", status: "prospecting" },
];

// ─── Installers ────────────────────────────────────────────────────────────
export const mockInstallers: Installer[] = [
  { id: "IN-001", name: "Botta Install Co.", coverageArea: "Scottsdale / Gilbert", availability: "busy", activeJobs: 3, slaScore: 97, rating: 4.9, status: "active" },
  { id: "IN-002", name: "Southwest Installs", coverageArea: "Mesa / Chandler", availability: "available", activeJobs: 1, slaScore: 94, rating: 4.7, status: "active" },
  { id: "IN-003", name: "Precision Kitchen Co.", coverageArea: "Tempe / Phoenix", availability: "busy", activeJobs: 2, slaScore: 99, rating: 5.0, status: "active" },
  { id: "IN-004", name: "Desert Finish Pros", coverageArea: "Chandler / Gilbert", availability: "available", activeJobs: 1, slaScore: 91, rating: 4.6, status: "active" },
  { id: "IN-005", name: "AZ Home Crew", coverageArea: "Peoria / Glendale", availability: "available", activeJobs: 0, slaScore: 89, rating: 4.5, status: "active" },
  { id: "IN-006", name: "Valley Cabinet Pros", coverageArea: "All Metro Phoenix", availability: "unavailable", activeJobs: 4, slaScore: 96, rating: 4.8, status: "active" },
  { id: "IN-007", name: "NextGen Installs", coverageArea: "Scottsdale / Paradise Valley", availability: "available", activeJobs: 0, slaScore: 93, rating: 4.7, status: "active" },
];

// ─── Suppliers ─────────────────────────────────────────────────────────────
export const mockSuppliers: Supplier[] = [
  { id: "SP-001", name: "AZ Cabinet Supply", materialCategory: "Cabinet Doors / Panels", fulfillmentRate: 96, openOrders: 4, status: "active" },
  { id: "SP-002", name: "ProPanel AZ", materialCategory: "Cabinet Boxes / Panels", fulfillmentRate: 98, openOrders: 2, status: "active" },
  { id: "SP-003", name: "Southwest Cabinet Group", materialCategory: "Full Kitchen Units", fulfillmentRate: 94, openOrders: 3, status: "active" },
  { id: "SP-004", name: "Closet Depot", materialCategory: "Closet Systems", fulfillmentRate: 91, openOrders: 1, status: "active" },
  { id: "SP-005", name: "Vanity Pro Supply", materialCategory: "Bath Vanities / Fixtures", fulfillmentRate: 87, openOrders: 2, status: "delayed" },
  { id: "SP-006", name: "Phoenix Hardware Co.", materialCategory: "Hardware / Accessories", fulfillmentRate: 99, openOrders: 6, status: "active" },
];

// ─── Materials ─────────────────────────────────────────────────────────────
export const mockMaterials: Material[] = [
  { sku: "CAB-DOR-001", name: 'Shaker Door 12"', category: "Cabinet Doors", supplier: "AZ Cabinet Supply", dimensions: '12"W x 30"H x 0.75"D', imageLabel: "White Shaker Door Panel", stockStatus: "in-stock", eta: "—" },
  { sku: "CAB-DOR-002", name: 'Shaker Door 18"', category: "Cabinet Doors", supplier: "AZ Cabinet Supply", dimensions: '18"W x 30"H x 0.75"D', imageLabel: "White Shaker Door Panel", stockStatus: "low-stock", eta: "2025-05-10" },
  { sku: "CAB-PNL-001", name: "Side Panel 36H", category: "Panels", supplier: "ProPanel AZ", dimensions: '24"W x 36"H x 0.75"D', imageLabel: "Cabinet Side Panel", stockStatus: "in-stock", eta: "—" },
  { sku: "CLO-SYS-001", name: "Closet Tower 84H", category: "Closet Systems", supplier: "Closet Depot", dimensions: '30"W x 84"H x 16"D', imageLabel: "Laminate Closet Tower", stockStatus: "on-order", eta: "2025-05-11" },
  { sku: "VAN-001", name: 'Vanity Unit 36"', category: "Bath Vanities", supplier: "Vanity Pro Supply", dimensions: '36"W x 34.5"H x 21"D', imageLabel: "Single Sink Vanity Unit", stockStatus: "out-of-stock", eta: "2025-05-18" },
  { sku: "HDW-001", name: "Euro Hinge 110°", category: "Hardware", supplier: "Phoenix Hardware Co.", dimensions: '2.5"W x 1.25"H x 0.6"D', imageLabel: "Concealed Cabinet Hinge", stockStatus: "in-stock", eta: "—" },
  { sku: "HDW-002", name: "Soft-Close Drawer Slide", category: "Hardware", supplier: "Phoenix Hardware Co.", dimensions: '18"L x 1.8"H x 0.5"D', imageLabel: "Ball-Bearing Drawer Slide", stockStatus: "in-stock", eta: "—" },
  { sku: "CAB-BOX-001", name: 'Base Cabinet 24"', category: "Cabinet Boxes", supplier: "Southwest Cabinet Group", dimensions: '24"W x 34.5"H x 24"D', imageLabel: "Plywood Base Cabinet Box", stockStatus: "low-stock", eta: "2025-05-13" },
];

// ─── Payments ──────────────────────────────────────────────────────────────
export const mockPayments: Payment[] = [
  { invoiceId: "INV-5501", customerName: "James Park", amount: 34500, status: "paid", dueDate: "2025-04-30" },
  { invoiceId: "INV-5502", customerName: "Emma Castillo", amount: 5700, status: "partial", dueDate: "2025-05-07" },
  { invoiceId: "INV-5503", customerName: "Marcus Wilson", amount: 17800, status: "hold", dueDate: "2025-05-05" },
  { invoiceId: "INV-5504", customerName: "Tony Nguyen", amount: 12600, status: "paid", dueDate: "2025-05-06" },
  { invoiceId: "INV-5505", customerName: "Rachel Kim", amount: 4900, status: "overdue", dueDate: "2025-05-01" },
  { invoiceId: "INV-5506", customerName: "Diane Alvarez", amount: 5800, status: "pending", dueDate: "2025-05-14" },
  { invoiceId: "INV-5507", customerName: "Sarah Bennett", amount: 2900, status: "pending", dueDate: "2025-05-15" },
];

// ─── Documents ─────────────────────────────────────────────────────────────
export const mockDocuments: Document[] = [
  { id: "DOC-001", name: "Emma Castillo — Install Contract", type: "contract", linkedJob: "VK-2041", status: "signed", uploadedAt: "2025-05-02" },
  { id: "DOC-002", name: "Marcus Wilson — Quote PDF", type: "quote", linkedJob: "VK-2033", status: "pending", uploadedAt: "2025-05-04" },
  { id: "DOC-003", name: "James Park — Completion Record", type: "completion", linkedJob: "VK-2038", status: "signed", uploadedAt: "2025-05-07" },
  { id: "DOC-004", name: "Diane Alvarez — Permit AZ-48821", type: "permit", linkedJob: "VK-2050", status: "pending", uploadedAt: "2025-05-03" },
  { id: "DOC-005", name: "Tony Nguyen — Install Contract", type: "contract", linkedJob: "VK-2044", status: "signed", uploadedAt: "2025-05-05" },
  { id: "DOC-006", name: "Rachel Kim — QC Photos", type: "qc-photo", linkedJob: "VK-2029", status: "draft", uploadedAt: "2025-05-06" },
  { id: "DOC-007", name: "Marcus Wilson — QC Photos", type: "qc-photo", linkedJob: "VK-2033", status: "pending", uploadedAt: "2025-05-06" },
];

// ─── Work Orders ───────────────────────────────────────────────────────────
export const mockWorkOrders: WorkOrder[] = [
  { id: "WO-8801", jobId: "VK-2041", installer: "Botta Install Co.", status: "scheduled", scheduledDate: "2025-05-09", notes: "Panels delayed — confirm AM delivery before dispatch." },
  { id: "WO-8802", jobId: "VK-2033", installer: "Southwest Installs", status: "pending", scheduledDate: "2025-05-06", notes: "On hold — payment dispute under review." },
  { id: "WO-8803", jobId: "VK-2050", installer: "TBD", status: "pending", scheduledDate: "2025-05-12", notes: "Awaiting installer assignment." },
  { id: "WO-8804", jobId: "VK-2038", installer: "Precision Kitchen Co.", status: "in-progress", scheduledDate: "2025-05-07", notes: "Day 2 of 3. Final walkthrough tomorrow." },
  { id: "WO-8805", jobId: "VK-2044", installer: "Botta Install Co.", status: "scheduled", scheduledDate: "2025-05-14", notes: "Material delivery confirmed for 5/13." },
  { id: "WO-8806", jobId: "VK-2029", installer: "Desert Finish Pros", status: "scheduled", scheduledDate: "2025-05-16", notes: "Vanity ETA delayed to 5/15. Monitor." },
];
