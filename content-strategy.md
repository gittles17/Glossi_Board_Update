# Glossi Email Blast Content Strategy

A content strategy framework for Glossi that adds email blasts as a distribution channel alongside other content types, modeled after how Cursor, Linear, and other best-in-class SaaS companies communicate with their audiences.

---

## Why Email Blasts (vs. Other Content Types)

Email is an **owned channel**. Unlike social media (algorithm-dependent), blog posts (SEO-dependent), or paid ads (budget-dependent), your email list is yours. No platform can throttle your reach. This is why Cursor, Linear, Resend, and Vercel all treat email as their primary direct line to users.

**Email vs. other channels:**

- **Blog posts**: Great for SEO and depth, but passive. People have to find them. Email pushes content to people.
- **Social media (X/LinkedIn)**: Good for reach and discovery, but you don't own the audience. Algorithm changes can kill engagement overnight.
- **In-app notifications**: Only reach active users. Email reaches everyone, including churned and prospective users.
- **Email blasts**: Direct, personal, measurable, and the highest ROI channel in marketing ($36 return per $1 spent on average). People check email daily. It builds a compounding relationship over time.

The best SaaS companies use email as the **connective tissue** between all other content. A blog post gets written, then an email drives traffic to it. A feature ships, then a changelog email announces it.

---

## Who to Send To (Audience Segments)

For Glossi as a SaaS, your list should be segmented into these groups. Each gets different content at different frequencies:

- **Current clients/users**: Product updates, tips, feature announcements, case studies. They need to know the product is alive, evolving, and valuable. Keeps churn low.
- **Prospective clients**: Thought leadership, social proof, industry insights. They need reasons to believe Glossi solves their problem. Moves them toward a demo/trial.
- **Investors (current and prospective)**: Milestones, traction updates, press coverage. They need confidence that Glossi is growing. Keeps them engaged between formal updates.
- **General subscribers (top of funnel)**: Anyone who signs up for "Glossi news." Industry insights, company story, vision pieces. Warms them up before they know what segment they belong to.
- **Press/partners**: Press releases, partnerships, major announcements. Amplifies reach through third parties.

---

## What Kinds of Emails Work Best

### 1. Product Changelog (the Cursor/Linear model)

- **What**: Clean, visual summary of new features and improvements
- **When**: Every 2-4 weeks, or when something meaningful ships
- **Who**: Current users, prospective clients
- **Why it works**: Shows momentum. Cursor's changelog emails are concise, beautifully designed, and make you feel like the product is constantly improving. Linear does the same with their monthly updates.
- **Format**: Short intro (1-2 sentences), then a list of features with screenshots or GIFs. No fluff.

### 2. Company Milestone / Traction Update

- **What**: Funding closed, user growth milestones, key hires, partnerships
- **When**: As they happen (probably quarterly)
- **Who**: Investors, press, general subscribers
- **Why it works**: Builds narrative momentum. Investors want to see traction between board meetings. Subscribers want to root for a company that's winning.
- **Format**: Brief, confident tone. 1 headline, 2-3 supporting points, a forward-looking statement.

### 3. Thought Leadership / Industry Insights

- **What**: Glossi's perspective on the industry, trends, or problems you're solving
- **When**: Monthly or bi-weekly
- **Who**: Prospective clients, general subscribers
- **Why it works**: Positions Glossi as experts. People buy from companies they trust and respect. Linear's blog-to-email pipeline does this well.
- **Format**: One clear insight or opinion, 300-500 words max. Link to full blog post if longer.

### 4. Customer Stories / Use Cases

- **What**: How a real customer uses Glossi, what results they got
- **When**: Monthly or as stories become available
- **Who**: Prospective clients, current users (cross-pollination of ideas)
- **Why it works**: Social proof is the strongest conversion tool. People trust other users more than marketing copy.
- **Format**: Problem, solution, result. Keep it to 200-300 words with a quote from the customer.

### 5. Welcome / Onboarding Series (automated, not a "blast")

- **What**: 3-5 emails over 2 weeks after someone signs up
- **When**: Triggered by signup
- **Who**: New subscribers or trial users
- **Why it works**: First impressions compound. Cursor sends a clean welcome email that sets expectations. Linear sends onboarding tips.
- **Format**: Email 1: Welcome + what to expect. Email 2: Quick win / getting started. Email 3: Deeper feature. Email 4: Social proof. Email 5: Soft CTA.

### 6. Event / Launch Announcements

- **What**: Webinars, product launches, conference appearances, demos
- **When**: As needed (with a reminder email 24h before)
- **Who**: Segment-dependent (investors for funding events, users for product launches)
- **Why it works**: Creates urgency and a moment. People engage more with time-bound content.
- **Format**: Clear headline, date/time, one CTA button.

### 7. Re-engagement (for quiet users)

- **What**: "Here's what you've missed" or "We've shipped X since you last logged in"
- **When**: After 30-60 days of inactivity
- **Who**: Churned or inactive users
- **Why it works**: Cheaper to re-engage than acquire. A well-timed email showing new features can bring users back.
- **Format**: Friendly, no guilt. Highlight 2-3 improvements. Single CTA to log back in.

---

## Recommended Cadence

- **Weekly or bi-weekly**: Thought leadership / industry content (to general list)
- **Every 2-4 weeks**: Product changelog (to users + prospects)
- **Monthly**: Customer story or use case
- **Quarterly**: Investor/traction update
- **As needed**: Launches, events, milestones, re-engagement

**Key rule from Cursor/Linear**: Never send an email just to send an email. Every email should either inform, inspire, or invite action. If you don't have something worth saying, skip the week.

---

## Email Design Principles (the Cursor/Linear aesthetic)

- **Minimal and clean**: White/light background, one column, generous whitespace
- **Text-forward**: The content is the design. Not a template stuffed with images.
- **One clear CTA**: Every email has one thing you want the reader to do
- **Mobile-first**: 60%+ of emails are opened on mobile
- **Consistent branding**: Same header, same tone, same sender name every time
- **Plain-text option**: Some of the best-performing emails look like they came from a person, not a marketing team

---

## Next Steps (When Ready to Build)

When you're ready to implement, the technical work would involve:

1. **Subscriber list management** in the Glossi dashboard (contacts table in PostgreSQL, tagging/segmentation UI)
2. **Email composer** with template previews (leveraging existing PR content generation patterns in `pr.html`)
3. **Integration with a sending service** (Resend is the Cursor/Linear choice, but SendGrid or Postmark are also solid)
4. **Public signup form/page** for collecting new subscribers
5. **Basic analytics** (open rate, click rate, unsubscribe rate)

These can be added incrementally to the existing Express/PostgreSQL stack on Railway.
