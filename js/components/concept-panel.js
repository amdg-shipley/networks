// Collapsible AP CSP concept panel + reflection prompt

const EK_DATA = {
  1: {
    eks: [
      { code: 'DAT-1.A.2', text: 'Computing devices represent data digitally — lowest-level components are bits.' },
      { code: 'DAT-1.A.3', text: 'A bit is either 0 or 1.' },
      { code: 'DAT-1.A.4', text: 'A byte is 8 bits.' },
      { code: 'DAT-1.A.6', text: 'Bits are grouped to represent abstractions including numbers and characters.' },
    ],
    reflection: 'Why does the receiver need to know where one character ends and the next begins?',
  },
  2: {
    eks: [
      { code: 'DAT-1.A.6', text: 'Bits are grouped to represent abstractions including numbers, characters, and more.' },
      { code: 'DAT-1.A.7', text: 'The same bit sequence may represent different types of data in different contexts.' },
    ],
    reflection: 'Why do programmers prefer hex over binary for debugging?',
  },
  3: {
    eks: [
      { code: 'CSN-1.B.3', text: 'A protocol is an agreed-upon set of rules specifying the behavior of a system.' },
      { code: 'CSN-1.B.4', text: 'Internet protocols are open, allowing easy connection of new devices.' },
      { code: 'DAT-1.A.5', text: 'Abstraction reduces complexity by focusing on the main idea, hiding lower-level details.' },
    ],
    reflection: 'How is agreeing on chunk size similar to agreeing on a language before a conversation?',
  },
  4: {
    eks: [
      { code: 'CSN-1.C.1', text: 'Information is passed through the Internet as data streams containing packets.' },
      { code: 'CSN-1.C.2', text: 'Packets contain data and metadata used for routing and reassembly.' },
      { code: 'CSN-1.C.3', text: 'Packets may arrive in order, out of order, or not at all.' },
      { code: 'CSN-1.C.4', text: 'IP, TCP, and UDP are common protocols used on the Internet.' },
    ],
    reflection: 'When would you choose UDP over TCP? What do you give up?',
  },
  5: {
    eks: [
      { code: 'CSN-1.B.3', text: 'A protocol is an agreed-upon set of rules specifying the behavior of a system.' },
      { code: 'CSN-1.D.1', text: 'The World Wide Web is a system of linked pages, programs, and files.' },
      { code: 'CSN-1.D.2', text: 'HTTP is a protocol used by the World Wide Web.' },
    ],
    reflection: 'DNS is sometimes called "the phone book of the Internet." What are the limits of that analogy?',
  },
  6: {
    eks: [
      { code: 'CSN-1.E.1', text: 'The Internet has been engineered to be fault tolerant.' },
      { code: 'CSN-1.E.2', text: 'Redundancy is the inclusion of extra components that can be used to mitigate failure.' },
      { code: 'CSN-1.E.3', text: 'Network redundancy means having more than one path between connected devices.' },
      { code: 'CSN-1.E.5', text: 'Fault tolerant means a system can support failures and continue to function.' },
      { code: 'CSN-1.E.7', text: 'Redundant routing increases the reliability and scalability of the Internet.' },
    ],
    reflection: 'If you were designing a network for a hospital, how would you apply the concept of fault tolerance?',
  },
};

let currentLevel = null;

export function initConceptPanel() {
  const toggle  = document.getElementById('concept-toggle');
  const body    = document.getElementById('concept-body');
  const content = document.getElementById('concept-content');
  const refBox  = document.getElementById('reflection-prompt');
  const refText = document.getElementById('reflection-text');

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    body.hidden = expanded;
  });

  // Listen for level-complete events from app.js
  document.addEventListener('netsim:level-complete', e => {
    const n = e.detail.level;
    const data = EK_DATA[n];
    if (!data) return;
    refText.textContent = data.reflection;
    refBox.hidden = false;
    // Auto-expand panel on completion
    toggle.setAttribute('aria-expanded', 'true');
    body.hidden = false;
  });

  // Listen for level-change events
  document.addEventListener('netsim:level-change', e => {
    const n = e.detail.level;
    setConceptLevel(n);
  });
}

export function setConceptLevel(n) {
  currentLevel = n;
  const content = document.getElementById('concept-content');
  const refBox  = document.getElementById('reflection-prompt');
  if (!content) return;

  content.innerHTML = '';
  refBox.hidden = true;

  const data = EK_DATA[n];
  if (!data) return;

  for (const ek of data.eks) {
    const row = document.createElement('div');
    row.className = 'concept-ek';

    const code = document.createElement('span');
    code.className = 'concept-ek-code';
    code.textContent = ek.code;

    const text = document.createElement('span');
    text.className = 'concept-ek-text';
    text.textContent = ek.text;

    row.appendChild(code);
    row.appendChild(text);
    content.appendChild(row);
  }

  // Also check if this level is already completed — show reflection if so
  try {
    const raw = localStorage.getItem('netsim_progress');
    const prog = raw ? JSON.parse(raw) : { completed: [] };
    if (prog.completed.includes(n)) {
      document.getElementById('reflection-text').textContent = data.reflection;
      refBox.hidden = false;
    }
  } catch (_) { /* ignore */ }
}
