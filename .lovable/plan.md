

## Add GitHub Pages Hosting Disclosure to Disclaimer

Section 4 ("Open-Source Software & Public Hosting") already mentions the source code is "hosted publicly on GitHub," but it doesn't clarify that the **website itself** is served directly from GitHub Pages — not a traditional web server or hosting provider. This is legally relevant because it reinforces that there is no backend server, no data collection infrastructure, no server-side processing, and no commercial hosting arrangement.

### Change

**`src/pages/Disclaimer.tsx`** — Add a new paragraph to Section 4 after the existing three paragraphs, stating:

> CHEESEHub is hosted and served directly via GitHub Pages, a static site hosting service provided by GitHub, Inc. The platform does not operate its own web servers, backend infrastructure, or databases. All content is delivered as static files from GitHub's infrastructure. This means there is no server-side processing, no user data collection or storage by CHEESEHub, and no proprietary hosting arrangement. GitHub Pages is subject to GitHub's own Terms of Service and acceptable use policies. CHEESEHub has no control over GitHub's infrastructure, uptime, availability, or content delivery — any interruption, suspension, or modification of service by GitHub is beyond the control of the CHEESEHub community.

This keeps the same styling and tone as the rest of Section 4.

