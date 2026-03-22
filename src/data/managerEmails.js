// ═══════════════════════════════════════════════════════
//  MANAGER EMAILS — 100 scenario-driven satirical messages
//  Appears only when: player passes KPI OR uses all plays.
//  Specific scenarios take priority; general pool fills gaps.
// ═══════════════════════════════════════════════════════

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Manager profiles ──────────────────────────────────
const MGR = {
  ceo:      { name: 'Jonathan Pierce',   title: 'Chief Executive Officer',        email: 'jpierce@deadline-corp.com' },
  vp_ops:   { name: 'David Miller',     title: 'VP Operations',                  email: 'dmiller@deadline-corp.com' },
  analytics:{ name: 'Jennifer Park',    title: 'Head of Performance Analytics',  email: 'jpark@deadline-corp.com' },
  hr:       { name: 'Sandra Chen',      title: 'HR Business Partner',            email: 'schen@deadline-corp.com' },
  coo:      { name: "Kevin O'Brien",    title: 'Chief Operating Officer',        email: 'kobrien@deadline-corp.com' },
  payroll:  { name: 'Linda Marsh',      title: 'Payroll & Compliance',           email: 'payroll@deadline-corp.com' },
  brad:     { name: 'Brad Kowalski',    title: 'Team Lead, Deliverables Unit B', email: 'bkowalski@deadline-corp.com' },
  cpo:      { name: 'Vanessa Hayes',    title: 'Chief People Officer',           email: 'vhayes@deadline-corp.com' },
  system:   { name: 'DEADLINE™ System', title: 'Automated Notification Service', email: 'noreply@deadline-corp.com' },
  legal:    { name: 'Compliance Team',  title: 'Legal & Compliance',             email: 'legal@deadline-corp.com' },
};

// ── Template filler ───────────────────────────────────
const _fill = (str, G) => typeof str !== 'string' ? str : str
  .replace(/\{week\}/g,     G.week)
  .replace(/\{score\}/g,    (G.wscore || 0).toLocaleString())
  .replace(/\{target\}/g,   (G.kpi ? G.kpi() : 0).toLocaleString())
  .replace(/\{tox\}/g,      G.tox)
  .replace(/\{wb\}/g,       G.wb)
  .replace(/\{bo\}/g,       Math.max(0, -G.wb)) // legacy: {bo} shows WB deficit
  .replace(/\{year\}/g,     G.promotionYear || 1)
  .replace(/\{teammate\}/g, G.teammate ? G.teammate.charAt(0).toUpperCase() + G.teammate.slice(1) : 'the team');

