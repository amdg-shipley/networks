export const TOOLS = [
  {
    id: 'simulator',
    path: '/simulator/',
    title: 'Network Simulator',
    tagline: 'Build networks. Break them. Learn why they work.',
    description: 'A 6-level progression from binary wire transmission to multiplayer fault-tolerance lab. Firebase-powered real-time collaboration.',
    unit: 'Unit 3 — Networks & the Internet',
    apConcepts: ['CSN-1.A', 'CSN-1.B', 'CSN-1.C', 'CSN-1.D', 'CSN-1.E', 'DAT-1.A'],
    status: 'live',
    color: 'green',
    icon: '⬡'
  },
  {
    id: 'ascii',
    path: '/ascii/',
    title: 'Binary & Unicode Explorer',
    tagline: 'Type anything. Watch it become bits.',
    description: 'Live conversion between characters, Unicode code points, binary, hex, decimal, and UTF-8 bytes.',
    unit: 'Unit 1 — Data & Analysis',
    apConcepts: ['DAT-1.A', 'DAT-1.C'],
    status: 'live',
    color: 'blue',
    icon: '01'
  }
];

export const AP_BIG_IDEAS = [
  {
    code: 'BI-1',
    title: 'Creative Development',
    eks: [],
    tools: []
  },
  {
    code: 'BI-2',
    title: 'Data',
    eks: ['DAT-1.A', 'DAT-1.B', 'DAT-1.C'],
    tools: ['ascii', 'simulator']
  },
  {
    code: 'BI-3',
    title: 'Algorithms & Programming',
    eks: ['AAP-1.A', 'AAP-2.A', 'AAP-2.B'],
    tools: []
  },
  {
    code: 'BI-4',
    title: 'Computer Systems & Networks',
    eks: ['CSN-1.A', 'CSN-1.B', 'CSN-1.C', 'CSN-1.D', 'CSN-1.E'],
    tools: ['simulator']
  },
  {
    code: 'BI-5',
    title: 'Impact of Computing',
    eks: ['IOC-1.A', 'IOC-2.A'],
    tools: []
  }
];
