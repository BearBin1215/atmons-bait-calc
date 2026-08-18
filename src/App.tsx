import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Calculator from "@/components/calculator";
import { type Locale, LOCALE_LABELS } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { ArrowUp, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOCALES = Object.keys(LOCALE_LABELS) as Locale[];

/** 页面滚动超过该像素数时显示返回顶部按钮 */
const BACK_TO_TOP_THRESHOLD = 300;

/** 右下角返回顶部按钮：滚动超过阈值后淡入，点击平滑滚动回顶部 */
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > BACK_TO_TOP_THRESHOLD);
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-4 bottom-4 z-50 inline-flex size-9 cursor-pointer items-center justify-center rounded-none border bg-background text-muted-foreground shadow-sm transition-opacity outline-none hover:bg-muted hover:text-foreground",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}

function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t("header.title");
  }, [i18n.language, t]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
        <h1 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <img
            src={`${import.meta.env.BASE_URL}poke_snack.png`}
            alt=""
            className="size-6"
          />
          {t("header.title")}
        </h1>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-none text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
              <Languages className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LOCALES.map((l) => (
                <DropdownMenuItem
                  key={l}
                  onClick={() => i18n.changeLanguage(l)}
                  className={
                    i18n.language === l
                      ? "normal-case"
                      : "text-muted-foreground normal-case"
                  }
                >
                  {LOCALE_LABELS[l]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <a
            href="https://github.com/BearBin1215/atmons-bait-calc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-none text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <SiGithub className="size-5" />
          </a>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-6">
        <div className="mx-auto">
          <Calculator />
        </div>
      </main>
      <BackToTop />
    </div>
  );
}

export default App;
