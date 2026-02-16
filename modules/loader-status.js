const LOADER_MESSAGES = {
  general: [
    'Aligning stakeholder expectations with reality...',
    'Consulting the algorithm council...',
    'Optimizing synergy matrices...',
    'Recalibrating the innovation funnel...',
    'Cross-pollinating data silos...',
    'Leveraging AI to leverage AI...',
    'Performing a vibe check on your content...',
    'Scheduling a meeting about this meeting...',
    'Circling back on previous circles...',
    'Unpacking the deliverables...',
    'Ideating at scale...',
    'Running it up the digital flagpole...',
    'Synthesizing actionable insights...',
    'Disrupting the disruption pipeline...',
    'Putting the "art" in "artificial"...',
    'Manifesting quarterly objectives...',
    'Reticulating strategic splines...',
    'Activating thought leadership protocols...',
    'Calibrating the buzzword generator...',
    'Deploying best practices about best practices...'
  ],
  news: [
    'Teaching robots to read the news...',
    'Scanning the internet with corporate urgency...',
    'Aggregating hot takes at scale...',
    'Convincing algorithms to care about your industry...',
    'Mining the discourse for signal...',
    'Feeding headlines to a very opinionated AI...',
    'Pretending to read 400 articles simultaneously...',
    'Extracting meaning from the content industrial complex...',
    'Running competitive intelligence through the vibe filter...',
    'Asking the cloud what happened today...'
  ],
  content: [
    'Teaching AI to have opinions...',
    'Generating thought leadership from actual thoughts...',
    'Converting caffeine into content strategy...',
    'Hallucinating responsibly...',
    'Crafting artisanal bytes...',
    'Giving the algorithm your brand voice...',
    'Making content that content would be proud of...',
    'Putting the "create" in "content creator"...',
    'Reverse-engineering virality...',
    'Applying narrative frameworks to your narrative...'
  ],
  plans: [
    'Strategizing about strategy...',
    'Building a plan for the plan...',
    'Diversifying your content portfolio...',
    'Running Monte Carlo simulations on your tweets...',
    'Optimizing the content-to-meeting ratio...',
    'Assigning KPIs to your KPIs...',
    'Mapping the customer journey of the customer journey...',
    'Conducting a SWOT analysis of this SWOT analysis...',
    'Forecasting engagement with alarming confidence...',
    'Aligning content pillars with the cosmos...'
  ],
  report: [
    'Compiling findings into findings...',
    'Cross-referencing everything with everything...',
    'Generating insights about insights...',
    'Building a narrative from the narrative...',
    'Structuring unstructured thoughts structurally...',
    'Applying rigor to the rigor...',
    'Formatting wisdom into bullet points...',
    'Condensing complexity into digestible complexity...',
    'Running the numbers through more numbers...',
    'Making sense of the sense-making...'
  ],
  pipeline: [
    'Syncing your pipeline with the universe...',
    'Refreshing deal flow with cosmic energy...',
    'Querying the fundraising gods...',
    'Reconciling optimism with spreadsheets...',
    'Updating the deal stage of the deal stages...',
    'Calibrating investor sentiment algorithms...',
    'Importing conviction from external sources...',
    'Mapping warm intros to lukewarm outcomes...',
    'Calculating your burn rate of patience...',
    'Synchronizing hustle with infrastructure...'
  ]
};

const _activeLoaders = new Map();
let _loaderId = 0;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMessages(context) {
  const pool = LOADER_MESSAGES[context] || LOADER_MESSAGES.general;
  return [...pool, ...LOADER_MESSAGES.general];
}

export function startLoaderStatus(parentElement, context = 'general') {
  if (!parentElement) return null;

  const id = ++_loaderId;
  const messages = getMessages(context);

  let el = parentElement.querySelector('.glossi-loader-status');
  if (!el) {
    el = document.createElement('p');
    el.className = 'glossi-loader-status';
    parentElement.appendChild(el);
  }

  el.textContent = pickRandom(messages);
  requestAnimationFrame(() => el.classList.add('visible'));

  const interval = setInterval(() => {
    el.classList.remove('visible');
    setTimeout(() => {
      el.textContent = pickRandom(messages);
      el.classList.add('visible');
    }, 300);
  }, 3500);

  _activeLoaders.set(id, { el, interval });
  return id;
}

export function stopLoaderStatus(id) {
  if (id == null) return;
  const loader = _activeLoaders.get(id);
  if (!loader) return;

  clearInterval(loader.interval);
  loader.el.classList.remove('visible');
  setTimeout(() => {
    loader.el.textContent = '';
  }, 300);
  _activeLoaders.delete(id);
}
