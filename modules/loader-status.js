const LOADER_MESSAGES = {
  tweet: [
    'Condensing your thesis into 280 characters of pure conviction...',
    'Teaching AI to ratio the competition...',
    'Crafting a tweet your future self won\'t delete...',
    'Distilling an entire strategy into one scroll-stopping post...',
    'Workshopping hot takes with the algorithm...',
    'Making sure this tweet has the right amount of unhinged confidence...',
    'Optimizing for engagement without sacrificing dignity...',
    'Running your tweet through the cringe detector...',
    'Calculating the ideal ratio of insight to provocation...',
    'Asking the timeline what it needs to hear right now...'
  ],
  linkedin: [
    'Adding the requisite amount of professional gravitas...',
    'Removing all traces of personality, then adding some back...',
    'Crafting a LinkedIn post that won\'t start with "I\'m humbled"...',
    'Balancing thought leadership with not getting muted...',
    'Calibrating the humble-brag-to-insight ratio...',
    'Writing something your connections might actually read...',
    'Inserting strategic line breaks for maximum engagement...',
    'Making this sound authoritative but not insufferable...',
    'Generating content worthy of the LinkedIn algorithm gods...',
    'Polishing your professional narrative with corporate-grade AI...'
  ],
  blog: [
    'Outlining a blog post that people might actually finish...',
    'Converting scattered thoughts into structured arguments...',
    'Generating 1200 words that earn their word count...',
    'Building a narrative arc from your source material...',
    'Writing the kind of blog post that gets bookmarked, not just liked...',
    'Structuring your argument so it survives the comments section...',
    'Crafting prose that search engines and humans both respect...',
    'Turning research into a blog post worth sharing...',
    'Assembling paragraphs with unreasonable attention to flow...',
    'Making sure every section pulls its weight...'
  ],
  email: [
    'Drafting an email that won\'t get archived on sight...',
    'Optimizing subject line clickability without being desperate...',
    'Writing an email blast people open on purpose...',
    'Calibrating the ask-to-value ratio for maximum open rates...',
    'Crafting copy that survives the inbox battlefield...',
    'Making sure this doesn\'t sound like every other newsletter...',
    'Threading the needle between informative and promotional...',
    'Generating an email your subscribers actually want...',
    'Writing something worth the unsubscribe risk...',
    'Structuring your message for the 8-second attention span...'
  ],
  product: [
    'Translating product features into things people care about...',
    'Writing an announcement that doesn\'t sound like a changelog...',
    'Crafting a product story with actual narrative tension...',
    'Making your feature update sound like the cultural event it is...',
    'Balancing technical accuracy with human excitement...',
    'Generating launch copy that earns attention...',
    'Turning specs into stories...',
    'Writing the announcement your product team deserves...',
    'Packaging your update in words that stick...',
    'Making this sound like progress, not just a version bump...'
  ],
  talking_points: [
    'Distilling your position into quotable soundbites...',
    'Preparing talking points that survive tough questions...',
    'Turning complexity into confident, clear messaging...',
    'Building your narrative ammunition...',
    'Generating the points you wish you\'d thought of in the meeting...',
    'Crafting arguments that hold up under scrutiny...',
    'Structuring your message for maximum persuasion...',
    'Converting data into conviction...',
    'Preparing you to sound unreasonably well-prepared...',
    'Arming you with the talking points of a seasoned comms lead...'
  ],
  investor: [
    'Translating traction into investor-grade narrative...',
    'Packaging your metrics in the language VCs actually speak...',
    'Crafting the snippet that makes partners forward your deck...',
    'Distilling your momentum into FOMO-inducing prose...',
    'Making your numbers tell a story worth a term sheet...',
    'Generating the update that keeps you top of inbox...',
    'Writing investor copy with the appropriate urgency...',
    'Turning progress into a compelling signal...',
    'Calibrating confidence without overpromising...',
    'Packaging your wins for the board update that matters...'
  ],
  news: [
    'Scanning the internet for things that matter to your market...',
    'Teaching the news algorithm what Glossi cares about...',
    'Filtering signal from the content industrial complex...',
    'Aggregating headlines with unreasonable editorial standards...',
    'Hunting for the stories your competitors haven\'t noticed yet...',
    'Refreshing your news feed with strategic intent...',
    'Mining the discourse for actionable intelligence...',
    'Separating the news from the noise...',
    'Scouring publications for your next content opportunity...',
    'Curating the stories worth your team\'s attention...'
  ],
  plans: [
    'Mapping each article to its highest-impact content plays...',
    'Generating content strategies with alarming specificity...',
    'Assigning the right format to the right story...',
    'Building content plans that actually get executed...',
    'Diversifying your content mix across channels...',
    'Matching story angles to audience segments...',
    'Calculating the optimal tweet-to-blog-post ratio...',
    'Strategizing about your strategy, strategically...',
    'Planning your content calendar with artificial conviction...',
    'Deciding which stories deserve a thread vs. a deep dive...'
  ],
  angles: [
    'Discovering the story angles hiding in your news feed...',
    'Finding the Glossi connection in every headline...',
    'Generating narrative frameworks for your content team...',
    'Identifying the angles your audience didn\'t know they needed...',
    'Mining for hot takes with institutional backing...',
    'Connecting the dots between news and your narrative...',
    'Building story angles that survive editorial review...',
    'Finding the "so what" in every article...',
    'Turning industry news into your content opportunity...',
    'Crafting angles that make the news about you...'
  ],
  refine: [
    'Adjusting your content\'s personality settings...',
    'Rewriting everything in the new voice without crying...',
    'Teaching existing content to speak a new language...',
    'Regenerating prose with updated conviction levels...',
    'Applying your tone shift across all content pieces...',
    'Refining the vibe, one piece at a time...',
    'Convincing AI to change its mind about your brand voice...',
    'Recalibrating tone across your content portfolio...',
    'Making everything sound like it was always this way...',
    'Updating the voice without losing the substance...'
  ],
  journalists: [
    'Researching journalists who actually cover your space...',
    'Building a contact list that isn\'t just "press@"...',
    'Finding the reporters who\'d care about this story...',
    'Mining bylines for relevant journalists...',
    'Discovering who covers your beat...',
    'Assembling a media list with surgical precision...',
    'Identifying the writers your pitch should reach...',
    'Searching for journalists, not just email addresses...',
    'Finding the humans behind the publications...',
    'Building your press list, one verified contact at a time...'
  ],
  meeting_notes: [
    'Extracting action items from your meeting chaos...',
    'Turning meeting notes into decisions that make sense...',
    'Parsing what was actually agreed upon vs. what was vibes...',
    'Identifying the commitments hiding in your notes...',
    'Making sense of what just happened in that meeting...',
    'Converting discussion into structured next steps...',
    'Figuring out who said they\'d do what...',
    'Translating meeting energy into actionable outcomes...',
    'Separating decisions from tangents...',
    'Analyzing your notes with more attention than anyone in the room...'
  ],
  pipeline: [
    'Syncing your pipeline with the latest deal reality...',
    'Refreshing deal stages without disturbing the vibe...',
    'Pulling the latest from your fundraising universe...',
    'Reconciling optimism with actual pipeline data...',
    'Updating your deal flow dashboard...',
    'Fetching the numbers you\'re afraid to look at...',
    'Synchronizing hustle with infrastructure...',
    'Importing the latest pipeline intelligence...',
    'Refreshing your deals without refreshing your anxiety...',
    'Loading the data that keeps the board happy...'
  ],
  share_email: [
    'Generating an outreach email worth opening...',
    'Crafting a share email that doesn\'t read like spam...',
    'Writing the email that gets a reply, not an archive...',
    'Personalizing your outreach with machine precision...',
    'Building a share email with the right tone...',
    'Drafting outreach copy for humans, not filters...',
    'Composing the email your recipient might actually read...',
    'Generating outreach with appropriate follow-up energy...',
    'Writing the email you\'d want to receive...',
    'Crafting your message with strategic empathy...'
  ],
  curation: [
    'Curating your best content into a highlight reel...',
    'Applying editorial judgment at machine speed...',
    'Selecting the pieces that tell your best story...',
    'Sorting through your content with curatorial rigor...',
    'Finding the gems in your content library...',
    'Building a curated collection worth sharing...',
    'Evaluating every piece against your highest standards...',
    'Assembling the content that represents peak you...',
    'Curating with the taste of an editor and the speed of a robot...',
    'Picking winners from your content catalog...'
  ],
  report: [
    'Compiling your knowledge base into structured analysis...',
    'Generating a report that earns its page count...',
    'Synthesizing sources into coherent intelligence...',
    'Building a report your team will actually reference...',
    'Converting raw research into executive-ready output...',
    'Structuring findings with obsessive clarity...',
    'Generating insights from your source material...',
    'Writing the report that makes the research worthwhile...',
    'Assembling analysis from your knowledge base...',
    'Turning sources into a narrative that holds together...'
  ],
  chat: [
    'Thinking about your question with artificial seriousness...',
    'Consulting your knowledge base for a thoughtful response...',
    'Formulating an answer that respects your intelligence...',
    'Processing your query through every source you\'ve added...',
    'Generating a response worth the wait...',
    'Thinking harder than most chatbots would bother...',
    'Cross-referencing your sources for an informed reply...',
    'Composing a response with appropriate nuance...',
    'Searching your knowledge base for relevant context...',
    'Preparing an answer with unreasonable thoroughness...'
  ],
  file_analysis: [
    'Reading your file with robotic enthusiasm...',
    'Extracting insights from your document...',
    'Analyzing the contents with machine-grade attention...',
    'Processing your file like it\'s the most important document ever...',
    'Parsing every word of your uploaded content...',
    'Running your file through the analysis pipeline...',
    'Digesting your document at superhuman speed...',
    'Extracting the good parts from your file...',
    'Making sense of what you just dropped in...',
    'Reading between the lines of your upload...'
  ],
  general: [
    'Working on it with artificial urgency...',
    'Processing your request with machine-grade seriousness...',
    'Doing the thing you asked, thoughtfully...',
    'Applying computational rigor to your problem...',
    'Working harder than the loading spinner suggests...',
    'Making progress behind this very reassuring animation...',
    'Executing your request with appropriate intensity...',
    'Crunching the bits in your favor...',
    'Handling this with the care it deserves...',
    'Almost certainly making progress right now...'
  ]
};

const _activeLoaders = new Map();
let _loaderId = 0;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMessages(context) {
  return LOADER_MESSAGES[context] || LOADER_MESSAGES.general;
}

export function startLoaderStatus(parentElement, context = 'general') {
  if (!parentElement) return null;

  for (const [existingId, loader] of _activeLoaders) {
    if (loader.el.parentElement === parentElement || loader.el.closest('.pr-loading-modal-content') === parentElement) {
      clearInterval(loader.interval);
      _activeLoaders.delete(existingId);
    }
  }

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
