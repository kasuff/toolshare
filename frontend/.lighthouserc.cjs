module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview -- --host 127.0.0.1 --port 4175",
      startServerReadyPattern: "ready in",
      url: [
        "http://127.0.0.1:4175/",
        "http://127.0.0.1:4175/tools",
        "http://127.0.0.1:4175/workshops",
        "http://127.0.0.1:4175/auth"
      ],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--headless --no-sandbox --disable-dev-shm-usage",
        onlyCategories: ["accessibility"]
      }
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 1 }]
      }
    },
    upload: {
      target: "filesystem",
      outputDir: "./lighthouse-results"
    }
  }
};