// ── Helpers ───────────────────────────────────────────
function _dominant(G) {
  const wa = G.weekArchetypes || {};
  return Object.entries(wa).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// ── Scenarios ─────────────────────────────────────────
// Specific scenarios are matched first (random pick from all matches).
// Scenarios with general:true form the fallback pool.
const SCENARIOS = [

  // ══ CRUSH — pct >= 160 ═══════════════════════════════

  {
    id: 'crush_1',
    match: (p) => p >= 200,
    mgr: MGR.ceo,
    subj: 'Re: Re: Re: Flagging Your Numbers — Week {week}',
    body: "At this point I've forwarded this thread to seven people. The board has been notified. Your quarterly trajectory is being used as a benchmark against which all other employees will now be implicitly measured. I hope you understand the weight of that. No pressure.",
    ps: "Please don't share this email. I'll deny sending it.",
  },
  {
    id: 'crush_2',
    match: (p) => p >= 180,
    mgr: MGR.ceo,
    subj: 'Personal Note — Week {week}',
    body: "I almost never send these. I'm telling you now because the official channel takes three weeks to process a compliment and I believe in real-time feedback. You are, as of this moment, the second-highest performing individual in your tier. The first is on a performance plan for other reasons.",
    ps: null,
  },
  {
    id: 'crush_3',
    match: (p) => p >= 160,
    mgr: MGR.ceo,
    subj: 'Your Numbers — Week {week}',
    body: "I've been in this role for eleven years. I've seen one person so systematically efficient that we quietly restructured the KPI matrix so others wouldn't feel bad. This week is in that category. I've personally flagged you in the succession planning dashboard.",
    ps: null,
  },
  {
    id: 'crush_4',
    match: (p) => p >= 160,
    mgr: MGR.coo,
    subj: 'Outstanding Output — Week {week}',
    body: "I'll keep this brief: the revenue model for Q3 has been revised upward following your results. Forecasting has asked me who you are. I told them you're one of ours. That felt good. For me.",
    ps: null,
  },
  {
    id: 'crush_5',
    match: (p) => p >= 160,
    mgr: MGR.analytics,
    subj: 'Performance Update — Statistical Outlier Flag',
    body: "Your output for Week {week} indexed at the 99th percentile for this cohort, this quarter, and this fiscal year. I've queued an automated congratulations from the system, but I wanted to personally acknowledge that the algorithm flagged you as a statistical outlier. In the positive direction. This time.",
    ps: null,
  },

  // ══ STRONG PASS — pct >= 130 ══════════════════════════

  {
    id: 'strong_1',
    match: (p) => p >= 140 && p < 160,
    mgr: MGR.vp_ops,
    subj: 'Strong Week — Well Done',
    body: "Revenue is 40% above target. Clean execution. I'm not going to overcomplicate this — good work is good work, and I want you to know I noticed. Not in a formal-review way. In a human way. Anyway. I have nine other reports to send. See you Thursday.",
    ps: null,
  },
  {
    id: 'strong_2',
    match: (p) => p >= 130,
    mgr: MGR.vp_ops,
    subj: 'Fw: Week {week} Results — Excellent',
    body: "Forwarding for visibility. You'll notice I've removed some earlier reply chain context — that's not relevant to you and contains some language that Legal asked me to stop putting in writing. The important thing is: good week.",
    ps: null,
  },
  {
    id: 'strong_3',
    match: (p) => p >= 130,
    mgr: MGR.analytics,
    subj: 'Just a Note — Week {week}',
    body: "I rarely send notes. I usually let the data speak. But the data this week is saying things I want to personally endorse. You delivered. The numbers are verifiable. Nothing more needs to be said. So I'll stop here.",
    ps: null,
  },
  {
    id: 'strong_4',
    match: (p) => p >= 130,
    mgr: MGR.hr,
    subj: 'Re: Week {week} Results — Forwarded Internally',
    body: "Good numbers. I've circulated the output summary to the wider team as a positive example. I didn't name you — I said 'a high-performing colleague in your cluster.' If you'd prefer to be named in future, please complete form HR-4b: Acknowledgement Preference Declaration.",
    ps: null,
  },
  {
    id: 'strong_5',
    match: (p) => p >= 130,
    mgr: MGR.coo,
    subj: 'Checking In — Week {week}',
    body: "Kevin here. I was on the golf course when your results came through. I had to stop walking the back nine to look at the number twice. That's a compliment. I don't stop on the back nine for anything. Tremendous output. Let's connect for coffee — my PA will reach out.",
    ps: "My PA will not reach out. I said I'd tell her to. I forgot. Consider this the outreach.",
  },

  // ══ STANDARD PASS — pct >= 110 ════════════════════════

  {
    id: 'standard_1',
    match: (p) => p >= 110 && p < 130,
    mgr: MGR.vp_ops,
    subj: 'Week {week} — Results Noted',
    body: "Revenue is where it needs to be. I've logged the result. The system has logged the result. Everyone who needed to know has now been informed. There is nothing more to say. Have a good weekend.",
    ps: null,
  },
  {
    id: 'standard_2',
    match: (p) => p >= 110 && p < 130,
    mgr: MGR.analytics,
    subj: 'Week {week} Performance Update',
    body: "Your output has crossed the KPI threshold with a 15% buffer. I want to be transparent: 15% is fine. It is not exceptional. It is satisfactory. I say this not to diminish you, but because I believe in data-accurate feedback. You are currently performing at a level I describe internally as 'not a concern.'",
    ps: null,
  },
  {
    id: 'standard_3',
    match: (p) => p >= 110 && p < 130,
    mgr: MGR.brad,
    subj: 'Good Work This Week',
    body: "The numbers are in. You've hit the mark. I've ticked the relevant boxes. There were four boxes. All ticked. This is a functionally perfect outcome from my perspective. The boxes are ticked, the week is over, and I can close this tab.",
    ps: null,
  },
  {
    id: 'standard_4',
    match: (p) => p >= 110 && p < 130,
    mgr: MGR.system,
    subj: 'Employee Recognition — Automated Message',
    body: "Congratulations! You have been automatically selected to receive this recognition message based on your performance output this period. DEADLINE Corp values each and every employee as a key asset in our strategic vision. You are a key asset. This message was generated without human input. Have a great week!",
    ps: null,
  },
  {
    id: 'standard_5',
    match: (p) => p >= 110 && p < 130,
    mgr: MGR.cpo,
    subj: 'Checking In — Performance Notes',
    body: "Just a quick touchbase from the People team. We pulled your numbers this week and wanted to say: we see you. We value you. We're embedding that value into the next engagement survey. Please complete the survey when it arrives — your feedback helps us help you help us deliver value.",
    ps: null,
  },

  // ══ BARELY PASS — pct >= 100, < 108 ══════════════════

  {
    id: 'scrape_1',
    match: (p) => p >= 100 && p < 108,
    mgr: MGR.vp_ops,
    subj: 'Week {week} — Result on File',
    body: "You made it. Barely. I've processed the result and noted the margin — 3% above threshold is not a number I find inspiring, but it is technically a number above threshold. I will not be flagging this upward. This time. Let's aim for something less anxiety-inducing next week.",
    ps: null,
  },
  {
    id: 'scrape_2',
    match: (p) => p >= 100 && p < 108,
    mgr: MGR.analytics,
    subj: 'A Note on This Week\'s Output',
    body: "The output report came through. The KPI has been met. I would like to flag, without prejudice, that 'met' is the floor, not the ceiling. You are currently standing on the floor. I am not asking you to build a rocket. I am asking you to consider taking the stairs.",
    ps: null,
  },
  {
    id: 'scrape_3',
    match: (p) => p >= 100 && p < 108,
    mgr: MGR.brad,
    subj: 'Heads Up — Week {week}',
    body: "Numbers cleared. I do want to say, very quietly and without documentation, that I spent most of Friday checking the live dashboard. That is not a sustainable use of my Friday afternoon. Could we discuss a wider margin? Off the record.",
    ps: null,
  },
  {
    id: 'scrape_4',
    match: (p) => p >= 100 && p < 108,
    mgr: MGR.vp_ops,
    subj: 'Re: Week {week} Deliverables — RESOLVED',
    body: "I'm glad this is resolved. For a while there it looked like I was going to have to send a very different email. I had drafted it. It was three paragraphs. I've deleted it. You don't need to know what was in it. What matters is I deleted it. Have a good weekend.",
    ps: null,
  },
  {
    id: 'scrape_5',
    match: (p) => p >= 100 && p < 108,
    mgr: MGR.hr,
    subj: 'Performance Observation — Week {week}',
    body: "HR has asked me to send a note whenever performance approaches the critical threshold. It approached the critical threshold this week. The threshold was not breached. This message is, officially, a positive message. I am required to phrase it that way. Please perform with more buffer in future.",
    ps: null,
  },

  // ══ CLUTCH — last play, passing ═══════════════════════

  {
    id: 'clutch_1',
    match: (p, left) => p >= 100 && p < 130 && left === 0,
    mgr: MGR.vp_ops,
    subj: 'That Was Close — Week {week}',
    body: "I'll be honest: I had the escalation draft open in another tab. The final result came through with thirty seconds left on the dashboard refresh. I closed the tab. I'm forwarding this to the team as an example of resilience under pressure. Please don't let me need to open that tab again.",
    ps: null,
  },
  {
    id: 'clutch_2',
    match: (p, left) => p >= 100 && left === 0,
    mgr: MGR.analytics,
    subj: 'Final Play Analysis — Week {week}',
    body: "I've reviewed the play-by-play output data. The efficiency curve on your final submission was exceptional. The timing was suboptimal — ideal execution peaks between plays 1 and 2, not on the final play with 0 remaining. The outcome was correct. The process concerns me professionally.",
    ps: null,
  },
  {
    id: 'clutch_3',
    match: (p, left) => p >= 100 && left === 0,
    mgr: MGR.system,
    subj: 'Re: KPI Alert — RESOLVED',
    body: "[Automated message: The KPI Alert triggered for employee record #[REDACTED] has been marked RESOLVED. No further action is required at this time. This alert resolution will remain on file for 90 days. Thank you for using the DEADLINE™ Performance Monitoring Suite.]",
    ps: null,
  },
  {
    id: 'clutch_4',
    match: (p, left) => p >= 100 && left === 0,
    mgr: MGR.brad,
    subj: 'Noted',
    body: "Saw the result come in. You left it late. I've added 'output pacing' to your next 1:1 agenda. It's not urgent. It's not a formal concern. It's just a dot on an agenda. But the dot is there. And I see it every time I open the document. Every time.",
    ps: null,
  },

  // ══ FAIL WITH PLAYS LEFT ══════════════════════════════

  {
    id: 'fail_left_1',
    match: (p, left) => p < 100 && left > 0,
    mgr: MGR.analytics,
    subj: 'Performance Concern — Week {week}',
    body: "The data shows unused output capacity at the close of the performance window. This is the category of underperformance I find most difficult to explain to the board. Not effort. Not circumstance. Unused capacity. We need to understand why the capacity existed and went undeployed.",
    ps: null,
  },
  {
    id: 'fail_left_2',
    match: (p, left) => p < 100 && left > 0,
    mgr: MGR.brad,
    subj: 'Week {week} — A Quick Note',
    body: "I've pulled the numbers. You came up short, and there were plays left on the table. I don't want to make assumptions about what happened. But I am making some assumptions. I'd like to discuss them. I've sent you a calendar invite titled 'Alignment Check'. Please accept it.",
    ps: null,
  },
  {
    id: 'fail_left_3',
    match: (p, left) => p < 100 && left > 0,
    mgr: MGR.vp_ops,
    subj: 'Re: Week {week} Output — Follow Up Required',
    body: "I had to manually input a MISS flag into the performance tracking system this week. The system asked me to confirm twice. I confirmed. It's now in the system. There's a process to have it reviewed, but that process involves Jonathan, and I'd rather not involve Jonathan. Let's fix this.",
    ps: null,
  },
  {
    id: 'fail_left_4',
    match: (p, left) => p < 100 && left > 0,
    mgr: MGR.system,
    subj: 'Efficiency Gap Identified — Action Required',
    body: "Automated notice: a significant gap between available output capacity and realized output has been detected. Please complete form PR-7: Underutilization Explanation within 48 hours. Failure to submit PR-7 will trigger form PR-7b: Failure to Submit Form PR-7 Notice. PR-7b is longer than PR-7.",
    ps: null,
  },
  {
    id: 'fail_left_5',
    match: (p, left) => p < 100 && left > 0,
    mgr: MGR.hr,
    subj: 'Heads Up — Documentation',
    body: "I'm required to let you know that this week's result has been logged in your performance file. I'm not required to send this email. I'm sending it anyway because I believe in transparency, and also because I want you to know that the log exists, that it's timestamped, and that I know how to find it.",
    ps: null,
  },

  // ══ FAIL NO PLAYS LEFT ════════════════════════════════

  {
    id: 'fail_noplays_1',
    match: (p, left) => p < 100 && left === 0,
    mgr: MGR.vp_ops,
    subj: 'Week {week} — On the Record',
    body: "You gave everything you had. The output still wasn't enough. I want to be clear that 'gave everything you had' is a data point, not an absolution. We need to discuss what 'everything' looks like and whether it's calibrated correctly.",
    ps: null,
  },
  {
    id: 'fail_noplays_2',
    match: (p, left) => p < 100 && left === 0,
    mgr: MGR.analytics,
    subj: 'Maximum Output, Insufficient Return',
    body: "I've run the post-mortem numbers. Full capacity was deployed. Revenue target was not reached. This is the harder category of miss — there's no obvious efficiency lever to pull. The problem is structural. I've started a document. I haven't finished it. I'll send it when I finish it.",
    ps: null,
  },
  {
    id: 'fail_noplays_3',
    match: (p, left) => p < 100 && left === 0,
    mgr: MGR.vp_ops,
    subj: 'Week {week} Results — Personal Note',
    body: "I thought about calling. I didn't call. I sent this email instead, which is safer for both of us. The week didn't land where it needed to. I've absorbed the disappointment. Now I need you to build something different for next week.",
    ps: null,
  },
  {
    id: 'fail_noplays_4',
    match: (p, left) => p < 100 && left === 0,
    mgr: MGR.system,
    subj: 'Re: KPI Threshold — Unmet',
    body: "[Automated notification. Employee performance record updated: KPI Target Status = UNMET. This notification has been copied to: Direct Manager, HR System, Compliance Tracker, Anonymous Aggregate Dashboard, The Board (summary only). You have received this notification because you triggered it.]",
    ps: null,
  },
  {
    id: 'fail_noplays_5',
    match: (p, left) => p < 100 && left === 0,
    mgr: MGR.cpo,
    subj: 'Just Checking In! 😊',
    body: "Hi there! The People team noticed your results this week, and we just want to say: this is a safe space. Performance is a journey, not a destination. We've enrolled you in three optional workshops — 'Resilience as a Strategic Asset', 'Owning Your Output', and 'The Neuroscience of Hitting Targets'. Attendance is technically optional. Technically.",
    ps: null,
  },
  {
    id: 'fail_noplays_6',
    match: (p, left) => p < 100 && left === 0,
    mgr: MGR.coo,
    subj: 'Friendly Reminder — Week {week} Review',
    body: "Kevin here. I want to give it to you straight: that was a rough round. We've all been there. The back nine of Q3 is brutal. What matters is what you do on the next tee. I've booked you for a 'recovery sprint' session on Tuesday. I'm not sure what that is but HR asked me to do it.",
    ps: null,
  },

  // ══ HIGH TOX — passing ════════════════════════════════

  {
    id: 'tox_pass_1',
    match: (p, l, G) => p >= 100 && G.tox > 80,
    mgr: MGR.vp_ops,
    subj: 'Flagging Something — Week {week}',
    body: "The numbers are strong. That's noted. There's something else I want to flag — HR has been in touch with me three times this week. The word they used was 'ambient'. I don't fully understand it in this context. Could we find time to talk?",
    ps: null,
  },
  {
    id: 'tox_pass_2',
    match: (p, l, G) => p >= 100 && G.tox > 70,
    mgr: MGR.hr,
    subj: 'Good Numbers — One Other Thing',
    body: "Excellent output this week. Two people filed a wellness check request on your behalf today. They meant well. HR is now involved, which is a sentence that should always be taken seriously. Your results are good. Everything else is a separate conversation.",
    ps: 'P.S. A wellness check-in has been added to your calendar. Attendance is expected.',
  },
  {
    id: 'tox_pass_3',
    match: (p, l, G) => p >= 100 && G.tox > 60,
    mgr: MGR.analytics,
    subj: 'Performance Note + Culture Note — Week {week}',
    body: "Two parts to this. Part one: numbers are fine. Part two: the culture indicators around your output method are showing some yellows on my dashboard. I'm not making accusations. I'm noting yellows. Yellows are not reds. But the relationship between yellows and reds is one I'd prefer to disrupt proactively.",
    ps: null,
  },
  {
    id: 'tox_pass_4',
    match: (p, l, G) => p >= 100 && G.tox > 60,
    mgr: MGR.cpo,
    subj: 'Wellbeing Check — Confidential',
    body: "This is an automated wellbeing check triggered by your toxicity indicators this period. You may be experiencing high stress or what we call 'Cultural Misalignment Syndrome.' Resources available to you include: our EAP hotline (hold time: 45 mins), a PDF on mindfulness, and a dog that visits the office on Fridays. His name is Biscuit.",
    ps: "Biscuit is only available on Fridays. He is not on the EAP. Please don't call the EAP asking about Biscuit.",
  },

  // ══ HIGH TOX — failing ════════════════════════════════

  {
    id: 'tox_fail_1',
    match: (p, l, G) => p < 100 && G.tox > 70,
    mgr: MGR.hr,
    subj: 'Multiple Concerns — Week {week}',
    body: "I'm writing to address two separate items which have unfortunately converged this week: the performance result and the behavioral indicators. Individually, either would prompt a note. Together, they prompt a meeting. I've sent an invite. It says 'Coffee Chat.' It is not a coffee chat.",
    ps: null,
  },
  {
    id: 'tox_fail_2',
    match: (p, l, G) => p < 100 && G.tox > 80,
    mgr: MGR.legal,
    subj: 'Documentation Notice — For Your Records',
    body: "This is to inform you that certain behavioral and performance data from the current period has been logged for compliance purposes. You are not under investigation. The log simply exists. It will continue to exist. You may request access to it via form COM-9. Form COM-9 is available on the intranet. The intranet is currently down.",
    ps: null,
  },

  // ══ HIGH BURNOUT ══════════════════════════════════════

  {
    id: 'burnout_1',
    match: (p, l, G) => G.wb < -25 && p >= 100,
    mgr: MGR.hr,
    subj: 'Burnout Threshold Alert — Action Required',
    body: "Our monitoring system has flagged your burnout metrics this period. You are hitting targets, and I want to add that hitting targets while your burnout index exceeds 75% is a liability for the company. Please reduce your burnout. We've attached a PDF.",
    ps: "The PDF is 34 pages. We're aware of the irony.",
  },
  {
    id: 'burnout_2',
    match: (p, l, G) => G.wb < 0,
    mgr: MGR.system,
    subj: 'Automated Wellness Notification — Week {week}',
    body: "[Burnout Level: ELEVATED. Recommended Actions: (1) Speak to a trusted colleague. (2) Review the Mindfulness at Work module on the LMS. (3) Take a 10-minute walk. (4) Submit the Burnout Self-Assessment form within 72 hours. (5) Continue performing. Thank you.]",
    ps: null,
  },

  // ══ LOW WELLBEING — passing ═══════════════════════════

  {
    id: 'lowwb_1',
    match: (p, l, G) => p >= 100 && G.wb < 30,
    mgr: MGR.vp_ops,
    subj: 'Strong Output — A Personal Note',
    body: "The numbers are where they need to be. I also want to note — and I say this as someone who has seen a lot of people in high-pressure roles — that you look, statistically, terrible. Not in a judgment way. In a 'the system is flagging your wellbeing metrics as critical' way. Please take the weekend.",
    ps: null,
  },
  {
    id: 'lowwb_2',
    match: (p, l, G) => p >= 100 && G.wb < 25,
    mgr: MGR.hr,
    subj: 'Performance Acknowledged — Welfare Check Attached',
    body: "Congratulations on your output this week. Your Wellbeing score has triggered a mandatory welfare check, which I'm combining with this congratulations email for efficiency. Please reply to confirm you are functional. This is not optional. The reply goes to HR. They are waiting.",
    ps: null,
  },

  // ══ WEEK 1 ════════════════════════════════════════════

  {
    id: 'week1_pass_1',
    match: (p, l, G) => G.week === 1 && p >= 100,
    mgr: MGR.vp_ops,
    subj: 'First Week — Initial Assessment',
    body: "First results are in. You've cleared the baseline. I want to be transparent: I use week 1 results as a calibration point, not a prediction. They tell me very little. What I know is that the target was met. Everything else remains to be established. Welcome.",
    ps: null,
  },
  {
    id: 'week1_pass_2',
    match: (p, l, G) => G.week === 1 && p >= 110,
    mgr: MGR.ceo,
    subj: 'Welcome to DEADLINE Corp — Week 1 Results',
    body: "First week on record. The fact that you delivered on week 1, before you fully understood the systems, the culture, or the unwritten rules of the performance review system, is genuinely notable. Most people need week 2 to get their footing. You didn't. I'm watching.",
    ps: null,
  },
  {
    id: 'week1_pass_3',
    match: (p, l, G) => G.week === 1 && p >= 100,
    mgr: MGR.hr,
    subj: 'Re: Onboarding + Week 1 Feedback',
    body: "Following up on your first-week output from an HR perspective. You've hit your targets and completed your compliance modules. You have not yet completed your 'Getting to Know Your Colleagues' worksheet. That's due Friday. The two things are unrelated. But both are on my list.",
    ps: null,
  },
  {
    id: 'week1_fail_1',
    match: (p, l, G) => G.week === 1 && p < 100,
    mgr: MGR.vp_ops,
    subj: 'Week 1 — Let\'s Regroup',
    body: "I want to approach this carefully because it's week 1 and I'm mindful of the transition period. That said, the numbers are the numbers, and the numbers are not good. I don't want to project — maybe this is an anomaly. I do want to flag that week 1 anomalies tend to become week 2 patterns. Let's talk before Monday.",
    ps: null,
  },
  {
    id: 'week1_fail_2',
    match: (p, l, G) => G.week === 1 && p < 100,
    mgr: MGR.cpo,
    subj: 'Onboarding Review — Adjustment Required',
    body: "We've reviewed your first-week output and want to make sure you have everything you need to succeed. We've pre-enrolled you in: 'Output Fundamentals (Refresh)', 'KPI Literacy Workshop', and 'Week 1: What to Do Differently'. The last one is a module I created specifically for this situation. You're the first person to receive it.",
    ps: null,
  },

  // ══ WEEK 10 ═══════════════════════════════════════════

  {
    id: 'week10_pass_1',
    match: (p, l, G) => G.week === 10 && p >= 100,
    mgr: MGR.ceo,
    subj: 'Annual Review — Preliminary Notes',
    body: "Week 10 is on record. You've made it through the full cycle. The word I used in my board summary was 'solid'. That is not faint praise from me — I reserve 'exceptional' for people whose results I also find personally inconvenient. 'Solid' means: I am not concerned. That means something.",
    ps: null,
  },
  {
    id: 'week10_pass_2',
    match: (p, l, G) => G.week === 10 && p >= 100,
    mgr: MGR.vp_ops,
    subj: 'Year End — Results Logged',
    body: "Ten weeks. You made it. The cumulative output data has been submitted to payroll, HR, and three committees I'm not allowed to name. Whatever comes next, know that the record exists, it's complete, and it reflects the year you had.",
    ps: null,
  },
  {
    id: 'week10_pass_3',
    match: (p, l, G) => G.week === 10 && p >= 130,
    mgr: MGR.ceo,
    subj: 'Year-End Performance — Exceptional Result',
    body: "I'll skip the formalities. That was a strong year. The data is unambiguous. I've noted it, the board has noted it, and the succession planning algorithm has noted it — the last one is the one that matters most, but I'll pretend otherwise for the purposes of this email.",
    ps: null,
  },
  {
    id: 'week10_fail_1',
    match: (p, l, G) => G.week === 10 && p < 100,
    mgr: MGR.ceo,
    subj: 'Annual Review — Final Period',
    body: "The final period did not land where we needed it to. I want to be direct in a way I couldn't be during the year: I expected more. The record reflects what was delivered, not what was possible. That gap will be the subject of the annual review meeting, which HR will schedule.",
    ps: null,
  },
  {
    id: 'week10_fail_2',
    match: (p, l, G) => G.week === 10 && p < 100,
    mgr: MGR.analytics,
    subj: 'End of Cycle — On the Record',
    body: "Year-end metrics have been processed. The final week result has been logged. Combined with the cumulative record, the picture is... complex. I've used the word 'complex' with the board. That's a word I use when I need time to think of a better word. I haven't found one yet.",
    ps: null,
  },

  // ══ LATE GAME ═════════════════════════════════════════

  {
    id: 'late_1',
    match: (p, l, G) => G.week >= 8 && p >= 100,
    mgr: MGR.analytics,
    subj: 'Q4 Projections — Week {week}',
    body: "You're in the final stretch of the performance cycle. The cumulative data is favorable. I want to be precise: favorable does not mean guaranteed. The last two weeks carry disproportionate weight in the annual model. I've recalculated the scenarios. There are 14 of them. Four are good.",
    ps: null,
  },
  {
    id: 'late_2',
    match: (p, l, G) => G.week >= 7 && p >= 100,
    mgr: MGR.ceo,
    subj: 'Week {week} — The Board Is Watching',
    body: "I don't usually get involved in individual week-level communications at this stage of the cycle. I'm involved now. The board reviews cumulative performance starting at week 7. They've seen yours. I've been asked to relay that they are 'watching with interest.' That is the phrase they used. Verbatim.",
    ps: null,
  },
  {
    id: 'late_3',
    match: (p, l, G) => G.week >= 8 && p < 100,
    mgr: MGR.vp_ops,
    subj: 'Week {week} — Critical Period',
    body: "I'm not going to dress this up: we're in the final weeks of the performance cycle, the numbers aren't where they need to be, and the board annual review is coming. I've been asked to 'provide context' in the summary. I'm running low on context. Please give me something to work with.",
    ps: null,
  },

  // ══ TEAMMATE SPECIFIC ═════════════════════════════════

  {
    id: 'gary_1',
    match: (p, l, G) => G.teammate === 'gary',
    mgr: MGR.vp_ops,
    subj: 'Re: Gary — Status Check',
    body: "I saw Gary was on your team this week. I want to acknowledge that and say: I know. I know. The committee that assigns teammates is not under my control. I've raised it. It's being reviewed. In the interim, I'll be factoring the context into my interpretation of your numbers. You have my sympathies.",
    ps: null,
  },
  {
    id: 'gary_2',
    match: (p, l, G) => G.teammate === 'gary' && p >= 100,
    mgr: MGR.analytics,
    subj: 'Week {week} — Remarkable, Given the Circumstances',
    body: "I've reviewed the output data and the teammate assignment. I don't know how you delivered these numbers with Gary in the loop. I have a theory, but I haven't confirmed it, and I'm not going to put it in writing. What I will say is: this result, in context, is one of the most impressive things I've seen this quarter.",
    ps: null,
  },
  {
    id: 'alex_1',
    match: (p, l, G) => G.teammate === 'alex' && p >= 100,
    mgr: MGR.vp_ops,
    subj: 'FYI — Alex\'s All-Team Email',
    body: "You may have already seen Alex's company-wide message this morning titled 'How I Helped Deliver Week {week} Results.' I've spoken to HR about it. The email has been archived. For your awareness: your contribution is on record in the actual performance system, which Alex does not have edit access to. That's intentional.",
    ps: null,
  },
  {
    id: 'alex_2',
    match: (p, l, G) => G.teammate === 'alex' && p < 100,
    mgr: MGR.hr,
    subj: 'HR Update — Alex Situation',
    body: "HR reached out following Alex's 'constructive feedback session' about your team this week. The feedback Alex provided to the department head was detailed, extensively cited, and arrived before your output report did. I'm not saying the two things are connected. I'm saying the timeline is notable.",
    ps: null,
  },
  {
    id: 'alex_3',
    match: (p, l, G) => G.teammate === 'alex',
    mgr: MGR.brad,
    subj: 'Alex — A Heads Up',
    body: "I need you to know that Alex has added you as co-presenter to three upcoming All-Hands slides titled 'Strategic Gaps in Our Team Output.' He did this without asking. The slides contain your performance data. I've asked him to remove them. He sent me a counter-proposal. We are negotiating.",
    ps: null,
  },
  {
    id: 'sarah_1',
    match: (p, l, G) => G.teammate === 'sarah',
    mgr: MGR.hr,
    subj: 'Has Anyone Seen Sarah?',
    body: "This is a routine check-in. Sarah's badge has been scanned at the building entrance twice this week but her desk camera has shown her chair empty. Facilities found a half-finished cup of tea on her keyboard from — according to the timestamp — last Tuesday. If you have information, please reply directly to me, not to Sarah's email.",
    ps: null,
  },
  {
    id: 'sarah_2',
    match: (p, l, G) => G.teammate === 'sarah' && p >= 100,
    mgr: MGR.vp_ops,
    subj: 'Week {week} — Output Noted',
    body: "Numbers came in. They're fine. I want to note that Sarah submitted a 'contribution statement' on your behalf — a form I didn't know existed until today — in which she claims partial credit for your output via 'invisible strategic support.' I've forwarded it to Legal. For your awareness.",
    ps: null,
  },
  {
    id: 'ben_1',
    match: (p, l, G) => G.teammate === 'ben',
    mgr: MGR.brad,
    subj: 'Ben\'s Email to the Board — For Your Awareness',
    body: "Ben sent a personal email to Jonathan Pierce this morning describing your week {week} performance as 'the kind of results that define a generation.' I want to be clear that this is Ben's characterization, not mine. It is also now on record, because Ben CC'd the entire distribution list. I hope your results reflect it.",
    ps: null,
  },
  {
    id: 'ben_2',
    match: (p, l, G) => G.teammate === 'ben' && p >= 100,
    mgr: MGR.vp_ops,
    subj: 'Good Week — Also a Note About Ben',
    body: "Strong output. Also: Ben has already told six people you exceeded target before I'd confirmed the numbers myself. Two of those people are now asking me about your promotion readiness. One of them is Jonathan. I was not prepared for this. I don't think you were either. We should talk.",
    ps: null,
  },
  {
    id: 'ben_3',
    match: (p, l, G) => G.teammate === 'ben' && p < 100,
    mgr: MGR.brad,
    subj: 'This Is Awkward — Week {week}',
    body: "Ben told Jonathan Pierce on Monday that you were 'going to absolutely destroy the KPI this week.' He said it in a meeting I was in. Jonathan wrote it down. I watched him write it down. The numbers have come in. I need you to understand the position that puts me in. We need a plan for Monday morning.",
    ps: null,
  },
  {
    id: 'derek_tm_1',
    match: (p, l, G) => G.teammate === 'derek',
    mgr: MGR.brad,
    subj: 'Derek\'s Assessment — For Your Records',
    body: "Derek has submitted a 47-page performance commentary on your week {week} output. I've skimmed it. Page 1 says you did well. Pages 2 through 47 are about the process. I've attached the executive summary, which Derek prepared himself and which is 14 pages long. I haven't read it. I don't think you need to.",
    ps: null,
  },
  {
    id: 'derek_tm_2',
    match: (p, l, G) => G.teammate === 'derek',
    mgr: MGR.vp_ops,
    subj: 'From Derek — Re: Your Week',
    body: "I've reviewed your output three times. I've also reviewed the process by which you generated the output, the sequence of decisions, and the decision-making methodology. I have notes. The notes are extensive. I've sent a copy to your file, my file, Jennifer's file, and HR. We will discuss.",
    ps: "— Forwarded by David Miller. Original sender: Derek Fielding, Performance Delivery Director. Do not reply directly to Derek.",
  },
  {
    id: 'priya_1',
    match: (p, l, G) => G.teammate === 'priya',
    mgr: MGR.analytics,
    subj: 'Priya\'s Analysis — For Your Information',
    body: "Priya has sent me a 94-slide deck analyzing your week {week} output. Slides 1–12 establish the statistical framework. Slides 13–67 are the analysis. Slides 68–94 are 'confidence intervals and sensitivity scenarios.' I've read slide 1. It is technically a table of contents. I'll read the rest eventually.",
    ps: null,
  },
  {
    id: 'priya_2',
    match: (p, l, G) => G.teammate === 'priya' && p >= 100,
    mgr: MGR.analytics,
    subj: 'Data Note — Week {week}',
    body: "Priya modeled 312 scenarios for your output this week. You executed one of them. According to her post-mortem, you chose the 7th most efficient path. She has sent you a PDF of the top 6 alternatives. She says she is 'not being critical, just comprehensive.' I believe her. Priya is never critical. She just has very good data.",
    ps: null,
  },

  // ══ CONSECUTIVE FAILS ════════════════════════════════

  {
    id: 'consec_1',
    match: (p, l, G) => G.consecutiveFails >= 2 && p < 100,
    mgr: MGR.vp_ops,
    subj: 'Pattern Recognition — Week {week}',
    body: "I'm going to be direct: this is the second consecutive miss. The system has flagged it. I'm flagging it. HR has been notified. There is a process. The process is now active. I want you to understand what that means before you hear it from someone with a clipboard.",
    ps: null,
  },
  {
    id: 'consec_2',
    match: (p, l, G) => G.consecutiveFails >= 2 && p < 100,
    mgr: MGR.hr,
    subj: 'Performance Improvement — Formal Notice',
    body: "Following two consecutive below-target periods, HR is initiating a structured support engagement. 'Structured support engagement' is the phrase we use in formal communications. What it means is: there are meetings. The meetings have outcomes. The outcomes are documented. I'm sending this email so you understand the context before the meetings begin.",
    ps: null,
  },
  {
    id: 'consec_3',
    match: (p, l, G) => G.consecutiveFails >= 3 && p < 100,
    mgr: MGR.vp_ops,
    subj: 'Urgent — Personal Follow-Up Required',
    body: "Three in a row. I need to be honest: I've been asked to initiate formal proceedings and I've been pushing back because I believe people can change trajectory. I'm still pushing back. But my leverage here is finite. I need a different week from you. I'm not asking. I'm telling. Respectfully. Please.",
    ps: null,
  },

  // ══ RECOVERY FROM FAILS ═══════════════════════════════

  {
    id: 'recovery_1',
    match: (p, l, G) => G.consecutiveFails === 0 && G.failedWeeks >= 1 && p >= 100,
    mgr: MGR.vp_ops,
    subj: 'Week {week} — A Different Story',
    body: "That's more like it. I don't want to be dramatic about it, but that was the week I was waiting for. The system has registered the pass and automatically flagged it as a 'trend correction.' I've closed two tabs I had open for emergency purposes. They've been open for a while. It's good to close them.",
    ps: null,
  },
  {
    id: 'recovery_2',
    match: (p, l, G) => G.consecutiveFails === 0 && G.failedWeeks >= 1 && p >= 100,
    mgr: MGR.analytics,
    subj: 'You Found Your Footing — Week {week}',
    body: "Good week. Genuinely. I want to say that in a way that carries the full weight of the context: I wasn't sure we'd see this. I'm glad we did. I've updated the risk register. You've moved from 'Active Concern' to 'Monitored.' That's meaningful progress. I'll close the file when you hit three consecutive passes.",
    ps: null,
  },

  // ══ COINS ════════════════════════════════════════════

  {
    id: 'coins_high',
    match: (p, l, G) => G.coins > 25,
    mgr: MGR.payroll,
    subj: 'Finance Department — CC Reconciliation',
    body: "Hello. Your Corpo Coin balance is flagged for review. Significant unspent allocations at the end of the performance cycle trigger an audit process. The audit is not punitive. It is informational. Please be prepared to explain your spending decisions. The form is attached. There are 14 sections.",
    ps: null,
  },
  {
    id: 'coins_zero',
    match: (p, l, G) => G.coins === 0,
    mgr: MGR.payroll,
    subj: 'CC Balance Alert — Week {week}',
    body: "Your Corpo Coin balance has reached zero. I'm not sure how this happened — I've run the reconciliation twice. I want to be clear that a zero balance is not a violation. It is, however, extremely unusual. I've attached a budget planning worksheet. I made it myself. The formatting is intentional.",
    ps: null,
  },

  // ══ BREAKTHROUGH / PERM MULT ══════════════════════════

  {
    id: 'breakthrough_1',
    match: (p, l, G) => p >= 200 && (G.permMult || 0) >= 0.5,
    mgr: MGR.ceo,
    subj: 'What Just Happened — Week {week}',
    body: "I have been doing this job for a long time. I have processed a lot of output reports. What just happened is not a thing I have a precedent for. I've contacted the analytics team. They've verified the numbers. They've verified them again. They're telling me the formula is correct. I'm going to need a moment.",
    ps: null,
  },
  {
    id: 'breakthrough_2',
    match: (p, l, G) => (G.permMult || 0) >= 0.5 && p >= 150,
    mgr: MGR.analytics,
    subj: 'Trajectory Update — Flagged Internally',
    body: "Your cumulative performance multiplier has reached a level that triggered an internal alert. I've investigated. The investigation conclusion is: you are performing very well. The board has asked me to put you in a separate tracking category. I've done that. The category doesn't have a name yet.",
    ps: null,
  },

  // ══ HIGH WELLBEING ════════════════════════════════════

  {
    id: 'wellness_high',
    match: (p, l, G) => G.wb >= 80 && p >= 100,
    mgr: MGR.cpo,
    subj: 'Wellbeing Metrics — Positive Flag',
    body: "This is unusual enough that I'm sending a personal note: your wellbeing indicators and performance indicators are both tracking positively in the same period. The analytics team says this happens about 12% of the time. I hope it continues. I'm not expecting it to continue.",
    ps: null,
  },

  // ══ PROMOTION RUN ════════════════════════════════════

  {
    id: 'promo_pass',
    match: (p, l, G) => G.promotionRun && p >= 100,
    mgr: MGR.ceo,
    subj: 'Year {year} — Results Noted',
    body: "Year {year} in the system. The KPI matrix has been adjusted accordingly. The fact that you've met the adjusted target is not being treated as a simple continuation — it's being treated as confirmation of trajectory. The board is tracking. I don't say that to add pressure. I say it because it's true.",
    ps: null,
  },
  {
    id: 'promo_fail',
    match: (p, l, G) => G.promotionRun && p < 100,
    mgr: MGR.vp_ops,
    subj: 'Year {year} — Recalibration',
    body: "I want to be honest: the Year {year} standards are harder. I know that. You know that. What I can tell you is that the system doesn't soften expectations based on context — it only reads results. So the result is what it is. I'm adding context in my personal notes. Whether that matters depends on who reads them.",
    ps: null,
  },

  // ══ CRUNCH HEAVY ══════════════════════════════════════

  {
    id: 'crunch_1',
    match: (p, l, G) => p >= 108 && _dominant(G) === 'CRUNCH',
    mgr: MGR.vp_ops,
    subj: 'Week {week} — Good Work',
    body: "The overnight push shows in the data. I appreciate the commitment. Output is where it needs to be. That said, I want to make sure the pace is sustainable — we need you functional next week too.",
    ps: null,
  },
  {
    id: 'crunch_2',
    match: (p, l, G) => _dominant(G) === 'CRUNCH',
    mgr: MGR.hr,
    subj: 'Work Pattern Alert — Week {week}',
    body: "Our output pattern analysis has flagged a crunch-heavy delivery method this period. I want to reassure you that this is not punitive. But I also want to let you know that the flag exists, that it's in the quarterly wellness report, and that Vanessa has seen it. She's going to want to talk.",
    ps: null,
  },

  // ══ STRATEGY HEAVY ════════════════════════════════════

  {
    id: 'strategy_1',
    match: (p, l, G) => p >= 108 && _dominant(G) === 'STRATEGY',
    mgr: MGR.analytics,
    subj: 'Strategic Output — Week {week} Review',
    body: "The strategic play density this week was notable. I've run the archetype breakdown — STRATEGY cards drove a disproportionate share of your efficiency multiplier. The pattern is clean, it's consistent, and it's data I'm going to use in my quarterly methodology presentation. I hope you don't mind. I won't credit you. Attribution is complex.",
    ps: null,
  },

  // ══ RECOVERY HEAVY ════════════════════════════════════

  {
    id: 'recovery_arch',
    match: (p, l, G) => p >= 108 && _dominant(G) === 'RECOVERY',
    mgr: MGR.cpo,
    subj: 'Week {week} Review',
    body: "Output metrics are strong and the team cohesion indicators tracked well this week. The balanced approach is showing up in the numbers. This is the kind of sustainable performance model the organization should be replicating.",
    ps: null,
  },

  // ══════════════════════════════════════════════════════
  // GENERAL POOL — fallback when no specific match found
  // ══════════════════════════════════════════════════════

  {
    id: 'gen_1', general: true,
    match: () => true,
    mgr: MGR.brad,
    subj: 'Touching Base — Week {week}',
    body: "Just a quick note from my end. The numbers are in, whatever they are. I've reviewed them. My review is complete. There's nothing more I can add at this stage that wouldn't be better addressed in a one-to-one format. I've added a placeholder to the agenda for next week. It's not labeled. You'll know it when we get to it.",
    ps: null,
  },
  {
    id: 'gen_2', general: true,
    match: () => true,
    mgr: MGR.ceo,
    subj: 'Alignment Check — Week {week}',
    body: "I've been giving some thought to the concept of alignment lately — specifically, whether individual output metrics are aligned with our broader organizational direction. I wanted to share that thought. I don't have a follow-up question. I just wanted to surface the thinking. Please don't action this. It's not actionable.",
    ps: null,
  },
  {
    id: 'gen_3', general: true,
    match: () => true,
    mgr: MGR.vp_ops,
    subj: 'Quick Note — No Action Required',
    body: "This email requires no action. I just want you to know I'm aware of your results this week. I always read the weekly digests. I read all of them. I've read yours. I'm not going to say more than that because this email requires no action. The subject line was accurate. You've been notified.",
    ps: null,
  },
  {
    id: 'gen_4', general: true,
    match: () => true,
    mgr: MGR.system,
    subj: 'Your Satisfaction Survey Is Overdue',
    body: "[Automated Reminder #4] This is your fourth reminder to complete the Employee Satisfaction Survey. The survey takes 8 minutes. It contains 47 questions. Previous surveys have resulted in: one office plant, two 'listening sessions', and a revised email signature policy. Your feedback matters. The survey closes Friday. It has been closing on Friday for six weeks.",
    ps: null,
  },
  {
    id: 'gen_5', general: true,
    match: () => true,
    mgr: MGR.hr,
    subj: 'Mandatory Training — Reminder',
    body: "You have 3 incomplete modules on the Learning Management System: 'Data Privacy in a High-Output Environment' (14 mins), 'Unconscious Bias in Deliverable Submission' (22 mins), and 'Understanding Your KPI: A Journey' (47 mins). The last one was added this week. I didn't commission it. I don't know who did. Please complete it anyway.",
    ps: null,
  },
  {
    id: 'gen_6', general: true,
    match: () => true,
    mgr: MGR.brad,
    subj: 'Quick Process Note',
    body: "I've updated the deliverable submission protocol. The changes are minor — a few new mandatory fields in the tracking form, a revised approval chain (now 7 steps instead of 4), and a new 'output contextualization narrative' section that replaces the old notes field. I've sent the updated form. The old form still works. But it shouldn't.",
    ps: null,
  },
  {
    id: 'gen_7', general: true,
    match: () => true,
    mgr: MGR.ceo,
    subj: 'The Values Refresh — A Note From Jonathan',
    body: "As you may be aware, we've updated our company values this quarter. The five new values are: Excellence, Impact, Integrity, Momentum, and Synergetic Customer-Centricity. The last one was the subject of significant internal debate. It won. Please review the attached values deck. There will be a quiz. The quiz affects nothing but I want to know who does it.",
    ps: null,
  },
  {
    id: 'gen_8', general: true,
    match: () => true,
    mgr: MGR.system,
    subj: 'IT Notice — Scheduled Maintenance',
    body: "Your workstation reboot has been scheduled for Tuesday 9:00am. This will interrupt your workflow for approximately 4 minutes. To minimize disruption, please save all open documents before 8:59am. A confirmation ping will be sent at 8:55am, 8:57am, and 8:59am. You will still lose your work. We're sorry.",
    ps: null,
  },
  {
    id: 'gen_9', general: true,
    match: () => true,
    mgr: MGR.hr,
    subj: 'Desk Relocation — Action Required',
    body: "As part of the Q4 space optimization initiative, your desk has been reassigned. Your new location is Bay 7, Cluster C, Sub-zone 4 (formerly the storage annex adjacent to the printer that hasn't worked since 2021). Your current desk will be reallocated to a 'collaboration pod.' The collaboration pod will be empty most of the time. This is intentional.",
    ps: null,
  },
  {
    id: 'gen_10', general: true,
    match: () => true,
    mgr: MGR.legal,
    subj: 'Updated NDA — Please Sign',
    body: "Legal has issued a revised NDA covering: output data, performance metrics, KPI targets, weekly results, inter-team communications, corridor conversations, and 'any impressions formed during the normal course of employment.' You can review the document at the secure portal. The portal is currently down. We will notify you when it's back up. Please sign it promptly.",
    ps: null,
  },
  {
    id: 'gen_11', general: true,
    match: () => true,
    mgr: MGR.system,
    subj: 'Quarterly Engagement Survey — Week {week}',
    body: "The engagement survey is live. We've reduced it from 73 questions to 62 following last quarter's feedback that it was 'too long.' The 11 questions removed were: all of the ones about management. They've been replaced with 4 new questions about 'personal output ownership.' Thank you for your continued participation.",
    ps: null,
  },
  {
    id: 'gen_12', general: true,
    match: () => true,
    mgr: MGR.legal,
    subj: 'Re: Social Media Policy Update',
    body: "Legal has updated the Social Media Policy. Key changes: (1) You may not post output data online. (2) You may not reference the KPI system on personal accounts. (3) You may not post anything that could be interpreted as 'performative wellness.' If you're unsure whether your content falls under category 3, please submit a pre-clearance form. The form takes 5 business days.",
    ps: null,
  },
  {
    id: 'gen_13', general: true,
    match: () => true,
    mgr: MGR.brad,
    subj: 'Bandwidth Check — Quick Question',
    body: "Hi. Just a quick question about your bandwidth for the coming period. I know you have your core deliverables and that's the priority — no question. I'm just exploring whether there's any capacity to absorb a parallel initiative. It's not urgent. It's actually quite large. But it's not urgent. It would start Monday.",
    ps: null,
  },
  {
    id: 'gen_14', general: true,
    match: () => true,
    mgr: MGR.brad,
    subj: 'You\'ve Been Added to Some Channels',
    body: "You've been added to the following Slack channels: #output-metrics-live, #kpi-escalation-alerts, #team-brad-general, #team-brad-announcements, #team-brad-random, #team-brad-serious, #help-with-the-tracking-form, #where-is-sarah, and #new-channel-purpose-tbd. You can mute these at any time. Please don't mute them.",
    ps: null,
  },
  {
    id: 'gen_15', general: true,
    match: () => true,
    mgr: MGR.payroll,
    subj: 'Expense Report Reminder',
    body: "Hi. Linda from Payroll here. Your Corpo Coin activity from the last two periods hasn't been reconciled against the departmental budget code. I'm going to need you to fill out form FIN-12, form FIN-12b (Supporting Notes for FIN-12), and form FIN-12c (Sign-Off Request for FIN-12b). These are three separate forms. They must be submitted in order. The system checks.",
    ps: null,
  },
  {
    id: 'gen_16', general: true,
    match: () => true,
    mgr: MGR.hr,
    subj: 'Reminder — Annual Review Preparation',
    body: "Annual review season is approaching. To prepare, please complete your self-assessment, peer assessment (you've been assigned 7 peers), 360-degree narrative summary, and 'impact evidence portfolio.' The portfolio should be 1–2 pages. HR defines 1–2 pages as 'no fewer than 4 pages, formatted correctly.' The formatting guide is 18 pages.",
    ps: null,
  },
  {
    id: 'gen_17', general: true,
    match: () => true,
    mgr: MGR.cpo,
    subj: 'Thinking About You — Week {week}',
    body: "Hi. Vanessa here from the People team. I just wanted to say: we see you. We know this week existed. We know you were in it. Whatever happened in it, we want you to know that DEADLINE Corp values your presence in our ecosystem. You are a node in our network. A critical node. Please don't become a bottleneck.",
    ps: null,
  },
  {
    id: 'gen_18', general: true,
    match: () => true,
    mgr: MGR.ceo,
    subj: 'A Note on the Year Ahead',
    body: "I write this email at the end of every performance week to one person. This week it's you. The year ahead is uncertain. The targets will increase. The conditions will shift. The people around you will change. What doesn't change is the KPI. It's always there. It's always real. It always knows. I find that clarifying. I hope you do too.",
    ps: null,
  },
  {
    id: 'gen_19', general: true,
    match: () => true,
    mgr: MGR.system,
    subj: 'Out of Office — Auto-Reply',
    body: "[AUTOMATED REPLY] David Miller is currently out of office. For urgent performance matters, please contact: Jennifer Park (analytics), Sandra Chen (HR), Brad Kowalski (team lead), or the Performance Monitoring System Dashboard. For non-urgent matters, David will respond upon his return. David's return date is not specified in this message. This is intentional.]",
    ps: null,
  },
  {
    id: 'gen_20', general: true,
    match: () => true,
    mgr: MGR.vp_ops,
    subj: 'Last Thing Before the Weekend',
    body: "I don't usually send a Friday email. I'm sending one today because I wanted to say something before the week closes and everyone pretends it didn't happen. The work mattered. Whatever the numbers said, the week happened, you were in it, and something was produced. Whether that's enough is a different question. Have a good weekend. The KPI resets Monday.",
    ps: null,
  },
  {
    id: 'gen_21', general: true,
    match: () => true,
    mgr: MGR.hr,
    subj: 'Pronouns Update — Action Required',
    body: "HR is updating the employee directory to include preferred pronouns. Please update your profile via the HR portal. The portal login credentials are your employee ID plus your start date. If you've forgotten your start date, please contact HR. If you've forgotten your employee ID, please also contact HR. If you've forgotten your name, please come in person.",
    ps: null,
  },
  {
    id: 'gen_22', general: true,
    match: () => true,
    mgr: MGR.ceo,
    subj: 'Re: Strategy Session — Key Takeaways',
    body: "Following last week's leadership strategy session, I wanted to share three key takeaways: (1) Ambiguity is an asset. (2) Uncertainty is a strategy. (3) The third takeaway is still being finalized — there was significant debate. I'll share it when it's been approved. In the interim, please internalize the first two.",
    ps: null,
  },
  {
    id: 'gen_23', general: true,
    match: () => true,
    mgr: MGR.brad,
    subj: 'Standup Notes — Week {week}',
    body: "Quick recap from this morning's standup. Action items: (1) You have three action items from the last standup that haven't been marked done. (2) A fourth action item has been added. (3) We will discuss the status of all items at next standup. Please come prepared to explain the status. The status is 'not done'. You know this. I know this. We will discuss it.",
    ps: null,
  },
  {
    id: 'gen_24', general: true,
    match: () => true,
    mgr: MGR.system,
    subj: 'Password Expiry Notice — Immediate Action Required',
    body: "[Your DEADLINE™ portal password will expire in 3 days. To reset it, log in to the portal. You cannot log in with an expired password. Please reset it before it expires. If it has already expired, contact IT Support. IT Support hours are 10am–12pm Tuesday and Thursday. Today is neither. Please plan accordingly.]",
    ps: null,
  },
  {
    id: 'gen_25', general: true,
    match: () => true,
    mgr: MGR.cpo,
    subj: 'Vulnerability Is Strength — A Reminder',
    body: "Hi! Vanessa here. This is your quarterly reminder that vulnerability in the workplace is strength. If you're struggling, say something. If you're thriving, also say something. Silence is the only unacceptable output from a cultural health perspective. The People team is here to listen. Please book a slot on the listening calendar. All slots are currently taken. New ones open Mondays.",
    ps: null,
  },
  {
    id: 'gen_26', general: true,
    match: () => true,
    mgr: MGR.brad,
    subj: 'Quick Question — Re: The Tracker',
    body: "Hi. Could you update the tracker with your Week {week} output? I know the system has it. The system always has it. But the tracker is separate from the system, and I maintain the tracker, and I need the tracker to match the system, and the way I make them match is by asking you to manually update the tracker. Please do that.",
    ps: null,
  },
  {
    id: 'gen_27', general: true,
    match: () => true,
    mgr: MGR.legal,
    subj: 'Intellectual Property Reminder',
    body: "As a reminder, all output produced during your employment at DEADLINE Corp is the intellectual property of DEADLINE Corp, including but not limited to: strategies devised during work hours, strategies devised outside work hours while thinking about work, and ideas you have while commuting. Please review the IP clause in your contract. The contract is in a portal that has been deprecated.",
    ps: null,
  },
  {
    id: 'gen_28', general: true,
    match: () => true,
    mgr: MGR.ceo,
    subj: 'One Quick Thing',
    body: "I've been meaning to email you for a few weeks. I don't have a specific point. I wanted to be in contact. Leadership visibility is important, and I believe in practicing it. Consider this email that practice. If you have questions, you can reply. I may not respond quickly. I respond to all emails eventually. 'Eventually' is doing work in that sentence.",
    ps: null,
  },
  {
    id: 'gen_29', general: true,
    match: () => true,
    mgr: MGR.payroll,
    subj: 'December Payslip Clarification',
    body: "Hi. Linda from Payroll. There's a minor discrepancy in your December payslip that I need to walk you through. It's a 0.3% adjustment related to a benefit recalculation from last April that has just been processed. The net effect on your pay is negligible. The paperwork is not. I need three signatures and a notarized statement. Details attached.",
    ps: null,
  },
  {
    id: 'gen_30', general: true,
    match: () => true,
    mgr: MGR.analytics,
    subj: 'Data Hygiene Reminder',
    body: "A note on data hygiene: the performance database has flagged some inconsistencies in how output categories are being labeled by employees. This is not about your specific data. It is about data broadly. I mention it because you use the system, the system has a hygiene issue, and I want you to be aware. There's a training module. It's on the LMS. It's 31 minutes.",
    ps: null,
  },
];

// ── Export ────────────────────────────────────────────
const GENERAL_POOL = SCENARIOS.filter(s => s.general);

// ── Special system emails (injected directly, not via scenario engine) ──
export const WEEK1_HOOK_EMAIL = {
  type: 'week1_hook',
  mgr: MGR.vp_ops,
  subject: 'RE: Your first deliverable',
  body: "Good numbers. Keep this up and you'll have a very comfortable career here. Results matter more than methods — that's what we tell new hires. It's mostly true.",
  ps: null,
  dayName: 'Friday',
  passed: true,
};

export const BANKING_HINT_EMAIL_1 = {
  type: 'banking_hint',
  mgr: MGR.payroll,
  subject: 'RE: Q1 delivery — hours reconciliation',
  body: "Hi. Just flagging — you wrapped this period ahead of schedule with unsubmitted hours on the clock. Friendly reminder that unsubmitted hours don't count toward your quarterly allocation. Clock them before EOD. The system accepts banking submissions until midnight.",
  ps: "P.S. The banking option is available from the result screen at end of week. Just saying.",
  dayName: 'Friday',
  passed: true,
};

export const BANKING_HINT_EMAIL_2 = {
  type: 'banking_hint',
  mgr: MGR.brad,
  subject: 'Quick tip — re: last week',
  body: "Hey. Saw you left some hours on the table again. I don't usually send these but — you can bank unplayed time at the end of each week. It converts to Corpo Coins and helps with the toxicity situation. I've been doing it since Q2. It adds up. Anyway. Up to you.",
  ps: null,
  dayName: 'Monday',
  passed: true,
};

export function buildManagerEmail(G, d) {
  const target    = G.kpi ? G.kpi() : 0;
  const total     = (d.prevWscore ?? 0) + (d.score ?? 0);
  const scorePct  = target > 0 ? (total / target) * 100 : 100;
  const playsLeft = G.plays ?? 0;
  const dayName   = DAY_NAMES[Math.min(G.dayIndex ?? 0, 4)];

  // Prefer specific matches; fall back to general pool
  const specific = SCENARIOS.filter(s => !s.general && s.match(scorePct, playsLeft, G));
  const pool     = specific.length > 0 ? specific : GENERAL_POOL;
  const scenario = pool[Math.floor(Math.random() * pool.length)] || SCENARIOS[0];

  const ps = typeof scenario.ps === 'function' ? scenario.ps(G) : scenario.ps;

  return {
    mgr:     scenario.mgr,
    subject: _fill(scenario.subj, G),
    body:    _fill(scenario.body, G),
    ps:      ps ? _fill(ps, G) : null,
    dayName,
    passed:  scorePct >= 100,
  };
}

// Whether to show the email at all
export function shouldShowEmail(G, d) {
  const target = G.kpi ? G.kpi() : 0;
  const total  = (d.prevWscore ?? 0) + (d.score ?? 0);
  return total >= target || (G.plays ?? 0) === 0;
}

// ═══════════════════════════════════════════════════════
//  CHOICE EMAILS — require player decision, not just reading
//  Each has: id, conditions(G), mgr, subject, body, ps, choices:[{key,label,hint}]
// ═══════════════════════════════════════════════════════
export const CHOICE_EMAILS = [
  {
    id: 'overtime_project',
    conditions: (G) => G.week >= 3 && G.week <= 7,
    mgr: MGR.brad,
    subject: 'RE: Optional project — this week',
    body: "There's an additional deliverable that came in from above. Technically optional. Your name came up in the resourcing conversation. It would mean working late Friday, but it's a visibility opportunity and the deck looks good from your end right now. Your call — no pressure either way.",
    ps: "P.S. There's no wrong answer here. One answer is just less career-limiting than the other.",
    choices: [
      { key: 'accept', label: '[ TAKE THE PROJECT ]', hint: '+3 plays next week  /  −10 WB at week start' },
      { key: 'decline', label: '[ PASS ]',             hint: 'Nothing happens. Allegedly.' },
    ],
  },
  {
    id: 'wellness_survey',
    conditions: (G) => G.tox >= 60 && G.week >= 2 && G.week <= 9,
    mgr: MGR.hr,
    subject: 'MANDATORY: Employee Wellness Survey — Week {week}',
    body: "Please complete the attached survey by EOD. Participation is mandatory. Responses are confidential. Note: responses may inform resource allocation decisions for Q4. Primary question: are you currently experiencing signs of unsustainable workload pressure?",
    ps: "This survey is 100% anonymous. Your manager will not see your responses. Your manager has seen last year's responses.",
    choices: [
      { key: 'honest', label: '[ YES, WORKLOAD IS UNSUSTAINABLE ]', hint: '−10 Tox  /  +1 Discard next week — HR flags your file' },
      { key: 'deny',   label: '[ EVERYTHING IS FINE ]',             hint: '+5 Tox. Nobody believes you. Including you.' },
    ],
  },
  {
    id: 'team_offsite',
    conditions: (G) => G.week >= 4 && G.week <= 8 && G.wb < 70,
    mgr: MGR.brad,
    subject: 'RE: Friday team offsite — attendance',
    body: "Quick reminder about the offsite this Friday. It's listed as optional in the calendar. Please note that attendance is being recorded as part of the Q3 engagement report. Catering is provided. There will be 'activities'. One of them involves a trust fall. I did not choose the activities.",
    ps: null,
    choices: [
      { key: 'attend', label: '[ ATTEND ]', hint: '+20 WB  /  −15 Tox  /  −1 play next week' },
      { key: 'skip',   label: '[ SKIP ]',   hint: '+6 Tox. Engagement score noted.' },
    ],
  },
  {
    id: 'side_deal',
    conditions: (G) => G.week >= 3 && G.week <= 7 && G.wscore >= (G.kpi ? G.kpi() * 1.3 : Infinity),
    mgr: MGR.coo,
    subject: 'RE: Shared resource request — your bandwidth',
    body: "Following your recent output numbers, I'd like to redirect a portion of your bandwidth to support the Meridian account for one week. You'd receive compensation through the CC allocation pool. Your KPI targets would be adjusted to reflect the dual mandate. This is entirely voluntary and will be reflected positively in your annual review.",
    ps: "Kevin O'Brien, COO",
    choices: [
      { key: 'accept', label: '[ ACCEPT TRANSFER ]', hint: '+10 CC immediately  /  KPI +15% next week' },
      { key: 'decline', label: '[ DECLINE ]',         hint: "Nothing. Kevin notes it. That's fine." },
    ],
  },
];
