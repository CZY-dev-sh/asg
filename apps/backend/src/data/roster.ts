// Fallback seed roster ONLY — not the source of truth. The Google Sheet behind
// `POST /api/admin/directory` (see `repositories/admin.ts`) is canonical for any
// agent it has synced; `sync/directory.ts` will not overwrite a row once that's
// happened (see the guard + comment there). This file exists so an agent can
// exist in `agents` (and therefore sign up) before/without a sheet edit, and so
// a fresh environment has something to seed from. See docs/AGENT-HUB-PRD.md §4.4.

export interface RosterEntry {
  name: string;
  email: string;
  phone?: string;
  fubPhone?: string;
  tier: 'senior' | 'junior' | 'admin';
  role?: string;
  dept?: string;
  hours?: string;
}

export const ROSTER: RosterEntry[] = [
  // ── Senior agents ──
  { name: 'Alex Stoykov', email: 'alex.stoykov@compass.com', phone: '312-593-3110', fubPhone: '312-477-2199', tier: 'senior' },
  { name: 'Sam Abadi', email: 'sam.abadi@compass.com', phone: '847-334-4778', fubPhone: '847-595-5617', tier: 'senior' },
  { name: 'Shelly Channey', email: 'shelly.kapoor@compass.com', phone: '630-362-4041', fubPhone: '630-349-2470', tier: 'senior' },
  { name: 'Nicolas Gamboa Wills', email: 'nicolas.gamboawills@compass.com', phone: '312-610-0301', fubPhone: '815-853-2160', tier: 'senior' },
  { name: 'Julian Levit', email: 'julianlevit@compass.com', phone: '847-302-8804', fubPhone: '464-219-4534', tier: 'senior' },
  { name: 'Mino Conenna', email: 'mino.conenna@compass.com', phone: '847-477-7779', fubPhone: '708-847-4726', tier: 'senior' },
  { name: 'Angela Engelbrecht', email: 'angela.engelbrecht@compass.com', phone: '312-213-9916', fubPhone: '708-381-2210', tier: 'senior' },
  { name: 'Layne Zagorin', email: 'layne.zagorin@compass.com', phone: '773-425-0039', fubPhone: '773-897-3384', tier: 'senior' },
  { name: 'Barbara Laken', email: 'barbara.laken@compass.com', phone: '312-282-1087', tier: 'senior' },
  { name: 'Gabriel Rendon', email: 'gabriel.rendon@compass.com', phone: '(847) 813-7507', fubPhone: '224-506-0798', tier: 'senior' },
  { name: 'Matthew Clevenger', email: 'matthew.clevenger@compass.com', phone: '619-708-4420', fubPhone: '619-389-2658', tier: 'senior' },

  // ── Junior agents ──
  { name: 'Justin Curran', email: 'justin.curran@compass.com', phone: '847-507-7753', fubPhone: '312-516-4375', tier: 'junior' },
  { name: 'Cheryl Cohn', email: 'cheryl.cohn@compass.com', phone: '312-860-0200', fubPhone: '312-847-4243', tier: 'junior' },
  { name: 'Jason Stone', email: 'jason.stone@compass.com', phone: '863-221-7522', fubPhone: '815-702-0994', tier: 'junior' },
  { name: 'Andrea Mirchef', email: 'andrea.mirchef@compass.com', phone: '847-884-8183', fubPhone: '312-818-2401', tier: 'junior' },
  { name: 'Andrea Koedjikova', email: 'andrea.koedjikova@compass.com', phone: '872-361-8022', fubPhone: '779-382-2765', tier: 'junior' },
  { name: 'Alisa Bok', email: 'alisa.bok@compass.com', phone: '847-630-7228', fubPhone: '847-499-1428', tier: 'junior' },
  { name: 'Nasir Rizvi', email: 'nasir.rizvi@compass.com', phone: '847-452-3363', fubPhone: '847-443-5540', tier: 'junior' },
  { name: 'Natali Tzvetkova', email: 'natali.tzvetkova@compass.com', phone: '773-260-2618', fubPhone: '309-724-1635', tier: 'junior' },
  { name: 'Myriam El-Khoury', email: 'myriam.elkhoury@compass.com', phone: '312-420-6284', fubPhone: '312-675-4562', tier: 'junior' },
  { name: 'Serge Golota', email: 'serge.golota@compass.com', phone: '847-834-5002', fubPhone: '312-598-1162', tier: 'junior' },
  { name: 'Cameron Sine', email: 'cameron.sine@compass.com', phone: '313-303-5400', fubPhone: '312-948-9637', tier: 'junior' },
  { name: 'Kelsey Glascott', email: 'kelsey.glasscott@compass.com', phone: '773-899-0556', fubPhone: '312-945-0145', tier: 'junior' },
  { name: 'Josie Ontiveros', email: 'josie.ontiveros@compass.com', phone: '309-752-3491', tier: 'junior' },
  { name: 'Preety Sidhu', email: 'preety.sidhu@compass.com', phone: '872-221-3363', tier: 'junior' },
  { name: 'Chloe Dittmer', email: 'chloe.dittmer@compass.com', phone: '708-270-2515', tier: 'junior' },

  // ── Admin staff ──
  { name: 'Ellyn Andree', email: 'ellyn.andree@compass.com', phone: '630-746-9034', role: 'Sales Director', dept: 'Sales', hours: '9-5 Mon-Fri', tier: 'admin' },
  { name: 'Seph Gagon', email: 'seph.gagon@compass.com', phone: '628-600-6137', role: 'Transaction Coordinator', dept: 'Ops', hours: '9-5 Mon-Fri', tier: 'admin' },
  { name: 'Ian Drummond', email: 'ian.drummond@compass.com', phone: '815-351-0590', role: 'Inside Sales Rep', dept: 'Sales', hours: '9-5 Mon-Fri', tier: 'admin' },
  { name: 'Tim Urmanczy', email: 'tim.urmanczy@compass.com', phone: '949-652-0526', role: 'Marketing Director', dept: 'Marketing', hours: '7-3 Mon-Fri', tier: 'admin' },
  { name: 'Ellie Ngassa', email: 'ellie.ngassa@compass.com', phone: '517-648-0654', role: 'Marketing Coordinator', dept: 'Marketing', hours: '9-5 Mon-Fri', tier: 'admin' },
];

export const QUICK_LINKS = [
  { title: 'Zillow', href: 'https://www.zillow.com/agents/showcase/' },
  { title: 'Matterport', href: 'https://my.matterport.com/models?organization=vuif7isneoC' },
  { title: 'Follow Up Boss', href: 'https://login.followupboss.com/login?start_url=/2/admin/overview&subdomain=compass219' },
  { title: 'MLS', href: 'https://connectmls-api.mredllc.com/oid/login' },
  { title: 'Compass', href: 'https://www.compass.com/app/home/' },
  { title: 'Blog', href: 'https://www.alexstoykovgroup.com/blog' },
  { title: 'Team Resources', href: 'https://www.alexstoykovgroup.com/resources' },
];
