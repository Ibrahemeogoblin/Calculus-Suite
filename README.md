# Calculus Suite Pro

Calculus Suite Pro is a premium single-page calculus workstation that combines symbolic and numeric solvers, live 2D/3D visualization, and a carefully crafted UI. Everything runs entirely in the browser – no build tools or backend required – which makes the project ideal for GitHub Pages deployments.

## Features

- 🎯 Multiple computation modes (basic calculus, advanced integration, differential equations, series expansion, multivariable calculus)
- 🧠 Hybrid symbolic & numeric engine powered by Math.js, Plotly, and Algebrite
- 📊 Real-time plotting with dark/light mode aware themes
- 💾 Autosave of the last entered function plus keyboard shortcuts for power users
- 🔒 Library health checks with automatic CDN fallbacks and inline warnings

## Project Structure

```
.
├── CalculusSuite.html   # Main application shell
├── index.html           # Redirect entry point for GitHub Pages
├── css/
│   └── styles.css       # Full interface styling
└── js/
    ├── lib-guard.js     # CDN fallback + validation helpers
    └── app.js           # All application logic
```

Keeping CSS/JS in dedicated folders makes it easy to audit changes, minify assets, or integrate with modern build pipelines later if needed.

## Getting Started

1. Clone or download this repository.
2. Open `index.html` (or `CalculusSuite.html`) in any modern browser.
3. Start typing functions like `x^2 + sin(x)` and explore the different operation modes.

> **Note:** All dependencies are loaded from well-known CDNs. An active internet connection is required the first time you open the application so those libraries can be cached by the browser.

## Deploying to GitHub Pages

1. Push the repository to GitHub (e.g., `main` branch).
2. In the repository settings, enable GitHub Pages and choose the branch that contains `index.html`.
3. Within a minute or two your site will be live at `https://<username>.github.io/<repo>/`.

Because the app is a static site, no further configuration is necessary. The CDN health-check/auto-fallback logic will keep third-party libraries resilient across different regions.

## Development Tips

- The UI is designed with CSS custom properties, making it straightforward to tweak themes or brand colors.
- `js/app.js` is intentionally verbose and heavily commented so you can adapt computational workflows as needed.
- If you want to work offline, open the site once with an internet connection so the CDN assets are cached. Afterwards, the suite will continue working locally thanks to the hybrid math engine.

---

Enjoy building with Calculus Suite Pro! If you ship improvements, feel free to open a PR or fork for your own flavor of the suite.