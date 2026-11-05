/**
 * Decides whether an HTTP response is only a shell.
 * JavaScript on the page is not enough. The visible text must actually be missing.
 */
export function httpResponseNeedsBrowser(html: string, text: string): boolean {
  const visible = text.replace(/\s+/g, " ").trim();
  const main = html.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
  const mainText = main ? main[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  if (mainText.length >= 80) return false;
  // Chrome can be long while the price, table, or article is still an empty slot.
  if (visible.length > 500) {
    const scripted = /__NEXT_DATA__|self\.__next_f|data-reactroot|id=["'](__next|root|app)["']/i.test(html);
    const emptySlot = /<(main|article|table|ul|tbody)\b[^>]*>\s*<\/\1>/i.test(html) || /aria-busy=["']true["']|class=["'][^"']*skeleton/i.test(html);
    return scripted && emptySlot && mainText.length < 40;
  }
  if (/enable javascript|you need to enable javascript/i.test(visible) && visible.length < 700) return true;
  if (/id=["'](__next|root|app|__nuxt|sapper)["']/i.test(html) && visible.length < 400) return true;
  if (/__NEXT_DATA__|self\.__next_f|data-reactroot|data-react-helmet/i.test(html) && visible.length < 350) return true;
  const scripts = (html.match(/<script\b/gi) ?? []).length;
  const emptyMain = /<(main|article)[^>]*>\s*<\/\1>/i.test(html);
  if (emptyMain && scripts >= 2 && visible.length < 220) return true;
  if (scripts >= 8 && visible.length < 280) return true;
  return false;
}
