// AP Vocabulary Glossary modal

// Inline to avoid circular import with app.js
function openModal(el) { el.hidden = false; el.querySelector('button, input')?.focus(); }
function closeModal(el) { el.hidden = true; }

const TERMS = [
  { term: 'Bit',           def: 'The smallest unit of data in computing; a single binary value of 0 or 1.',                             levels: [1] },
  { term: 'Byte',          def: 'A group of 8 bits; the standard unit used to represent a single character in many encodings.',          levels: [1] },
  { term: 'Bandwidth',     def: 'The maximum rate of data transfer across a network path, typically measured in bits per second.',       levels: [4, 6] },
  { term: 'Protocol',      def: 'An agreed-upon set of rules that define how devices communicate over a network.',                       levels: [3, 4, 5] },
  { term: 'Packet',        def: 'A unit of data transmitted over a network, containing both the payload and routing metadata.',          levels: [4] },
  { term: 'IP',            def: 'Internet Protocol — the addressing system that identifies every device on a network with a unique number.', levels: [4, 6] },
  { term: 'TCP',           def: 'Transmission Control Protocol — ensures reliable, ordered delivery of data through handshakes and retransmission.', levels: [4] },
  { term: 'UDP',           def: 'User Datagram Protocol — sends packets without guaranteed delivery; faster but less reliable than TCP.', levels: [4] },
  { term: 'HTTP',          def: 'HyperText Transfer Protocol — the protocol used by web browsers to request pages from web servers.',     levels: [5] },
  { term: 'DNS',           def: 'Domain Name System — translates human-readable domain names (like example.com) into IP addresses.',    levels: [5] },
  { term: 'Router',        def: 'A device that forwards data packets between networks, directing traffic toward its destination.',        levels: [3, 4, 6] },
  { term: 'Fault Tolerance', def: 'The ability of a system to continue operating correctly even when one or more components fail.',      levels: [6] },
  { term: 'Redundancy',    def: 'Including extra components or paths so the system keeps working if one component fails.',               levels: [6] },
  { term: 'Latency',       def: 'The time delay between a request and the corresponding response, often measured in milliseconds.',      levels: [5] },
  { term: 'Handshake',     def: 'A sequence of signals exchanged between two systems to establish a connection before data is sent.',    levels: [4] },
  { term: 'ASCII',         def: 'American Standard Code for Information Interchange — a 7-bit encoding scheme that maps characters to numbers.', levels: [3] },
  { term: 'Hexadecimal',   def: 'A base-16 number system using digits 0–9 and A–F; commonly used to represent binary data more compactly.', levels: [2] },
  { term: 'BFS',           def: 'Breadth-First Search — an algorithm that finds the shortest path between nodes in an unweighted graph.', levels: [4, 6] },
  { term: 'Routing Table', def: 'A data structure in a router that lists which path to use for forwarding packets to each destination.',  levels: [4] },
  { term: 'Abstraction',   def: 'Hiding lower-level complexity to focus on higher-level concepts; fundamental to computing and protocols.', levels: [3] },
];

export function initGlossary() {
  const btn    = document.getElementById('glossary-btn');
  const modal  = document.getElementById('glossary-modal');
  const search = document.getElementById('glossary-search');
  const list   = document.getElementById('glossary-list');

  renderTerms(list, TERMS);

  btn.addEventListener('click', () => {
    openModal(modal);
    search.value = '';
    renderTerms(list, TERMS);
    search.focus();
  });

  modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
  modal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(modal));

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    const filtered = q
      ? TERMS.filter(t => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q))
      : TERMS;
    renderTerms(list, filtered);
  });
}

function renderTerms(container, terms) {
  container.innerHTML = '';
  if (!terms.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.8rem';
    empty.textContent = 'No terms found.';
    container.appendChild(empty);
    return;
  }

  for (const t of terms) {
    const item = document.createElement('div');
    item.className = 'glossary-item';

    const term = document.createElement('div');
    term.className = 'glossary-term';
    term.textContent = t.term;

    const def = document.createElement('div');
    def.className = 'glossary-def';
    def.textContent = t.def;

    const lvl = document.createElement('div');
    lvl.className = 'glossary-level';
    lvl.textContent = `Level${t.levels.length > 1 ? 's' : ''} ${t.levels.join(', ')}`;

    item.appendChild(term);
    item.appendChild(def);
    item.appendChild(lvl);
    container.appendChild(item);
  }
}
