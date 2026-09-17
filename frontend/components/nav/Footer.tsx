const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-hairline">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {year} devdash. Built with Next.js, FastAPI, PostgreSQL, and the Gemini API.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <a
            href="https://github.com/Aime-Serge/innovation-hacks-task4-platform"
            className="hover:text-text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
          <a
            href={`${API_URL}/docs`}
            className="hover:text-text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            API docs
          </a>
          <a
            href="https://github.com/Aime-Serge"
            className="hover:text-text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Built by Aime Serge UKOBIZABA
          </a>
          <a
            href="https://innovationhacks.in"
            className="hover:text-text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Innovation Hacks
          </a>
        </nav>
      </div>
    </footer>
  );
}
