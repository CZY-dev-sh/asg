/**
 * ASG Team Roster — Canonical Reference
 * ═══════════════════════════════════════
 * This file is for REFERENCE ONLY. It is NOT imported by any component.
 * Each component has its own copy of the team data inline.
 *
 * When adding/removing team members, update ALL component files:
 *   - components/admin-dashboard.html
 *   - components/admin-dashboard-v2.html
 *   - components/team-directory.html
 *   - components/listing-hub-standalone.html (AGENT_EMAILS map)
 *
 * Last synced: March 2026
 */

// ── SENIOR AGENTS ───────────────────────────────────────────
const SENIORS = [
  { name: "Alex Stoykov",           email: "alex.stoykov@compass.com",           phone: "312-593-3110", fubPhone: "312-477-2199" },
  { name: "Sam Abadi",              email: "sam.abadi@compass.com",              phone: "847-334-4778", fubPhone: "847-595-5617" },
  { name: "Shelly Channey",         email: "shelly.kapoor@compass.com",          phone: "630-362-4041", fubPhone: "630-349-2470" },
  { name: "Nicolas Gamboa Wills",   email: "nicolas.gamboawills@compass.com",    phone: "312-610-0301", fubPhone: "815-853-2160" },
  { name: "Julian Levit",           email: "julianlevit@compass.com",            phone: "847-302-8804", fubPhone: "464-219-4534" },
  { name: "Mino Conenna",           email: "mino.conenna@compass.com",           phone: "847-477-7779", fubPhone: "708-847-4726" },
  { name: "Angela Engelbrecht",     email: "angela.engelbrecht@compass.com",     phone: "312-213-9916", fubPhone: "708-381-2210" },
  { name: "Layne Zagorin",          email: "layne.zagorin@compass.com",          phone: "773-425-0039", fubPhone: "773-897-3384" },
  { name: "Barbara Laken",          email: "barbara.laken@compass.com",          phone: "312-282-1087", fubPhone: "" },
  { name: "Gabriel Rendon",         email: "gabriel.rendon@compass.com",         phone: "(847) 813-7507", fubPhone: "224-506-0798" },
  { name: "Matthew Clevenger",      email: "matthew.clevenger@compass.com",      phone: "619-708-4420", fubPhone: "619-389-2658" },
];

// ── JUNIOR AGENTS ───────────────────────────────────────────
const JUNIORS = [
  { name: "Justin Curran",          email: "justin.curran@compass.com",          phone: "847-507-7753", fubPhone: "312-516-4375" },
  { name: "Cheryl Cohn",            email: "cheryl.cohn@compass.com",            phone: "312-860-0200", fubPhone: "312-847-4243" },
  { name: "Jason Stone",            email: "jason.stone@compass.com",            phone: "863-221-7522", fubPhone: "815-702-0994" },
  { name: "Andrea Mirchef",         email: "andrea.mirchef@compass.com",         phone: "847-884-8183", fubPhone: "312-818-2401" },
  { name: "Andrea Koedjikova",      email: "andrea.koedjikova@compass.com",      phone: "872-361-8022", fubPhone: "779-382-2765" },
  { name: "Alisa Bok",              email: "alisa.bok@compass.com",              phone: "847-630-7228", fubPhone: "847-499-1428" },
  { name: "Nasir Rizvi",            email: "nasir.rizvi@compass.com",            phone: "847-452-3363", fubPhone: "847-443-5540" },
  { name: "Natali Tzvetkova",       email: "natali.tzvetkova@compass.com",       phone: "773-260-2618", fubPhone: "309-724-1635" },
  { name: "Myriam El-Khoury",       email: "myriam.elkhoury@compass.com",        phone: "312-420-6284", fubPhone: "312-675-4562" },
  { name: "Serge Golota",           email: "serge.golota@compass.com",           phone: "847-834-5002", fubPhone: "312-598-1162" },
  { name: "Cameron Sine",           email: "cameron.sine@compass.com",           phone: "313-303-5400", fubPhone: "312-948-9637" },
  { name: "Kelsey Glascott",        email: "kelsey.glasscott@compass.com",       phone: "773-899-0556", fubPhone: "312-945-0145" },
  { name: "Josie Ontiveros",        email: "josie.ontiveros@compass.com",        phone: "309-752-3491", fubPhone: "" },
  { name: "Preety Sidhu",           email: "preety.sidhu@compass.com",           phone: "872-221-3363", fubPhone: "" },
  { name: "Chloe Dittmer",          email: "chloe.dittmer@compass.com",          phone: "708-270-2515", fubPhone: "" },
];

// Additional juniors in team-directory.html only:
// Breanna Raspopovich, Danica Thomas, Deannine Weber Ronan

// ── ADMIN STAFF ─────────────────────────────────────────────
const ADMIN = [
  { name: "Ellyn Andree",    email: "ellyn.andree@compass.com",    phone: "630-746-9034", role: "Sales Director",          dept: "Sales",     hours: "9-5 Mon-Fri" },
  { name: "Seph Gagon",      email: "seph.gagon@compass.com",      phone: "628-600-6137", role: "Transaction Coordinator", dept: "Ops",       hours: "9-5 Mon-Fri" },
  { name: "Ian Drummond",    email: "ian.drummond@compass.com",    phone: "815-351-0590", role: "Inside Sales Rep",        dept: "Sales",     hours: "9-5 Mon-Fri" },
  { name: "Tim Urmanczy",    email: "tim.urmanczy@compass.com",    phone: "949-652-0526", role: "Marketing Director",      dept: "Marketing", hours: "7-3 Mon-Fri" },
  { name: "Ellie Ngassa",    email: "ellie.ngassa@compass.com",    phone: "517-648-0654", role: "Marketing Coordinator",   dept: "Marketing", hours: "9-5 Mon-Fri" },
];

// ── QUICK LINKS ─────────────────────────────────────────────
const QUICK_LINKS = [
  { title: "Zillow",           href: "https://www.zillow.com/agents/showcase/" },
  { title: "Matterport",       href: "https://my.matterport.com/models?organization=vuif7isneoC" },
  { title: "Follow Up Boss",   href: "https://login.followupboss.com/login?start_url=/2/admin/overview&subdomain=compass219" },
  { title: "MLS",              href: "https://connectmls-api.mredllc.com/oid/login" },
  { title: "Compass",          href: "https://www.compass.com/app/home/" },
  { title: "Blog",             href: "https://www.alexstoykovgroup.com/blog" },
  { title: "Team Resources",   href: "https://www.alexstoykovgroup.com/resources" },
  { title: "Senior Hub",       href: "https://www.alexstoykovgroup.com/seniorhubhome" },
  { title: "Junior Hub",       href: "https://www.alexstoykovgroup.com/juniorhub" },
  { title: "Team Updates",     href: "https://www.alexstoykovgroup.com/updatecenter" },
  { title: "Senior Meetings",  href: "https://www.alexstoykovgroup.com/seniorteammeetings" },
  { title: "Admin Hub",        href: "https://www.alexstoykovgroup.com/adminhub" },
];

// ── GOOGLE DRIVE FOLDERS ────────────────────────────────────
const DRIVE_LINKS = {
  allPhotos:    "https://drive.google.com/drive/folders/1FY64_Fe-jVDUIb6hWzwPFdo6fotm7Ztn?usp=sharing",
  agentFolders: "https://drive.google.com/drive/folders/1zIfDqSpA94cRFajB3TsA3ryJibKSinIK?usp=drive_link",
  brandAssets:  "https://drive.google.com/drive/folders/1Z3-1_Y_oGvvvLR6ZXVB1PkGr03i9tYEx?usp=sharing",
};
