import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "CONTENT_READ") {
        handleRead(message.action, message.selector).then(sendResponse);
        return true; // async response
      }
      return false;
    });
  },
});

async function handleRead(
  action: string,
  selector?: string
): Promise<{ type: string; title?: string; markdown?: string; url: string }> {
  const url = location.href;

  if (action === "highlight" && selector) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.style.outline = "3px solid red";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // Use Readability on a cloned document to avoid mutating the page
  const docClone = document.cloneNode(true) as Document;
  const reader = new Readability(docClone);
  const article = reader.parse();

  let markdown = "";
  if (article?.content) {
    markdown = turndown.turndown(article.content);
  } else {
    // Fallback: convert body HTML
    markdown = turndown.turndown(document.body.innerHTML).slice(0, 50000);
  }

  return {
    type: "CONTENT_READ_RESULT",
    title: article?.title ?? document.title,
    markdown,
    url,
  };
}
