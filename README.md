# LangFix - Chrome Extension 🌐⌨️

Ever typed a whole sentence only to realize your keyboard was in the wrong language? (e.g., typing `akuo` instead of `שלום`). 

**LangFix** is a lightweight Chrome Extension that instantly fixes your text without needing to retype it. It works seamlessly on modern sites, including complex chat interfaces like WhatsApp Web.

## 🚀 How to Install (Developer Mode)

Since this extension is loaded locally, follow these quick steps to add it to your browser:

1. **Download the files:** Download this repository as a ZIP file and extract it into a single, dedicated folder on your computer.
2. **Open Extensions:** Open Google Chrome and navigate to `chrome://extensions/` in your address bar.
3. **Enable Developer Mode:** Toggle the **"Developer mode"** switch located in the top right corner.
4. **Load the Extension:** Click the **"Load unpacked"** button in the top left and select the folder you extracted in step 1.
5. **Refresh your browser:** Refresh any active tabs (F5) so the extension can inject its script into the pages.

*(Note: LangFix automatically redirects the default Chrome 'New Tab' page to Google Search so the extension can function properly).*

## 💻 Usage

Once installed, simply type in any text field. If you notice you're typing in the wrong language, you have two quick options:
* **Keyboard Shortcut:** Press `Alt + C` to instantly flip the active text.
* **Floating Button:** Click the small `EN↔HE` button floating right below your active text box.

## ⚠️ Known Limitations

**Single-word text is converted automatically.** For multi-word text on complex platforms like WhatsApp Web, an extra step is required.

React-based rich-text editors (WhatsApp Web, Facebook Messenger, etc.) wrap each word in its own internal `<span>` element. Programmatically selecting across those spans and replacing the content causes React's virtual DOM to conflict with the real DOM and instantly revert the change. Until a reliable cross-platform workaround is found, automatic full-selection is disabled on these editors.

**How to fix multi-word text on WhatsApp Web:**

1. Select all the text you want to convert manually — use `Ctrl + A` inside the text box, or click and drag.
2. Press `Alt + C` (or click the floating `EN↔HE` button).

The extension will replace exactly what you have highlighted.