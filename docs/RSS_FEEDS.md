# RSS Feed URLs for News Outlets

## Confirmed Working RSS Feeds

### Tech Outlets
1. **TechCrunch**
   - URL: `https://techcrunch.com/feed/`
   - Status: ✅ Official RSS

2. **The Verge**
   - URL: `https://www.theverge.com/rss/index.xml`
   - Tech section: `https://www.theverge.com/rss/tech/index.xml`
   - Status: ✅ Official RSS

3. **WIRED**
   - URL: `https://www.wired.com/feed/rss`
   - Status: ✅ (needs verification)

4. **Ars Technica**
   - URL: `https://feeds.arstechnica.com/arstechnica/index`
   - Status: ✅ Official RSS

5. **MIT Technology Review**
   - URL: `https://www.technologyreview.com/feed/`
   - Status: ✅ (needs verification)

6. **VentureBeat**
   - URL: `https://venturebeat.com/feed/`
   - Status: ⚠️ (needs verification)

### Business Outlets
7. **Forbes**
   - URL: `https://www.forbes.com/technology/feed2/`
   - Innovation: `https://www.forbes.com/innovation/feed2/`
   - Status: ✅ Official RSS

8. **CNBC**
   - Technology: `https://www.cnbc.com/id/19854910/device/rss/rss.html`
   - Business: `https://www.cnbc.com/id/10001147/device/rss/rss.html`
   - Status: ✅ Official RSS (from their RSS page)

9. **Business Insider**
   - URL: `https://www.businessinsider.com/rss`
   - Tech: `https://www.businessinsider.com/tech/rss`
   - Status: ⚠️ (needs verification)

10. **Reuters**
    - Technology: `https://www.reuters.com/technology/rss`
    - Business: `https://www.reuters.com/business/rss`
    - Status: ⚠️ (needs verification)

11. **Fast Company**
    - URL: `https://www.fastcompany.com/feed`
    - Tech: `https://www.fastcompany.com/technology/rss`
    - Status: ⚠️ (needs verification)

12. **Bloomberg**
    - Technology: `https://feeds.bloomberg.com/technology/news.rss`
    - Status: ⚠️ (needs verification)

### Specialized Outlets
13. **TLDR**
    - URL: `https://tldr.tech/feed`
    - Status: ❌ Newsletter service (may not have RSS)

14. **Business of Fashion**
    - URL: ❌ No native RSS feed
    - Alternative: Use web scraping or RSS generator service

15. **The Interline**
    - URL: `https://www.theinterline.com/feed/`
    - Status: ⚠️ (needs verification)

## Implementation Plan

### Tier 1: Confirmed Outlets (Use First)
Use these 8 outlets with confirmed RSS feeds:
- TechCrunch
- The Verge
- Ars Technica
- Forbes
- CNBC

### Tier 2: Likely Have RSS (Verify)
Test these 7 outlets:
- WIRED
- MIT Tech Review
- VentureBeat
- Business Insider
- Reuters
- Fast Company
- Bloomberg
- The Interline

### Tier 3: No RSS (Skip for Now)
- TLDR (newsletter)
- Business of Fashion (no native RSS)

## Next Steps

1. Test each RSS URL
2. Keep ones that work
3. Remove non-working outlets from the list
4. Implement RSS fetching in fetch-news.js
