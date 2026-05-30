import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white/75 px-6 py-8 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-500 sm:flex-row">
        <p className="text-center leading-relaxed sm:text-left">
          © {new Date().getFullYear()} GPT STORE · ChatGPT Plus без иностранной карты
        </p>
        <nav className="flex gap-5">
          <Link href="/privacy" className="hover:text-gray-800 transition-colors">
            Конфиденциальность
          </Link>
          <Link href="/terms" className="hover:text-gray-800 transition-colors">
            Условия
          </Link>
          <a
            href="https://t.me/subs_support"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-800 transition-colors"
          >
            Telegram
          </a>
        </nav>
      </div>
    </footer>
  );
}
